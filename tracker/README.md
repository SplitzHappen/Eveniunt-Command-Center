# Eveniunt Tracker

A completion tracker for Final Fantasy XIV, part of the Eveniunt Network Command Center. It tracks up to **eight characters side by side** across everything the game has to offer: about 41,500 entries in 98 lists.

- **Open it:** https://splitzhappen.github.io/Eveniunt-Command-Center/tracker/ (click **Install app** in the header to install it; it works offline after the first visit).
- **Single file:** `dist/eveniunt-tracker.html` works offline from your computer. Cloud sync needs the hosted app.

## Using it

1. **First start:** choose how many characters (1 to 8) and name them. Change both later in **Settings → Characters**.
2. **The menu** follows the game's main menu: **Character, Duty, Logs, Travel, Social**, then folders (Achievements, Collections, Quests, Duty Finder, Crafting, Gathering…) and lists. Each line shows how complete it is across your characters.
3. **A list** is a ledger: one row per entry, one column per character. Columns are numbered 1–8 on narrow screens, matching the numbers in the tallies above the list.
   - **Tick** a box to mark it done for that character.
   - **Group header:** the counts under each character tick or clear the whole group for that character.
   - **✕ (left of each entry):** entries that are time-limited only, no longer obtainable, or of unknown availability are marked ✕ and left out of the totals. Click ✕ on any row to count it anyway, or to mark something unobtainable and take it out of the count. Your choice always wins over the built-in mark. Settings → Counting turns whole kinds of ✕ on or off.
   - **Does not apply:** switch the toolbar from **Tick** to **Does not apply**, then click a character's box to leave that entry out of that character's total only (for example another city's starting quests).
   - **Classes and Jobs:** type each character's level; a job counts as complete at its level cap.
   - **Find, Show, Jump:** filter the list, show only what is still missing (or done, or not counted), and jump to a group. The search box in the header searches every list.
4. **Appearance:** Settings → Appearance has the same 20 FFXIV themes and settings as the Eveniunt Atelier (Mode, Theme, Accent, Background, Foreground, Advanced).

## Bringing your progress

- **From the FFXIV Completionist desktop app:** Settings → Import and backup → choose the character files it saved (JSON), pick the column for each, Import. Ticks, its “X” marks (does not apply) and job levels are imported. Anything that cannot be placed exactly (for example Squadron, which no list covers) is listed and can be downloaded, so you can do it by hand.
- **Backup file and transfer code:** Settings → Import and backup. A transfer code is text you paste on another device.
- **Online refresh (optional):** add each character's Lodestone number in Settings → Characters. When the tracker opens with internet, it reads public data from FFXIV Collect (mounts, minions, orchestrion rolls, emotes, hairstyles, barding, fashion accessories, facewear, Blue Magic, achievements), ticks what you gained, and asks you whenever it disagrees with your own ticks. Without internet it simply waits.
- **Cloud sync (optional):** Settings → Cloud sync → sign in with Google. A private copy lives in a hidden app folder in your own Google Drive; changes from your devices merge, and real clashes ask you which side is right.

## Data

Built from pinned sources and regenerated, never typed by hand: see `data/SOURCES.md`. Every list is grouped the way the game groups it (expansion and patch, journal sections, zones, log pages, categories).

## Build and test

```
python3 -I tools/extract.py <ffxiv-datamining checkout> <teamcraft json dir>     # data/tracker-data.json
python3 -I tools/add-checklist.py <FFXIV Checklist workbook.xlsx>                 # adds the checklist lists, data/desktop-map.json
python3 -I tools/fetch-ffxivcollect.py                                            # optional: refresh the FFXIV Collect snapshot
FONT_DIR=<node_modules/@fontsource> node tools/build.js                           # dist/eveniunt-tracker.html
FONT_DIR=<node_modules/@fontsource> node tools/make-icons.js                      # icons only
node tools/build-site.js                                                          # site/ (installable app, scope /tracker/)
node --test tests/core.test.js                                                    # core logic
node --test tests/ui.test.js                                                      # browser tests (Playwright + Chromium)
```

The Appearance module (themes and settings) is taken from the Eveniunt Atelier's source at build time, so both apps share one visual system.

## Credits

Game data © SQUARE ENIX CO., LTD. FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd. A free, non-commercial fan project, not affiliated with Square Enix. It never reads game memory or automates the game. Third-party notices: `NOTICE.md`.
