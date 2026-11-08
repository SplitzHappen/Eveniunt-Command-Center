# Eveniunt Tracker

A completion tracker for Final Fantasy XIV, part of the Eveniunt Network Command Center. It tracks up to **eight characters side by side** across everything the game has to offer: about 43,800 entries in 101 lists, up to date with patch 7.57, including Custom Deliveries and Cosmic Exploration (missions by planet and class, and records).

- **Open it:** https://splitzhappen.github.io/Eveniunt-Command-Center/tracker/ (click **Install app** in the header to install it; it works offline after the first visit).
- **Single file:** `dist/eveniunt-tracker.html` works offline from your computer. Cloud sync needs the hosted app.

## Using it

1. **First start:** choose how many characters (1 to 8), name them, and pick each one's **starting class** (it decides the starting city) and, if they have joined one, their **Grand Company**. The other two cities' opening quests and the other companies' quests are then greyed out for that character and left out of its totals. Change all of this later in **Settings → Characters**.
2. **The menu** follows the game's main menu: **Character, Duty, Logs, Travel, Social**, then folders (Achievements, Collections, Quests, Duty Finder, Crafting, Gathering…) and lists. Each line shows how complete it is across your characters.
3. **A list** has one row per entry and one column per character; each column header shows the character's progress in that list (columns are numbered on narrow screens).
   - **Tick** a box to mark it done for that character. A dash means the entry does not apply to that character (another starting city or Grand Company, or marked by you).
   - **Group header:** the count under each character ticks or clears the whole group for that character.
   - **Click an entry's name** to see how to get it and its details, and to switch whether it counts: entries that are time-limited only, no longer obtainable or of unknown availability are not counted and carry a small label; **Count it anyway** or **Mark unobtainable** overrides the default either way. Settings → Counting turns whole kinds on or off. **Show not counted** hides or shows them.
   - **Mark “does not apply”** (toolbar): then clicking a character's box leaves that entry out of that character's total only.
   - **Classes and Jobs:** type each character's level; a job counts as complete at its level cap.
   - **Find, All / Missing / Done:** filter the list. The search box in the header searches every list.
4. **Appearance:** Settings → Appearance has the same 20 FFXIV themes and settings as the Eveniunt Atelier (Mode, Theme, Accent, Background, Foreground, Advanced).

## Bringing your progress

- **From the FFXIV Completionist desktop app:** Settings → Import and backup → choose the character files it saved (JSON), pick the column for each, Import. Ticks, its “X” marks (does not apply) and job levels are imported, and the starting city and Grand Company are worked out from the save. Anything that cannot be placed exactly (for example Squadron, which no list covers) is listed and can be downloaded, so you can do it by hand.
- **Backup file and transfer code:** Settings → Import and backup. A transfer code is text you paste on another device.
- **Online refresh (optional):** add each character's Lodestone number in Settings → Characters. When the tracker opens with internet, it reads public data from FFXIV Collect (mounts, minions, orchestrion rolls, emotes, hairstyles, barding, fashion accessories, facewear, Blue Magic, achievements), ticks what you gained, and asks you whenever it disagrees with your own ticks. Without internet it simply waits.
- **Cloud sync (optional):** Settings → Cloud sync → sign in with Google. A private copy lives in a hidden app folder in your own Google Drive; changes from your devices merge, and real clashes ask you which side is right.

## Data

Built from pinned sources and regenerated, never typed by hand: see `data/SOURCES.md`. Every list is grouped the way the game groups it (expansion and patch, journal sections, zones, log pages, categories).

## Build and test

```
python3 -I tools/extract.py <ffxiv-datamining checkout> <teamcraft json dir>     # data/tracker-data.json
python3 -I tools/add-checklist.py <FFXIV Checklist workbook.xlsx> --dm <ffxiv-datamining checkout>   # adds the checklist lists (plus what came after 7.45), data/desktop-map.json
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
