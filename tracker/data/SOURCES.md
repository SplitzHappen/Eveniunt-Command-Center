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

- `data/fate-zones.json` (2026-11-08): zones for FATEs that Teamcraft does not place, from Garland Tools FATE data (garlandtools.org), or the FATE type in the game sheet.
- `data/relic-guides.json` (2026-11-08): stage-by-stage relic weapon and tool guides, written for the tracker from the Console Games Wiki relic pages (Zodiac, Anima, Eurekan, Resistance, Manderville, Phantom; Lucis, Skysteel, Resplendent, Splendorous, Cosmic). Item sources and duty unlocks inside the guides come from the game data and FFXIV Teamcraft.
