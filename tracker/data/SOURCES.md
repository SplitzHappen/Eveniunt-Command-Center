# Data sources (pinned)

- Game data: `xivapi/ffxiv-datamining` at `44948e4cda5846eab0baa9872122a888fcc4f1b1` (game version 7.57h1, 2026-10-20), English CSVs. Every entry, name and in-game grouping comes from these sheets. Game data (c) SQUARE ENIX CO., LTD.
- Patch labels (community data, labelled as such in the app): `ffxiv-teamcraft/ffxiv-teamcraft` at `c1ede0a03c0072c830e0a1b3b8e7a20ea539e3b3` (MIT licence), files `item-patch.json`, `patch-content.json`, `patch-names.json`, and `gathering-log-pages.json` (places 53 gathering-log items whose gathering spot is not in the game sheets), and `fates.json` (each FATE's zone; the game's Fate sheet stores only a layout id).
- "How to get it" and availability (community data, labelled in the app): FFXIV Collect public API snapshot of 2026-11-07, saved in `data/ffxivcollect/` by `tools/fetch-ffxivcollect.py` (the project is MIT-licensed). Gives the sources of every mount, minion, orchestrion roll, emote, hairstyle, barding, fashion accessory, facewear and Blue Magic spell, and, through the API's own filter, which items can only be obtained from time-limited sources. Time-limited achievement ids and categories come from FFXIV Collect's `config/achievements.yml` at commit `71689864` (`data/ffxivcollect/achievements-time-limited.json`). FFXIV Collect totals are also the independent count check.

- Extra lists and the desktop-app import map (owner decision 2026-11-07, option 3, credited): the community "FFXIV 100% Completion Checklist" workbook 7.45 by its volunteer team (the same team as the FFXIV Completionist desktop app). `tools/add-checklist.py <workbook.xlsx>` runs after `tools/extract.py`, appends 38 lists (marked `src: "checklist"`) and writes `data/desktop-map.json`. Rows the workbook pre-marks with X carry the "no longer obtainable" mark. The workbook file itself is not committed.

## Custom Deliveries and Cosmic Exploration (game data, owner request 2026-11-08)

Built by `tools/extract.py` from the pinned game sheets; neither the workbook nor the desktop app has these lists.

- **Custom Deliveries** (12 clients, Zhloe Aliapoh to Tiisol Ja): `SatisfactionNpc` (client from `Npc` via `ENpcResident`, unlock quest, unlock level). Each character's satisfaction rank is entered as a number; a client counts as complete at the top rank (one more than the number of rank thresholds in the sheet: 5 for every client).
- **Cosmic Exploration: Missions** (1,699): `WKSMissionUnit`, grouped by planet and class. The sheet lists each planet's missions class by class (Carpenter first), followed by short runs of extra missions; a new planet starts where a long Carpenter run begins, and the build stops unless that gives exactly the planets in `WKSPlanetSelect` (Sinus Ardorum, Phaenna, Oizys, Auxesia). Icon glyphs in mission names are removed.
- **Cosmic Exploration: Records** (244): `WKSAchievement` (the Cosmic Exploration record list), grouped by planet from its wording ("on the moon" is Sinus Ardorum); six general records.
- Not included: development grades and the Pioneering Trail, which belong to the whole world (server) rather than to a character; cosmic tools are already in Relic Tools.

## Links between entries (data/links.json)

`tools/links.py <datamining checkout>` (after the two data steps) builds about 15,000 links from the pinned game sheets. They only ever add ticks, never to an entry that does not apply to the character.

| Link | From the game data | Direction |
| --- | --- | --- |
| Earlier quests | `Quest.PreviousQuest` (all required); untracked quests in between are walked through. "One of" steps between the starting cities' or Grand Companies' versions follow the character's own city (worked out from which cities can reach each quest) or company | quest → earlier quests |
| Aether currents | `AetherCurrent.Quest` | both ways |
| Quest rewards | `Quest.Reward` (items everyone receives), `Quest.EmoteReward`; back to the quest only when FFXIV Collect lists that quest as the item's single source | quest → reward; item → quest |
| Duties | `Quest.InstanceContent` (duties a quest requires), `Quest.InstanceContentUnlock` (the quest a duty needs) | quest → duty; duty → quest |
| Achievements | `Achievement.Type`/`Key`/`Data`: one quest (both ways), any of several quests, other achievements (both ways), job levels and mastery levels, duty clears (both ways), the whole hunting log of a class (both ways), allied society ranks (both ways), Freebird (all currents of a zone, both ways), minion count, Triple Triad cards 1 to N (both ways), relic weapon and tool stages (both ways; matched by name or by the stage the achievement's quest names), sightseeing entry ranges (both ways), shared FATE rank 3, Yo-kai minions, FATE count, orchestrion count, card count, and FATEs completed with the highest rating (the achievement proves the FATE; the FATE gives the achievement only when "assume a gold rating" is on) | as noted |
| Titles and reward items | `Achievement.Title` (both ways when only one achievement gives the title), `Achievement.Item` (back to the achievement only when it is the item's single source) | as noted |
| Ladders | grand company ranks, allied society ranks (by the game's rank number; names that share a rank are not linked to each other), companion ranks and skills, elemental, resistance, knowledge and sanctuary ranks, shared FATE ranks, mount speed increases, hunting log ranks, relic weapon and tool stages (A Realm Reborn to Endwalker, where the workbook order also rises in item level) | higher → lower |
| Shared FATE ranks | "Complete N FATEs in a zone" once N different FATEs of that zone are ticked | FATEs → rank |
| Master recipe books | `Recipe.SecretRecipeBook` | master recipe → book |

| Achievement tiers | the same counter (`Achievement.Type`/`Key`) at a higher threshold proves the lower ones (enemies, dungeons, PvP matches, levels, ranks, minion counts) | higher → lower |
| Emotes | emotes unlocked by the same item | both ways |
| Grand Company | the first rank and the company's officer quest (both ways); promotions that need a hunting log rank (workbook notes) | as noted |
| Mount speed | a first increase the workbook gives as a quest, and that quest (both ways) | both ways |

**From the FFXIV Completionist desktop app (1.0.5).** `tools/desktop-links.js` reads the link fields its data files carry (`cPrev`, `cNext`, `cSiblings`, `cCombo`, from the installer the owner shared) and `tools/merge-desktop-links.js` adopts the ones the game data does not already give, after checks: both ends must still be the same entry by name (its data is from patch 7.38, so its position-based lists no longer line up everywhere), no link across starting cities or Grand Companies (a link from a shared entry to one city's entry applies only to that city), relic links within one job, nothing the game's quest order contradicts, and only links that add ticks (its "unticking unticks" cascades are not adopted). 802 links and 27 "complete this set" rules were adopted (kind `x`); a link into one of two same-named versions of a quest (the first class quests' starter and joiner routes) is not adopted (19), for example the Firebird, Kamuy and Landerwaffe quests needing their mounts, allied society rank quests, hunt-mark achievements, "Tales of War/Magic/the Hand/the Land" needing every class quest, class quests that give the first relic tools, and Hall of the Novice order.

**Checked on Console Games Wiki (2026-11-08):** Phantom Weapons and Cosmic Tools are upgraded one stage at a time (so Dawntrail relic stages are linked like the others); the "Big Game Hunter" achievements are Legacy (from version 1.0, unobtainable), so they need no FATE link; spot checks of items that prove their only source (Black Chocobo, Manacutter, Unicorn, Firebird, Wind-up Louisoix) match.

Not linked (no reliable link): skyward and cosmic score achievements, and achievements counted from things the tracker does not record (enemies defeated, levequest counts, and so on).

## Content added after the workbook's 7.45 edition

The workbook stops at 7.45; the game sheets are pinned at 7.57h1. `tools/add-checklist.py <workbook.xlsx> --dm <datamining checkout>` compares each relevant game sheet at the 7.45h2 commit (`d67201a2a27933a444bf249d900f7afd2840f6ff`) with the pinned commit and appends the new rows to the matching workbook list, each with the note "Added after the checklist's 7.45 edition (from the game data, 7.57)". Existing rows keep their ids, so the desktop-app import map is unchanged; new rows use ids above 100000.

| List | Added | From |
| --- | --- | --- |
| Adventurer Plate | 76 (12 base plates, 13 borders, 38 decorations, 13 design presets; unnamed and duplicate-name rows skipped) | CharaCardBase, CharaCardHeader, CharaCardDecoration, CharaCardDesignPreset |
| Portraits | 98 (backgrounds, frames, accents) | BannerBg, BannerFrame, BannerDecoration |
| Relic Weapons | 42: Phantom weapons, stages Eclipticum and Occultum, 21 jobs each (Paladin sword and shield as one row; replicas left out) | Item (main hand and shield slots) |
| Relic Tools | 33: Hyper tools v1.1 and v1.2 and the "of Stars" tools, 11 crafters and gatherers | Item (item level above the workbook's highest, 765) |
| Occult Crescent: Phantom Jobs | 8 (Ninja, White Mage, Black Mage, Dragoon, Summoner, Blue Mage, Red Mage, Necromancer) | MKDSupportJob |
| Portable Archive and Collections | 29 Occult Records (North Horn) | MKDLore |
| Occult Crescent: Events | 15 North Horn critical engagements | DynamicEvent |
| Occult Crescent: Duties | 2 (The Forked Tower: Magic, and Extreme) | DynamicEvent |
| Occult Crescent: Knowledge Levels | 20 (levels 21 to 40) | cap from the 7.55 patch notes as reported by guides; the game's MKDGrowData table now grows past 20 (the build stops if that changes) |
| Classes and Jobs | Beastmaster (Limited Job), level cap 50 | ClassJob 43; unlock quest from Quest; cap from the 7.56 notes as reported by guides |
| Fishing Log: Spots | 1 ocean-fishing spot (Thavnair Spectral Current) | FishingSpot (rows with a zone only; the 37 zoneless rows are Cosmic Exploration mission spots, which the workbook does not list) |

Not added, because no reachable data identifies them: 3 Triple Triad opponents the game sheets list without a name (TripleTriadResident 2293903 to 2293905), and the North Horn aether shards (the official Lodestone and the wikis could not be opened from the build session; web search did not name them). Lists drawn from the game sheets (mounts, minions, quests, achievements, logs, duties and so on) already include everything up to 7.57h1.

## Availability marks

- `x: "lim"`: only obtainable from time-limited sources (events, seasonal content, ended campaigns, PvP seasons); it may return. 962 entries: 514 from FFXIV Collect, 310 seasonal quests (the journal's "… Events" genres and quests the game ties to a festival: Gold Saucer campaigns and collaboration events) and 138 titles whose every achievement is time-limited.
- `x: "gone"`: no longer obtainable: Legacy achievements (261), 51 titles that only Legacy achievements grant, 13 mounts that exist in the game files but are quest or duty vehicles, never collectable, and the rows the checklist workbook pre-excludes (shown as "Not applicable": many never existed, for example a second mount speed increase in a zone that has only one).
- `x: "unk"`: availability unknown: 463 named FATEs that no reachable data places in any zone (special areas or unused).
- All three are shown with an X and left out of totals by default; every entry has a manual switch that overrides the mark both ways (owner rule, 2026-11-07).
- Nothing is marked only because a source is missing: 20 gathering-log items whose spot is in no reachable data stay counted in their own group.

Regenerate:

```
git clone --filter=blob:none --no-checkout https://github.com/xivapi/ffxiv-datamining dm && git -C dm checkout 44948e4c -- csv/en
# Teamcraft: git show c1ede0a0:libs/data/src/lib/json/<file>.json > tc/<file>.json for the three files
python3 -I tools/extract.py dm tc
```

`data/tracker-data-report.json` lists the count per list and every dropped or unlabelled row by reason.

## Merged rows and class routes (2026-11-08)

- Repeated rows of one thing become one entry, with the other ids kept as aliases (a tick on an old id moves over on load): each Crystalline Conflict arena once per mode (61 rows: the sheet repeats each arena per match type), duplicate emote rows (Snowball, Dote, All Saints' Charm).
- First class quests: for each starting class, the starter route (its own "Way of the …" with no prerequisite, and the level 10 quest after it) is marked `sc` and the joiner route (the guild's "So You Want to Be …", the second "Way of the …", "My First …" and the second level 10 quest) is marked `jc`, from the Quest sheet's prerequisites. A character with that starting class does not have the joiner route; others do not have the starter route. Nothing is excluded until the starting class is chosen.

## Lists added 2026-11-08 (game sheets unless noted)

| List | Source | Links |
| --- | --- | --- |
| Class and Job Quests (ten lists) | the former Class & Job Quests, split by the journal's page (the desktop app's pages); entries carry `mv` (old list) | unchanged |
| Beastmaster: Master's Bestiary | `XBMPet` (names from `Pet`, places from `PlaceName`) | "Befriend N unique beasts" counts them |
| Beastmaster: Crucible of the Unbroken | `ContentFinderCondition` type 40 | achievements of type 14 (clear the board); the quest that unlocks each board (`Quest.InstanceContentUnlock`) |
| Treasure Hunt: Maps | `TreasureHuntRank` (one row per map item) | none |
| Duties: Treasure Dungeons, Quantum Duties, Event Duties | `ContentFinderCondition` types 9, 39, 22 (event duties marked time-limited) | "Complete/Raid <duty>." (once) both ways, for treasure dungeons and Quantum duties |
| Occult Crescent: Lore | `MKDLore` (rows from "North Horn Base Camp" on are North Horn) | none |
| Trust | the in-game Trust avatars per expansion; member lists and level ranges as on the FFXIV Completionist desktop app's Trust page (1.0.5) | "Achieve trust level N with the avatars for …" / "… all available avatars in <expansion>" as level rules |

The import map (`data/desktop-map.json`) also reads the desktop app's Trust (`duty/trust/shb`, `ew`, `dt`) and Treasure Hunt (`duty/treasure-hunt/maps`, `duties`) pages by position, matched by name.

## Organisation and the information window (2026-11-08)

- `tools/organize.py` (run after `tools/add-checklist.py`) does three things. Each moved entry keeps its old list in `mv`, so saved ticks move over.
  - It splits the big lists into one list per expansion.
  - It adds the expansion layer (`xp` on each group).
  - It places duties by their map's expansion, with the deep-dungeon series and the Aquapolis by name.
  - Expansion sources: `Quest.Expansion` for quests; `TerritoryType.ExVersion` (through the group's zone) for duties, FATEs and the Hunt; level bands for levequests; the release patch for everything else.
- `tools/info.py` writes `data/info.json`, a few lines per entry. Sources:
  - game sheets: `Quest` (issuer, level, class category, prerequisites, `InstanceContentUnlock`, `INSTANCEDUNGEON` parameters of quests that add content), `ContentFinderCondition`, `Adventure` + `Level` + `Map` (vista coordinates, time, weather, emote), `Recipe` + `RecipeLevelTable` + `SecretRecipeBook`, `AetherCurrent`, `Achievement`, `Title`;
  - FFXIV Teamcraft data files (MIT, commit `70429e2`): `npcs.json` (positions), `fates.json`, `monsters.json`, `aetherytes.json`, `leves.json`, `fishing-spots.json`, `fishing-sources.json`, `fish-parameter.json`, and the `nodes.json` already used by the extractor.
- The windows link nowhere (owner, 2026-11-08: the information belongs in the tracker). Further sources:
  - `data/fish-tracker.json`: fishing windows, weather, bait chains, intuition and folklore from ff14-fish-tracker-app (MIT License, (c) icykoneko). Fetched by `tools/fetch-fishdata.py` at a pinned commit; the file is read as text, never run.
  - `data/elite-marks.json`: each elite mark's rank, area, spawn trigger and respawn time. These are facts from the Console Games Wiki's Elite Marks tables (2026-11-08).
  - `data/occult-lore.json`: what unlocks each Occult Crescent record. These are facts from the wiki's Occult Record table.
  - `data/variant-routes.json`: each variant dungeon record's route, written for the tracker from the facts in the wiki's route tables.
  - Field aether current spots come from the game data: `EObj.Data` names the current, and the `Level` row holding that object gives the spot.
- The wiki states no licence for its text, so nothing is copied from it word for word. Only facts are taken, in the tracker's own wording or as short factual entries, and the wiki is credited for them in `NOTICE.md`.

## Deeper information (2026-11-08, later the same day)

- Game sheets added to `tools/info.py`: the per-quest text files (`csv/en/quest/*/<Quest.Id>.csv`: the journal summary and steps), `MobHuntTarget`, `MobHuntOrder`, `MobHuntOrderType` and `EventItem` (hunt bills), `MonsterNoteTarget` (Hunting Log areas), `SpearfishingItem` and `SpearfishingNotebook` (spearfishing holes), `Achievement` `Type`/`Key`/`Data` (what an achievement needs), `BeastTribe`, `WKS*` (Cosmic Exploration missions), and the `QUESTBATTLE` and `INSTANCEDUNGEON` quest parameters (the quest a solo duty belongs to). Sheets not in the sparse checkout are fetched from the same pinned commit (`DM_RAW`).
- FFXIV Teamcraft (MIT, same commit): `shops.json`, `drop-sources.json`, `instance-sources.json`, `quest-sources.json`, `fate-sources.json`, `venture-sources.json`, `desynth.json`, `reduction.json`, `mogstation-sources.json`, `spearfishing-sources.json` and the Island Sanctuary files.
- `data/duty-facts.json`: how duties open where the game data is silent (ultimates, deep dungeons, treasure dungeons, criterion, chaotic, Quantum, seasonal and PvP), restated from the Console Games Wiki (read 2026-11-08). Quest names in it are looked up in the game data for the giver and place.
- `data/duty-unlocks.json`: duty unlock quests from Garland Tools instance data, matched by duty name and checked against the game's quest names (69 mismatches dropped).
- `data/field-events.json` and `data/bestiary.json`: field operation triggers and Master's Bestiary taming facts from the Console Games Wiki tables; facts only.

- `data/conditions.json` (2026-11-08): each zone's weather table (`TerritoryType.WeatherRate` → `WeatherRate`, `Weather`) and each timed entry's zone, Eorzea hours and weather, from `Adventure`, `FishingSpot`, `SpearfishingNotebook`, ff14-fish-tracker-app and Teamcraft gathering nodes.
- `data/fate-zones.json` (2026-11-08): zones for FATEs that Teamcraft does not place, from Garland Tools FATE data (garlandtools.org), or the FATE type in the game sheet.
- `data/relic-guides.json` (2026-11-08): stage-by-stage relic weapon and tool guides, written for the tracker from the Console Games Wiki relic pages (Zodiac, Anima, Eurekan, Resistance, Manderville, Phantom; Lucis, Skysteel, Resplendent, Splendorous, Cosmic). Item sources and duty unlocks inside the guides come from the game data and FFXIV Teamcraft.

## Live pages (2026-11-08)

- `tools/live.py` writes `data/live.json`. Game sheets: `IKDRoute`, `IKDRouteTable`, `IKDSpot`, `FishingSpot` (ocean fishing), `ContentsNote` (challenge log), `Achievement`, `Weather`; ff14-fish-tracker-app (bait chains, intuition, Fish Eyes, folklore); FFXIV Teamcraft (fishing holes, bite and hookset).
- `data/big-fish.json`: big fish and legendary fish names and, for the newest, their windows and bait, from the Console Games Wiki's Big Fishing tables.
- `data/field-monsters.json`: field operation monsters from the Console Games Wiki's structured enemy data (Semantic MediaWiki query) and Zadnor's area lists.
- `data/ocean-fishing.json`: the voyage offset (checked against ffxiv.oceanfishing.boats) and each route's best targets (facts from that site).
- `data/timers.json`: Xenoveritas' FFXIV timers (`tools/fetch-timers.py`).
- `data/spawn-points.json`: elite mark spawn points per hunt zone from Hunt Helper (img02/HuntHelper @ 0c07d87a1e951f9dce7a17e500d41bbc752bee94, MIT licence; `tools/fetch-spawnpoints.py`).
- `data/boss-fates.json`: the 12 world boss FATEs, their chains, coordinates and documented timers (Console Games Wiki FATE pages, read 2026-11-09; facts only).
- `data/ffxivcollect/triad-npcs.json`: FFXIV Collect's Triple Triad opponents (ids used by the online refresh).
- Read live in the browser, never stored: Universalis (market prices), PaissaDB (open plots); saved by the public site every 6 hours: the Lodestone news and topics feeds.
- `data/guides.json`: guides written for the tracker from the Console Games Wiki (Ocean Fishing, GATEs, Lord of Verminion, Chocobo Racing).
- `data/ffxivcollect/armoires.json`, `outfits.json`: FFXIV Collect snapshots (`tools/fetch-ffxivcollect.py armoires outfits`).

## Submersibles (data/submarines.json; design step S1, 2026-11-11)

`tools/submarines.py` fetches every input at a pinned commit and writes `data/submarines.json`. It stops, writing nothing, if a count differs from the design (143 sectors, 7 seas of 30, 20, 20, 20, 20, 20 and 13, 40 parts, 145 ranks, 1,829,558,717 experience from rank 1 to 145), if Teamcraft's parts differ from the game's, if the unlock table does not line up with the game's sector names, or if a source file no longer says what the tool expects. Each table in the file names its source and commit (`tables`). Ids are game row ids; nothing is typed by hand.

| Table in the file | From | Version | Licence and notice |
| --- | --- | --- | --- |
| `seas` (7), `sectors` (143) | game sheets `SubmarineMap`, `SubmarineExploration` (starting points give each sea's origin) | `xivapi/ffxiv-datamining` @ `44948e4c` (7.57h1) | game data (notice below) |
| `parts` (40), `classes` (10) | game sheets `SubmarinePart`, `Item` (names; class and slot names read from the part names); each part's item id from Teamcraft `submarine-parts.json`, whose stats must equal the game's | game @ `44948e4c`; `ffxiv-teamcraft/ffxiv-teamcraft` @ `70429e214dc952be23114df514a18223dc429449` | game data; Teamcraft: MIT, Copyright (c) 2017 Flavien Normand |
| `ranks` (145), `statNames`, `reportLines`, `items` | game sheets `SubmarineRank`, `SubmarineSpecCategory`, `SubmarineExplorationLog`, `Item` | game @ `44948e4c` | game data |
| `itemInfo`: for every item in `items`, the merchant price for one and whether it can be sold on the market board (the Earnings tab's merchant price) | game sheet `Item` (`PriceLow`, `IsUntradable`) | game @ `44948e4c` | game data |
| `loot`: possible items per sector (1,085 item and sector pairs on 141 sectors, 356 items; no quantities, odds or quality) | Teamcraft `voyage-sources.json` (entries of type 1, submarines), its sector ids checked against Teamcraft `submarine-voyages.json` and the game's names | Teamcraft @ `70429e21` | MIT, Copyright (c) 2017 Flavien Normand |
| `unlocks` (which sector reveals which, for all 143), `subSlots` (submarine slots 2 to 4), the sectors that open each next sea | Submarine Tracker `SubmarineTracker/Data/Unlocks.cs` | `Infiziert90/SubmarineTracker` @ `04c54d770f815cd416bbade1ac5b178b551a32b5` (2026-10-03; unlock data last updated 2026-05-10 for the 7.5 sectors) | MIT, Copyright (c) 2023 Infi <infiziert@protonmail.ch> |
| `formula`: travel time and range | Submarine Tracker `SubmarineTracker/SubExplPretty.cs`, `SubmarineTracker/Data/Voyage.cs` | same commit | MIT, same notice |
| `commonRoutes` (10 named routes) | Submarine Tracker `SubmarineTracker/Data/Voyage.cs` | same commit | MIT, same notice |
| `dropRates`: for all 143 sectors, how often each item came as the first item of a survey, by loot tier, with quantities by retrieval result and how often a second item came (205,249,206 records) | FFXIV Gacha Spreadsheet `website/static/data/Submarines.json` | `Infiziert90/FFXIVGachaSpreadsheet` @ `c7bd22537e3fdd1fce05d9d84250ba475a7bb6e5` (2026-11-17) | MIT, Copyright (c) 2023 Infi <infiziert@protonmail.ch> |
| `breakpoints`: per sector, the surveillance needed for loot tiers 2 and 3, the retrieval for normal and optimal quantities, the favor for a possible second item | the same project, `website/src/lib/submarines/sector.ts`; must equal Submarine Tracker `SubmarineTracker/Data/Sectors.cs` @ `04c54d77` | same commit | MIT, same notice |

**Game data notice:** Game data (c) SQUARE ENIX CO., LTD. FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd.

**Community data notice (Teamcraft, Submarine Tracker and the FFXIV Gacha Spreadsheet, MIT licence):** "Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND." The three notices are also carried inside `data/submarines.json` (`sources`).

**Drop rates and thresholds (2026-11-18).** The records were uploaded by players who use the source's plugin; this app reads only the published summary, as text, and runs nothing from it. The app still never reads or automates the game. The summary holds the first item of each survey only: what the second item is, is not recorded. Kept: per pool the counts by surveillance band and retrieval result and, per item, rolls, summed quantity and the quantity range per retrieval result; per sector the record count and how often a second item came. Dropped: the source's own names, ranks and unlock notes (checked against the game's), and its lowest-stat fields, which rest on single records. Submarine Tracker's copy of the thresholds says they were calculated from a community spreadsheet; the copy used here is the one published under the MIT licence. They are used for loot estimates only: experience still shows the game's base value. What the app works out from these tables is an estimate, labelled as one, with the number of records behind it. The tool stops, writing nothing, if the file does not have 143 sectors and 205,249,206 records, if a pool's item rolls, bands or retrieval results do not add up to its records, if a name, rank or star count differs from the game's, if a drop item is missing from the game's `Item` sheet, or if the two threshold tables differ.

**How the unlock source was chosen (design 5.4).** Teamcraft's source tree at the pinned commit was searched first: it has no unlock order and no time formula (its voyage tracker reads return times and unlocked sectors from the game's own messages). Submarine Tracker, an open-source project under the MIT licence, holds both, kept up to date to the 7.5 sectors. No second licensed, machine-readable source was found; the others are spreadsheets, wiki pages and websites, which are not used (no scraping). So the unlock table rests on one community source. The tool checks that it covers every sector once and that, for the 141 sectors another sector reveals, both the sector's name and the revealing sector's name in it match the game's (the other two, A and B of the first sea, are open from the start). The source is a plugin for a third-party modding framework; only its published table and formula are read here, as text, and nothing from it is run. The app still never reads the game or automates it, and the owner's own ticks on the return sheet remain what counts for each Free Company. The source adds two facts the advisor will need: discovery is not certain on every visit, and a new submarine slot only shows once the previous slot holds a submarine.

**The formula, in words** (label: **calculated, not yet confirmed**, until the owner's game times agree; design risk R1):
- A route starts at its sea's starting point and visits 1 to 5 sectors of that sea in the order chosen.
- Leg length: the straight-line distance between two points from their X, Y and Z positions.
- Range used: for each leg, round down (leg length × 0.035) and add the destination's survey distance; add up the legs. Reachable if the total is no more than the build's range. There is no leg back.
- Travel seconds of a leg: round down (leg length × 3990 ÷ (speed × 100) × 60). Survey seconds of a sector: round down (survey minutes × 7000 ÷ (speed × 100) × 60). Speed is the build's (four parts plus the rank's bonus), at least 1.
- Voyage seconds: all travel and survey seconds plus a fixed 43,200 seconds (12 hours). Return time = send time + voyage seconds.
- Five voyages worked out step by step: `tests/fixtures/submarine-voyages.json`, checked by `node --test tests/submarines.test.js`. As a plausibility check only, the "OJ" route at the top rank with a fast build gives 19 h 21 min, against the owner's "about every 19 hours".

**Experience.** The game table gives each sector's base experience. Submarine Tracker (`SubmarineTracker/Data/Sectors.cs`) adds 25%, 50%, 75% or 100% per sector when its survey goes well, judged against surveillance, retrieval and favor thresholds that it took from a community spreadsheet with no stated licence. Those thresholds are not used for experience: a copy under the MIT licence is pinned now (see "Drop rates and thresholds" above) and is used for loot estimates only, so experience still shows the game's base value and no stat effect on it (design question Q3 stays at its default). By that source, base experience is the least a voyage gives, so the design's assumption A4 ("no hidden bonus") holds as a floor, and a rank worked out from it is a floor; the return sheet's rank check shows the real figure.

**Loot details.** Teamcraft's list comes from its users' reports, so the newest sectors list few items: sectors L and M of the Northern Empty (148, 149) have none. Dropped, as Teamcraft's own build does: 18 entries without a sector, 257 repeats, and 1 entry pointing at the Northern Empty's starting point (row 136), which is not a sector. This corrects design section 5.1: the list covers **141** of the 143 sectors, not 142 (the 142nd id was that starting point).

**Names.** Sector names are the game's; the italic markers around three ship names (*Discovery I*, *Headway*, *Windwalker*) are removed. The source names the route "Fight Club - OJ" as Deep-sea Site O, then J; which route the owner means by "OJ" is still the owner's to confirm (design Q1).

Regenerate (needs raw.githubusercontent.com):

```
python3 -I tools/submarines.py --cache /tmp/submarines-cache
node --test tests/submarines.test.js
```

## Refresh checklist after a game patch (R6 of `docs/lists-redteam.md`, 2026-11-23)

A patch changes the game sheets, so every data file built from them is rebuilt against one new commit of `xivapi/ffxiv-datamining`. Do the steps in this order, on a branch, and stop at the first failure: a stop rule means the new data broke an assumption, and nothing is written.

1. **Choose the commit.** Take the new game commit and its version name (for example `7.6`). Take a Teamcraft commit that has the same patch's data (check that `nodes.json`, `shops.json` and `submarine-parts.json` changed or still hold). Check both out into your own scratch folders, not into the repository.
2. **Tracker** (from `tracker/`): `python3 -I tools/extract.py <datamining checkout> <teamcraft json dir>`, then `tools/add-checklist.py <workbook> --dm <checkout>` and `tools/links.py <checkout>` as in "Regenerate" above, then `tools/organize.py`, `tools/info.py` and the other tools of that section that read the sheets. Move `DM_COMMIT` (and `TC_COMMIT`, which for the Tracker covers the patch-label files only) in `tools/extract.py`, and the pin text in this file.
3. **Submersibles**: `python3 -I tools/submarines.py`. Move `DM_COMMIT` and `TC_COMMIT` in `tools/submarines.py`. It stops if a count differs from the design (143 sectors, 40 parts, 145 ranks).
4. **Cosmic Exploration** (from `crafting/`): `python3 tools/extract.py <datamining checkout> --commit <sha>` writes `data/cosmic-db.json`, which carries the commit and which the Atelier reads.
5. **Atelier** (from `crafting/atelier/`): `python3 tools/prepare-data.py <datamining checkout> <raphael-rs checkout>`; change the pin text `xivapi/ffxiv-datamining <sha>` inside that tool, which it writes into `data/atelier-data.json`.
6. **Lists data** (from `tracker/`, last, because it is the strictest): set `DM_COMMIT`, `TC_COMMIT` and `GAME_VERSION` in `tools/lists-data.py`, **leave the previous `data/lists.json` in place**, and run `python3 -I tools/lists-data.py --cache <scratch dir>`. The tool reads the old file first and adds an entry to `changes` (from the old stamp to the new): every recipe that differs, with its old row, and every recipe that went away, with its old row. A list made on the old data compares its own stamp against these entries to tell the player what changed; run the tool on a fresh copy of the repository and the old rows are lost. Set `EXPECT_RECIPES` (and `EXPECT_SUBMARINE`, `EXPECT_AIRSHIP` if the workshop changed) to the new counts only after reading the stop (see below) and deciding the change is real.
7. **Pins together.** The commits of steps 2 to 6 must be the same game commit: `tests/lists-patch.test.js` (R6-1) reads each tool and each data file and fails with a plain message naming the two pins that differ ("Game-data pins differ: the Tracker data tool ... is at ... but the Atelier data tool ... is at ..."). Teamcraft pins are compared between the Lists and Submersibles data (they must match); the Tracker's own Teamcraft commit is compared only between its tool and its file.
8. **Rebuild and test** (from the repository root): `npm run build` (twice: the second run must change nothing), `npm run test:unit`, `npm run test:browser`, `npm run check`. Commit the data, the rebuilt copies and the changed text of this file.

**What the stops say.** Every tool stops with its own name and the reason, and writes nothing (the old file stays). `lists-data.py: STOP - N recipes, the first run recorded M`: the recipe count changed; a patch adds recipes, so read the list of new ones before moving `EXPECT_RECIPES`. `... node N: the sheets give (x, y), Teamcraft (x, y): not the game's map scale`, `... the gathering type differs`, `... no name row`: a node in Teamcraft does not match the sheets, usually because the two commits are of different patches; use a Teamcraft commit made after the game's. `... company craft N ... has no part` or `N submarine parts, expected 40`: the workshop sheets changed shape. `lists cross-check: recipe N differs` or `the Atelier has recipes the sheets lack` (printed by the build): the Atelier's data and the Lists data are of different game commits; rebuild the Atelier data (step 5) against the same commit. `lists log: recipe N ... is not in the recipes`: the Tracker's crafting-log pages name a recipe the Lists data lacks; rebuild the Tracker (step 2) first. `lists books: no single Tracker entry ...`: a master book was added or renamed; the Tracker's "Master Crafting Books" list needs the entry. `lists/data.js is over the 1.5 MB budget`: the data grew; decide what to trim, do not raise the budget unread. A unit test that fails with a pin message is not a data fault: a pin was moved in one place only.

## Lists: recipes, merchants and gathering (work item W1 of `docs/lists-spec.md`, 2026-11-22)

`data/lists.json` is written by `tools/lists-data.py` (`python3 -I tools/lists-data.py --cache DIR`); it is read by the Lists module's engine and built into `site/lists/data.js`. Game version 7.57h1; stamp `7.57h1 44948e4c 70429e21`.

| Table | Source (pinned) | Licence |
| --- | --- | --- |
| `items`, `recipes` | `xivapi/ffxiv-datamining` at `44948e4cda5846eab0baa9872122a888fcc4f1b1`, English CSVs `Item`, `Recipe`, `RecipeLevelTable`, `PlaceName` | Game data (c) SQUARE ENIX CO., LTD. |
| `trades`, `npcs` | `ffxiv-teamcraft/ffxiv-teamcraft` at `70429e214dc952be23114df514a18223dc429449`: `shops.json`, `npcs.json` | MIT |
| `gatherLegacy` | the same Teamcraft commit: `nodes.json`, `gathering-items.json`, `fishing-sources.json`, `fishing-spots.json` | MIT |
| `gather`, `nodeNames`, `aetherytes` (B2, 2026-11-23) | the nodes and fishing files above, Teamcraft `aetherytes.json`; game sheets (same commit as above) `GatheringPointName`, `GatheringType`, `GatheringPoint`, `GatheringPointBase`, `GatheringSubCategory`, `ExportedGatheringPoint`, `SpearfishingNotebook`, `FishingSpot`, `Map` | MIT; game data (c) SQUARE ENIX CO., LTD. |
| `crafters` | the `recipes` table (every recipe of an item, by level then id) | as `recipes` |
| `data/classjob/*.png` | the game's 8 crafter and 3 gatherer icons, `apps/client/src/assets/icons/classjob/<job>.png` of the Teamcraft commit above, fetched by the tool, each a PNG of at most 16 kB | Square Enix materials (c) SQUARE ENIX CO., LTD.; hosted in Teamcraft's MIT repository |

Notes. A recipe's ingredient slot holds 0 or -1 when empty. An item's `merchantSells` is the Item sheet's `PriceMid` (a gil price, 0 = none). Gather windows follow the rule of `tools/info.py`: timed only when every node of the item is timed; fish carry no window because the pinned files hold none. A gil merchant is an offer whose only currency is gil (currency 1); every other offer is a trade. The pinned `shops.json` marks no allied-society shop, so their token offers count as trades. Every distinct offer is kept; offers equal in what they give, every currency and amount, quality and rank are merged, keeping the lowest seller id. `changes` keeps the old rows of recipes that differ from the previous file. The `log` table is added later by the build.

**Spots without a map position (R6).** An item that has nodes with a map position and nodes without one keeps both: the placed spots first, best first, then the unplaced ones (job, level, the zone Teamcraft names when it names one, no position or aetheryte, the node's window and folklore as Teamcraft gives them, not checked against the sheets), one per distinct row. The page shows them as "No map position in the game data". An item with no placed node keeps the single entry described below.

**Gathering spots (B2).** `gather` is `{item: [[job, nameRow, level, zone, x, y, aetheryte, hours, minutes, folklore, hidden]...]}`, every spot best first (lowest level, then the shortest distance to its aetheryte, then the lowest node id); a fishing spot (not spearfishing) has a twelfth entry, its name, and name row 0. `gatherLegacy` is the former shape (`[job, level, zone, hours, minutes]`), kept only so the page of W6 keeps reading it; the build puts it back under `gather` in the page's data and offers the new table as `spots` until B3 and B5 move the page. How each part was derived (and proved on the pinned data; the tool stops when it does not hold):

- **Node id.** Teamcraft's node id is a `GatheringPointBase` id: all 1,425 ids are in the sheet; every node that has a position (1,065) has `GatheringPoint` rows and an `ExportedGatheringPoint` row, and the three agree on the gathering type (Teamcraft `type` 0 to 3 = `GatheringType` Mining, Quarrying, Logging, Harvesting; 5 = spearfishing).
- **Node name.** `ExportedGatheringPoint.GatheringPointType` equals the `Type` of the node's `GatheringPoint` rows. Types 1 and 3 are ordinary nodes (name rows 1 to 4, by gathering type), 2 unspoiled (rows 5 to 8), 4 ephemeral (rows 9 to 12) and 5 legendary (rows 13 to 16; the only ones with a folklore book). Spearfishing: `SpearfishingNotebook.IsShadowNode` is true exactly for point type 6 (row 22, "swimming shadows"), false for type 1 (row 21, "teeming waters"); this pairing is read from the sheet's own flag, not proved by a second source. Point types 7 and 8 (the Diadem) have no proved name row and no gathered item of the file, so no spot uses them; the tool stops if one ever does. Names are the sheet's `Singular`, capitalised word by word.
- **Position.** Teamcraft's `x` and `y` are already the game's map coordinates: for all 1,065 positioned nodes, the sheet's own world X and Y (`ExportedGatheringPoint`) through the map's `SizeFactor` and offsets (the conversion of `tools/info.py`) give Teamcraft's values to within 0.01 (the tool allows 0.06 and stops beyond). The file keeps the sheet-derived value to one decimal. 409 nodes sit on map 0 and zone 0, the sheet's placeholder rows (territory 1): they have no real place, so they count as having no position. Fishing spots: Teamcraft's `coords` agree with `FishingSpot` X and Z (map pixels, `41 / (SizeFactor / 100) * px / 2048 + 1`) for all 328 spots the sheet places (to within 0.1); the 7 Diadem spots have no sheet position and keep Teamcraft's.
- **Zone.** The name of the node's map (`Map.PlaceName`), the zone the game's map shows; for a node without a map position, the gathering area Teamcraft names, when it names one. A fishing spot: the region of its `placeId`; its own name is `zoneId`'s place name.
- **Aetheryte.** The nearest main aetheryte (Teamcraft `aetherytes.json`, type 0; names from `PlaceName` row `nameid`) on the same map, by distance in map coordinates; 0 when the map has none.
- **Window.** Teamcraft's `spawns` and `duration` (default 120 minutes when timed), as before. The start hours equal the game's `GatheringRarePopTimeTable` for every timed node that has a rare-pop table (195 `GatheringPoint` rows; ephemeral nodes have none); the stay differs in unit from the sheet's `Duration` (120 against 160, 180 against 300) and is NOT proved here.
- **Folklore.** The node's `GatheringPoint.GatheringSubCategory` names a `FolkloreBook` whose `Item` equals Teamcraft's `folklore`; the file keeps that item's name. **Hidden** is 1 when the item is one of the node's hidden items.

**Market flag, currencies, sellers, books and workshop projects (R1 of `docs/lists-redteam.md`, 2026-11-23).** Same pins; extra game sheets `SecretRecipeBook`, `CompanyCraftSequence`, `CompanyCraftPart`, `CompanyCraftProcess`, `CompanyCraftSupplyItem`.

- **Item flags changed.** Bit 1 is now "can be sold on the market board": the Item sheet's `ItemSearchCategory` above 0 (the engine's market way and the page's price lookups read bit 1, so no engine change was needed). Bit 16 is new: tradable (not `IsUntradable`), the former meaning of bit 1. Of the 137 items that are a non-gil price of a kept trade, 33 are tradable but not on the board (the 33 the old rule wrongly offered on the market); 26 are on the board (Fire Shard, potions, ether, two materials and the 20 Shark- to Syldra-class parts, which are also trade prices). The data's one tradable-but-not-market class (about 183 items, Skybuilders' crafts among them) is not a currency unless a kept trade asks for it.
- **`currencies`**: the non-gil prices of kept trades that are not on the board: 111 items (tomestones, scrips, seals, tokens, MGP, untradable tokens).
- **`sellers`** `{item: [[npc, gilPerUnit]...]}`: every merchant who sells the item for gil only, normal quality, no Grand Company rank, whole price per unit, cheapest first (then lowest npc id); every npc of a shop counts (the planned offer in `trades` still keeps the lowest id). Sellers are added to `npcs` (148 to 491 named). Gil offers of a seller that Teamcraft does not name (npc 0, 6 offers) are not listed. Reputation ranks other than the Grand Company's are not in the data.
- **`books`** `{recipe: bookItem}` and `bookNames` `{bookItem: name}`: `Recipe.SecretRecipeBook` through `SecretRecipeBook` (`Name`, `Item`); recipe rows are unchanged (flag 32 stays).
- **`projects`** `{resultItem: [kind, [part [phase [[item, amountPerSet, sets]...]...]...]]}`: `CompanyCraftSequence` rows of `Category` 7 (kind 0, submarine) and 5 (kind 1, airship); each `CompanyCraftPart` gives its three `CompanyCraftProcess` rows in order (the phases), each process up to 12 `SupplyItem` rows (through `CompanyCraftSupplyItem.Item`) with `SetQuantity` per set and `SetsRequired` sets. Phases have no names in the sheets. Result and supply items are closed into the file with their recipes, offers and spots (+88 items). Stop rules added: a master book the sheet does not name; a part with no part row, no phase, a phase with no supply item, or a supply item, amount or set count that cannot be read; 40 submarine parts and 28 airship parts expected (`EXPECT_SUBMARINE`, `EXPECT_AIRSHIP`).

Second run (R1): 13,892 recipes, 13,936 items, 4,041 gil offers, 1,065 other offers; 11,678 market items, 111 currencies, 3,583 items with several gil sellers (35,044 seller entries), 3,459 master-book recipes with 110 books, 40 submarine and 28 airship parts (204 phases, 822 supply entries); plain 2,788,873 bytes.

First run: 13,892 recipes, 13,848 items, 4,041 gil offers, 1,045 other offers, 785 gathered or fished items, 148 named sellers; plain 1,758,168 bytes.

**Stop rules** (nothing is written): a fetch fails; a node with a position that is no `GatheringPoint` row, whose gathering or point type differs between the sheets, whose position the sheets do not give in the game's map scale, or whose name row cannot be derived; a folklore book that differs from the sheet's; an icon missing, not a PNG or over 16 kB; a recipe names an item missing from `Item`; a yield or an amount is below 1; a trade gives fewer than 1 or has no currency; the recipes form a loop; the stamp is over 40 characters; the recipe count differs from `EXPECT_RECIPES` (13,892 on the first run, set in the tool).

Regenerate (needs raw.githubusercontent.com):

```
python3 -I tools/lists-data.py --cache /tmp/lists-data-cache
node tests/lists-data.test.js
```
