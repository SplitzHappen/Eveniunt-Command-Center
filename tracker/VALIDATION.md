# Validation — Eveniunt Tracker

Date: 2026-11-08. Data: `xivapi/ffxiv-datamining` @ `44948e4c` (7.57h1), FFXIV Teamcraft @ `c1ede0a0`, FFXIV Collect snapshot 2026-11-07, FFXIV 100% Completion Checklist 7.45 (see `data/SOURCES.md`).

## Automated tests

| Suite | Result | What it checks |
| --- | --- | --- |
| `node --test tests/core.test.js` | 44 / 44 pass | characters 1–8; totals; the ✕ switch both ways; ticks on uncounted entries kept but not added; group ticking; per-character “does not apply”; level values (cap ticks, desynthesis recorded only); backup file and transfer code round trips; three-way merge and conflicts; FFXIV Collect refresh (first run asks, later gains apply, clashes ask, private profiles, no connection); Google Drive sync against a simulated Drive; desktop-app import (game ids, positions, X marks, levels, master books never read as recipe ids); **red-team cases**: crafted backups (prototype keys, markup in names, cities, levels, keys), huge or malformed transfer codes, levels of a removed character, Lodestone addresses, merged-entry ticks moving over, and cloud sync with a damaged copy, a large removal, a simultaneous write and odd ids in the cloud file; **links**: built for this data and refused for other data, the main story from "The Ultimate Weapon" down to the character's own city and company quests only, achievement and title both ways, quest and aether current both ways, Freebird only after the last current, the gold-rating switch, level achievements, never ticking what does not apply; achievement tiers, Dawntrail relic stages, Grand Company rank and officer quest, a checked desktop-app link (Firebird quest and the lanners) |
| `node --test tests/ui.test.js` | 22 / 22 pass | the built file from `file://` with every network request blocked: first run with 8 characters; lists open with every group closed (Open all, Close all, find opens matches); a tick follows its links with an Undo message and explains them in the details, the switch turns links off, and Settings fills in what existing ticks prove (preview and Undo); click marks done, right-click and press-and-hold mark “does not apply”, a second click clears either; ticking, ✕ both ways and “does not apply” update the tallies and survive a reload; group ticks; level fields; every list renders and every list over 60 entries is grouped; search; the menu is Character, Duty, Logs, Travel, Social; desktop-app import through the interface; transfer code between two browsers; phone width 390 px with no sideways scroll; **all 20 themes in light and dark** (text contrast ≥ 7, accent ≥ 3, dropdowns ≥ 7, themes listed alphabetically, wordmark coloured by the theme); data counts; the **hosted site over HTTP** (manifest, service worker, offline reload keeps the characters, no cross-origin isolation so Google sign-in can open); **red-team cases**: a crafted backup loaded through the page runs no script, the first-run window cannot be dismissed, unreadable saved data is offered for download and kept, and two windows of the tracker never overwrite each other |

## Starting city and Grand Company

138 quests can only be reached from one starting city (Limsa Lominsa 46, Gridania 42, Ul'dah 50; with 3 achievements and 3 levequests, 144 city entries), found by following the game's quest prerequisites from each city's first quest; per-class variants of the same opening quest are one entry (5 merges). Checked against the owner's saves: the X marks the desktop app sets from each character's starting class fall exactly on the other two cities' quests. 30 Grand Company quests (game field, company-named variants, officer quests), the Grand Company hunting logs and ranks follow the character's company. Tests: core (`notApplicable`, totals, inference from X marks) and browser (setup with classes, greyed boxes, explanation on click).

## Data counts

101 lists, 43,716 entries (62 from the game sheets with community labels, 39 from the checklist workbook, of which 325 entries were added after the workbook's 7.45 edition from the game data; see `data/SOURCES.md`). The browser data test pins the per-list count of those additions and checks that no list repeats an id. Custom Deliveries (12 clients, complete at rank 5), Cosmic Exploration missions (1,699 in 44 planet-and-class groups, planets in the game's order) and records (244) are pinned by the same test.

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

About 17,800 links: from the game data, plus 802 checked links from the FFXIV Completionist desktop app (`data/SOURCES.md`). Checked against the owner's seven saved characters: filling in what their ticks prove adds 89 ticks to the first and 111 to the second (90 and 112 before the red-team fixes removed 19 desktop links into the wrong version of a class quest and the tier links into Legacy achievements) (out of 12,885 and 10,506), none to the others; the first 169 (game data) were reviewed by hand, and the further ones from the desktop links and the new families were traced one by one (base relic tools from their class quests, allied society ranks and their quests, achievements and their items, mount speed increases) and is consistent with the game (quests done without their aether current, achievements without their reward or title, later main-story quests ticked with earlier ones missing, a second mount speed increase without the first, level achievements from the job levels). All 251 links from an item back to its only source were reviewed. Ticking "The Ultimate Weapon" for a character who started in Gridania and joined the Twin Adder ticks 170 entries, including all 22 Gridania main-story opening quests and only Twin Adder company quests. A full fill-in takes under 60 ms per character.

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
