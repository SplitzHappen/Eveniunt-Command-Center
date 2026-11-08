# Eveniunt Tracker

A completion tracker for Final Fantasy XIV, part of the Eveniunt Network Command Center. It tracks up to **eight characters side by side** across everything the game has to offer: about 43,800 entries in 101 lists, up to date with patch 7.57, including Custom Deliveries and Cosmic Exploration (missions by planet and class, and records).

- **Open it:** https://splitzhappen.github.io/Eveniunt-Command-Center/tracker/ (click **Install app** in the header to install it; it works offline after the first visit).
- **Single file:** `dist/eveniunt-tracker.html` works offline from your computer. Cloud sync needs the hosted app.

## Using it

1. **First start:** choose how many characters (1 to 8), name them, and pick each one's **starting class** (it decides the starting city) and, if they have joined one, their **Grand Company**. The other two cities' opening quests and the other companies' quests are then greyed out for that character and left out of its totals. Change all of this later in **Settings → Characters**.
2. **The menu** follows the game's main menu: **Character, Duty, Logs, Travel, Social**, then folders (Achievements, Collections, Quests, Duty Finder, Crafting, Gathering…) and lists. Each line shows how complete it is across your characters.
3. **A list** opens with its groups closed, so you see a short table of contents with each character's count per group; click a group to open it, or use **Open all** / **Close all**. Typing in **Find in this list** opens the groups with matches. It has one row per entry and one column per character; each column header shows the character's progress in that list (columns are numbered on narrow screens).
   - **Click** a box to mark it done for that character. **Right-click** it (on a phone or tablet, **press and hold**) to mark that the entry does not apply to that character, which leaves it out of that character's total. **Click a marked box again** (either button) to clear it: it is back to unmarked and counted. A dash means the entry does not apply (another starting city or Grand Company, or marked by you).
   - **Group header:** the count under each character ticks or clears the whole group for that character.
   - **Click an entry's name** to see how to get it and its details, and to switch whether it counts: entries that are time-limited only, no longer obtainable or of unknown availability are not counted and carry a small label; **Count it anyway** or **Mark unobtainable** overrides the default either way. Settings → Counting turns whole kinds on or off. **Show not counted** hides or shows them.
   - **Links:** ticking an entry also ticks what it proves, from the game's own data: the earlier quests it needs (through your own starting city and Grand Company), the aether current or reward a quest gives, the achievement and title it earns, Freebird when every current of a zone is ticked, level achievements from job levels, earlier ranks and relic stages, master recipe books from master recipes, achievement tiers, the links the FFXIV Completionist desktop app ships (checked and corrected), and more (about 17,900 links). A message lists what was added, with **Undo**. Links only add: unticking never unticks anything else, and nothing that does not apply to a character is ticked. The entry's details say what it ticks and what ticks it. Settings → Counting turns links off, sets whether a FATE with its own achievement assumes a gold rating, and **fills in what your existing ticks prove** (with a preview and Undo).
   - **Mark “does not apply”** (toolbar): the same as right-clicking, for a plain click; handy for marking many boxes in a row.
   - **Classes and Jobs:** type each character's level; a job counts as complete at its level cap.
   - **Find, All / Missing / Done:** filter the list. The search box in the header searches every list.
4. **Appearance:** Settings → Appearance has the same 20 FFXIV themes and settings as the Eveniunt Atelier (Mode, Theme, Accent, Background, Foreground, Advanced).

## Bringing your progress

- **From the FFXIV Completionist desktop app:** Settings → Import and backup → choose the character files it saved (JSON), pick the column for each, Import. Ticks, its “X” marks (does not apply) and job levels are imported, and the starting city and Grand Company are worked out from the save. Anything that cannot be placed exactly (for example Squadron, which no list covers) is listed and can be downloaded, so you can do it by hand.
- **Backup file and transfer code:** Settings → Import and backup. A transfer code is text you paste on another device. Browsers can clear a website's saved data (Safari after weeks without a visit, any browser when storage runs low), so the tracker asks the browser to keep it and shows a reminder when there has been no backup, transfer code or cloud sync for a month. Loading a backup or code replaces this device's data; with cloud sync on, the next sync then merges and asks about differences rather than deleting anything elsewhere.
- **Online refresh (optional):** add each character's Lodestone number in Settings → Characters. When the tracker opens with internet, it reads public data from FFXIV Collect (mounts, minions, orchestrion rolls, emotes, hairstyles, barding, fashion accessories, facewear, Blue Magic, achievements), ticks what you gained, and asks you whenever it disagrees with your own ticks. Without internet it simply waits.
- **Cloud sync (optional):** Settings → Cloud sync → sign in with Google. A private copy lives in a hidden app folder in your own Google Drive; changes from your devices merge, and real clashes ask you which side is right. A damaged cloud copy is never merged (you can replace it with this device's data), a sync that would remove more than a few dozen ticks asks first, and two devices syncing at the same moment never overwrite each other.

## Data

Built from pinned sources and regenerated, never typed by hand: see `data/SOURCES.md`. Every list is grouped the way the game groups it (expansion and patch, journal sections, zones, log pages, categories).

## Build and test

```
python3 -I tools/extract.py <ffxiv-datamining checkout> <teamcraft json dir>     # data/tracker-data.json
python3 -I tools/add-checklist.py <FFXIV Checklist workbook.xlsx> --dm <ffxiv-datamining checkout>   # adds the checklist lists (plus what came after 7.45), data/desktop-map.json
python3 -I tools/links.py <ffxiv-datamining checkout>                                # data/links.json (links between entries)
node tools/desktop-links.js <desktop app resources/resources> [<app.asar>/assets/i18n/en.json]   # optional: data/desktop-links.json
node tools/merge-desktop-links.js                                                 # adds the desktop app's checked links to data/links.json
python3 -I tools/fetch-ffxivcollect.py                                            # optional: refresh the FFXIV Collect snapshot
FONT_DIR=<node_modules/@fontsource> node tools/build.js                           # dist/eveniunt-tracker.html
FONT_DIR=<node_modules/@fontsource> node tools/make-icons.js                      # icons only
node tools/build-site.js                                                          # site/ (installable app, scope /tracker/)
node --test tests/core.test.js                                                    # core logic
node --test tests/ui.test.js                                                      # browser tests (Playwright + Chromium)
node tools/check-keys.js                                                          # key stability against the last committed data
```

## Updating to a new patch

1. Point `tools/extract.py` at the new `ffxiv-datamining` commit (and Teamcraft, if updated) and run the four data steps above; update the commit ids in `data/SOURCES.md` and the version label in `tools/extract.py`.
2. Run `node tools/check-keys.js`. It must pass: an entry that disappears or an id that now names something else would hide or move people's ticks. Merging duplicates is fine when the old ids are kept as aliases (`al`): the tracker moves ticks over on load.
3. Rebuild, run both test suites, and update the pinned counts in `tests/ui.test.js` only after checking the new entries are real.

The Appearance module (themes and settings) is taken from the Eveniunt Atelier's source at build time, so both apps share one visual system.

## Credits

Game data © SQUARE ENIX CO., LTD. FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd. A free, non-commercial fan project, not affiliated with Square Enix. It never reads game memory or automates the game. Third-party notices: `NOTICE.md`.
