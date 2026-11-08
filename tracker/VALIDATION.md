# Validation — Eveniunt Tracker

Date: 2026-11-08. Data: `xivapi/ffxiv-datamining` @ `44948e4c` (7.57h1), FFXIV Teamcraft @ `c1ede0a0`, FFXIV Collect snapshot 2026-11-07, FFXIV 100% Completion Checklist 7.45 (see `data/SOURCES.md`).

## Automated tests

| Suite | Result | What it checks |
| --- | --- | --- |
| `node --test tests/core.test.js` | 16 / 16 pass | characters 1–8; totals; the ✕ switch both ways; ticks on uncounted entries kept but not added; group ticking; per-character “does not apply”; level values (cap ticks, desynthesis recorded only); backup file and transfer code round trips; three-way merge and conflicts; FFXIV Collect refresh (first run asks, later gains apply, clashes ask, private profiles, no connection); Google Drive sync against a simulated Drive; desktop-app import (game ids, positions, X marks, levels, master books never read as recipe ids) |
| `node --test tests/ui.test.js` | 11 / 11 pass | the built file from `file://` with every network request blocked: first run with 8 characters; ticking, ✕ both ways and “does not apply” update the tallies and survive a reload; group ticks; level fields; every list renders and every list over 60 entries is grouped; search; the menu is Character, Duty, Logs, Travel, Social; desktop-app import through the interface; transfer code between two browsers; phone width 390 px with no sideways scroll; **all 20 themes in light and dark** (text contrast ≥ 7, accent ≥ 3, dropdowns ≥ 7, themes listed alphabetically, wordmark coloured by the theme); data counts; the **hosted site over HTTP** (manifest, service worker, offline reload keeps the characters, no cross-origin isolation so Google sign-in can open) |

## Data counts

98 lists, 41,505 entries (59 from the game sheets with community labels, 39 from the checklist workbook).

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
| Emotes (unlockable) | 205 | 201 |
| Hairstyles | 53 | 54 (one style not sold as an item) |

Availability marks: 514 time-limited only, 873 no longer obtainable (261 Legacy achievements, 13 quest-vehicle mounts, rows the checklist pre-excludes), 463 availability unknown (FATEs not placed in any zone). Every entry has a manual switch.

## Desktop-app import (owner's seven saves, app version 1.0.5)

23,664 of 23,775 ticks placed exactly (99.53%), 615 “does not apply” marks and 64 job/desynthesis levels imported. Not placed: 111 ticks (68 Squadron, which no list covers; the rest aether-current, aetherytes, hairstyles, the Yo-kai/Portable Archive and Hunt entries affected by the desktop app's older 7.38 workbook) and Trust/Squadron level values; all are listed by the import report.

## Performance (headless Chromium, desktop)

Longest lists (about 2,000–2,250 rows × 8 characters) open in about 0.3 s; a tick updates in about 0.15 s. Single file 4.5 MB.

## Known limits

- The online refresh and Google sign-in can only be tried live from the hosted app; FFXIV Collect's API was checked live from the build session (browser reads allowed), Google sign-in was not reachable there.
- Time-limited marks come from community data: “time-limited” does not distinguish an event that never returns from one that recurs, so those entries say “Time-limited only” rather than “gone”.
- In-game icons are not included (not in the reachable data); the design uses type and the theme colours instead.
