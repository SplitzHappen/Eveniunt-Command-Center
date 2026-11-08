# Data sources (pinned)

- Game data: `xivapi/ffxiv-datamining` at `44948e4cda5846eab0baa9872122a888fcc4f1b1` (game version 7.57h1, 2026-10-20), English CSVs. Every entry, name and in-game grouping comes from these sheets. Game data (c) SQUARE ENIX CO., LTD.
- Patch labels (community data, labelled as such in the app): `ffxiv-teamcraft/ffxiv-teamcraft` at `c1ede0a03c0072c830e0a1b3b8e7a20ea539e3b3` (MIT licence), files `item-patch.json`, `patch-content.json`, `patch-names.json`, and `gathering-log-pages.json` (places 53 gathering-log items whose gathering spot is not in the game sheets), and `fates.json` (each FATE's zone; the game's Fate sheet stores only a layout id).
- "How to get it" and availability (community data, labelled in the app): FFXIV Collect public API snapshot of 2026-11-07, saved in `data/ffxivcollect/` by `tools/fetch-ffxivcollect.py` (the project is MIT-licensed). Gives the sources of every mount, minion, orchestrion roll, emote, hairstyle, barding, fashion accessory, facewear and Blue Magic spell, and, through the API's own filter, which items can only be obtained from time-limited sources. Time-limited achievement ids and categories come from FFXIV Collect's `config/achievements.yml` at commit `71689864` (`data/ffxivcollect/achievements-time-limited.json`). FFXIV Collect totals are also the independent count check.

- Extra lists and the desktop-app import map (owner decision 2026-11-07, option 3, credited): the community "FFXIV 100% Completion Checklist" workbook 7.45 by its volunteer team (the same team as the FFXIV Completionist desktop app). `tools/add-checklist.py <workbook.xlsx>` runs after `tools/extract.py`, appends 38 lists (marked `src: "checklist"`) and writes `data/desktop-map.json`. Rows the workbook pre-marks with X carry the "no longer obtainable" mark. The workbook file itself is not committed.

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

- `x: "lim"`: only obtainable from time-limited sources (events, seasonal content, ended campaigns, PvP seasons); it may return. 514 entries.
- `x: "gone"`: no longer obtainable: Legacy achievements (261) and 13 mounts that exist in the game files but are quest or duty vehicles, never collectable.
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
