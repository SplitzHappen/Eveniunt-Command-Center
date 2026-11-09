# Gate 1A results: can sign-in and multi-core solving live in one app?

Date: 2026-11-09. Blueprint: `.ai/planning/COMMAND_CENTER_BLUEPRINT.md`, section 4a, rules 1, 4, 6 and 11. Card: `.ai/planning/CARD-phase-1A.md`.

## In short

**Yes. The plan's approach works, and no owner decision (D1 to D7) has to change.** All four required checks passed in Chromium:

- Google-style sign-in keeps working from the shell page.
- The Atelier page gets four cores.
- Your saved data survives going back and forth between the two pages.
- The single offline file drops to one core without errors.

The checks also found three things the plan must change:

1. **The new app's background helper must cover the Atelier.** A helper for the whole site that doesn't add the Atelier's multi-core setting would leave the Atelier on one core on its first visit. Today's Atelier start-up has a small flaw that makes this happen.
2. **Cloud sync has to compress the save. This is already needed today, not only after the rebuild.** With 8 characters, a full tracker save is 8.4 MB, and Google Drive sync accepts at most 5.2 MB. Today's tracker therefore refuses to sync once about 6 in 10 entries are ticked on all 8 characters. Compressed, the same save is 1.4 MB, and 1.5 to 1.7 MB with the new modules.
3. **The all-in-one offline file is much smaller than the blueprint feared.** The estimate is about 7.5 MB, not "over 20 MB": smaller than either of today's two files (8.1 MB and 9.0 MB).

## How it was tested

The prototype is in `site/`:

- a shell page with no multi-core setting (the browser's "cross-origin isolation");
- a stand-in for Google's sign-in popup. It hands its answer back to the page that opened it, as Google's does, and it is reached under a second host name, so it counts as a different site, as Google is;
- an Atelier stand-in page. Its own service worker (the browser's offline helper) adds the isolation headers, the same way the real Atelier does on GitHub Pages. It then runs a pool of 4 threads.

The four threads run a tiny WebAssembly program on shared memory. They first wait for each other at a barrier, which proves they are all alive at once. Then each adds 1 to a shared counter 250,000 times, and the total must come out exactly right.

The server (`serve.js`) sends no isolation headers, like GitHub Pages, so any isolation comes from the service workers. `check.js` drives Chromium through Playwright and writes `evidence/checks.json`. `measure.js` writes `evidence/measure.json`.

Technical: Chromium 153.0.8010.12 (headless), Playwright 1.63.0, Node v22.23.4, a 4-core machine; `node check.js` gave the same result on four runs.

## Checks

| Check | Result | Evidence (`evidence/checks.json`) |
|---|---|---|
| **R1** The shell is not isolated; its sign-in popup keeps its link back to the shell and returns an answer. Tested with the popup on another site (Google-like) and on the same site. | **Passed** | `shellCrossOriginIsolated: false`; popup on `http://127.0.0.1:8417` and on `http://localhost:8417`: both `popupHasOpener: true`, `shellGotMessage: true`; no errors |
| **R2** The Atelier page is isolated and runs 4 threads, whichever way you arrive | **Passed** | three ways in, each `isolated: true`, 4 threads, counter 1,000,000 of 1,000,000, all 4 at the barrier. (a) Straight to the Atelier with nothing installed: its own worker plus one automatic reload, as today. (b) Shell first, then the link: the site-wide worker isolates the Atelier, so there is no reload. (c) Shell first with a site-wide worker that does not isolate it: the Atelier's own worker takes over (prototype start-up rule, see X5). The same arithmetic on 4 threads did about 3.0 to 3.5 times the work in the time of 1 thread |
| **R3** Shell → Atelier → shell keeps a shared value | **Passed** | A marker the shell saved was read by the Atelier, from IndexedDB and from localStorage (the browser's two storage areas). Stats the Atelier added were read back by the shell. Worked with the link and with the browser's Back button. Afterwards the shell is still not isolated and sign-in still works |
| **R4** Opened as a file, the Atelier falls back to 1 thread without errors | **Passed** | `isolated: false`, `mode: single`, 1 thread, counter exact, no page or console errors |
| X1 Control: the same popup opened from the isolated Atelier page | Behaved as predicted | the popup has no link back (`popupHasOpener: false`), and no answer arrives. This is why sign-in must stay in the shell |
| X2 Shell and Atelier open in two tabs hear each other's saves (BroadcastChannel, the browser's tab-to-tab messages) | Passed | each side received the other's message. The tracker's protection against two windows overwriting each other can extend across the boundary |
| X3 Offline after one visit | Passed | the shell opens; the Atelier opens isolated with 4 threads |
| X4 The shell is installable | Passed | Chromium's installability check lists no errors |
| X5 Today's Atelier start-up rule, unchanged, gets 4 threads on its first visit under a site-wide worker that does not isolate it | **Failed** | first visit: `isolated: false`, 1 thread, its one reload already used; next visit: 4 threads. See finding F1 |

What this does **not** prove:

- **Real Google sign-in.** Google can't be reached from this session, and its sign-in only answers on the real address. Two facts make the risk small. The shell keeps exactly the setup today's tracker uses, with no isolation. And Google checks the site (splitzhappen.github.io), not the folder, so moving from /tracker/ to / needs no change to the sign-in setup. Gate 1E must still sign in for real on the published site.
- **Firefox and Safari.** Only Chromium is installed here. Rule 5 already asks for Chrome or Edge, Firefox and Safari on the phone in gate 1D. `check.js` runs unchanged under Playwright's Firefox and WebKit where they are installed.
- **Real solver speed.** The real Raphael solver gains less from extra threads than this toy does: 18.1 s → 11.6 s on 4 threads (Atelier README).

## Findings and the plan changes they call for

**F1 — The site-wide worker must cover the Atelier (gate 1B and 1D; serious, easy to fix).**

Today there is no worker for the whole site, so this problem cannot happen yet. The new app at `/` will have one. Today's Atelier reloads itself once on a first visit that is not yet isolated, and it does so as soon as *any* worker controls the page. Under the new site-wide worker, that reload happens before the Atelier's own worker has taken over. The one allowed reload is wasted, and the page stays on one core until the next visit.

Plan change, both halves (each one alone fixes it; together they cover each other):
- the site-wide worker adds the isolation headers to everything under `atelier/` (check R2b);
- the Atelier reloads only once its *own* worker controls the page (check R2c; `site/atelier/atelier.js`).

**F2 — The cloud copy must be compressed (gate 1C; serious, already true today).**

The cases measured, against the 5,177,344-byte limit in `src/core/gdrive.js`:

| Save | Cloud copy | Share of limit | Compressed | Share |
|---|---|---|---|---|
| 8 characters, all 48,652 entries ticked, all levels set | 8.4 MB | 163% | 1.39 MB | 27% |
| Same, plus sample modules: 50 lists of 200 items; 8 free companies × 4 submarines × 1 year of voyages; Atelier with 500 history entries and 100 saved macros | 13.1 MB | 253% | 1.49 MB | 29% |
| Same, with large modules (200 lists of 300 items; 3 years of voyages) | 23.6 MB | 456% | 1.68 MB | 33% |
| Theoretical ceiling (also every entry excluded and overridden) | 18.0 MB | 348% | 2.95 MB | 57% |

Today's tracker refuses with a plain message and loses nothing; backup files and transfer codes keep working. The transfer code is already compact: 126,613 characters for the full save.

Plan change:
- rule 11's "if needed" becomes "required": the cloud copy is stored compressed, with a version mark that older copies of the app recognise and refuse rather than misread;
- the limit is checked in bytes, not characters. Today's check counts characters, which undercounts names written in non-Latin letters (minor);
- the Submersibles voyage log needs a size policy. One year of full loot records is 3.5 MB before compression in the sample shape, which is this prototype's guess, since no design exists yet.

**F3 — The all-in-one file is about 7.5 MB (rule 6, D4c; good news).**

| Part | Today | All-in-one |
|---|---|---|
| Fonts (20 of 36 font files are the same in both apps) | 0.61 + 0.61 MB | 0.75 MB, included once |
| Tracker lists and maps (JSON) | 5.65 MB | 1.25 MB compressed |
| Information window | 1.49 MB | 1.49 MB (already compressed) |
| Solver program (WebAssembly) | 6.72 MB | 1.89 MB compressed |
| Action icons | 1.13 MB | 1.13 MB (already compressed) |
| Styles, code, Atelier data | about 0.89 MB | about 0.68 MB |
| New shell code (allowance, not measured) | none | 0.30 MB |
| **Total** | **17.09 MB in two files** | **about 7.5 MB in one** |

Unpacking a module's compressed data took about 12 ms on this machine.

Not included: the four Cosmic Exploration pages (about 0.36 MB more if bundled) and data for future modules (Lists' recipe tree, gear stats). Those must be measured as they arrive, as rule 6 says.

Plan change:
- correct D4's note "likely over 20 MB" to about 7.5 MB for today's content;
- the file must carry the single-core solver. It can't use the multi-core one (R4).

**F4 — Every stored setting has a home (rule 4).** The table below covers all three apps. Two points matter for gate 1C:
- **The Atelier keeps one set of crafter stats per job, not per character.** With 8 characters the stats become per character, so today's single set must go to one of them when your data is moved. Your answer: a character switcher in the Atelier (choice B below).
- The Cosmic Exploration solver keeps its own key (`cosmic-solver-v1`), which the blueprint's list did not mention.

## Storage keys (rule 4)

Kinds of key:
- **Shared:** goes to every device through backups and sync.
- **Per device:** stays in this browser.
- **Per character / world / free company:** the key inside the save it is grouped by.

| App | Key (where) | What it holds | Should be |
|---|---|---|---|
| Tracker | IndexedDB `eveniunt-tracker` → `state` → `main` (fallback: localStorage `eveniunt-tracker-state`) | characters, ticks, levels, exclusions, availability overrides, counting settings, sync bookkeeping | ticks, levels, exclusions: **shared, per character**; overrides, counting settings: **shared**; sync bookkeeping (Drive file id and merge base, FFXIV Collect lists, last backup): **per device** |
| Tracker | `main-rev` (IndexedDB) and `eveniunt-tracker-state-rev` (localStorage) | save revision stamp | **per device** |
| Tracker | `main-unreadable-<time>` (IndexedDB) and `eveniunt-tracker-state-unreadable` (localStorage) | rescue copies of saves that could not be read | **per device**; kept and offered for download, never migrated as data |
| Tracker | localStorage `eveniunt-tracker-ui` → theme, look | appearance | **per device**, as today |
| Tracker | same key → view, section, filter, folds, mode, chosen character, Hunts and Market sorting and scope | where you were in the app | **per device** |
| Tracker | same key → `live.dc`, `live.world` | data center and world | **shared** (the one place setting) |
| Tracker | same key → `live.notify`, `live.watch` | notification choices, watched timers | **shared** (the one notification centre); the browser's permission stays per device |
| Tracker | same key → `live.mlist`, `live.mqty`, `live.mq` | market shopping list | **shared**; moves to the Market or Lists module |
| Tracker | same key → `live.isle` | Island Sanctuary ranks and the week's popularity and supply | ranks: **shared, per character** (they belong to each character in the game); popularity and supply: **shared** (the same for everyone each week) |
| Tracker | localStorage `eveniunt-tracker-fired` | notifications already shown (3 days) | **per device** (rule 4) |
| Tracker | localStorage `eveniunt-tracker-dailies` | dailies and weeklies done | **shared, per character** |
| Tracker | localStorage `eveniunt-tracker-hunts` → kills, points, boss | hunt kill records | **shared, per world** |
| Tracker | same key → maint, maintAuto | end of the last maintenance | **shared** |
| Tracker | localStorage `eveniunt-tracker-news` | newest news item seen | **per device** |
| Atelier | localStorage `eveniunt-atelier-v1` → locale, theme, layout, look | language and appearance | **per device** |
| Atelier | same key → stats (8 jobs), food, potion, cosmicTool | crafter stats and loadout | **shared, per character** (choice B) |
| Atelier | same key → saved | saved macros | **shared**, kept |
| Atelier | same key → history | solve history (up to 500) | **per device**, kept; it is a cache that can be solved again, and it would make the cloud copy larger for little gain |
| Atelier | same key → macro, savedCfg, guideMs, condModel, mmSecPerStep, solver, target | macro and solver preferences | **shared** |
| Atelier | same key → job, mode, activeJobOnly, zone, recipeId, custom | the recipe on screen | **per device** |
| Atelier | sessionStorage `atelier-coi-reload` | "already reloaded once" mark | **per device** (this tab only); its rule changes (F1) |
| Cosmic | localStorage `cosmic-solver-v1` → shared (settings, profiles, profileByJob, job, mode) | crafter profiles and settings | profiles: **shared, per character**; settings: **shared**; mode: **per device** |
| Cosmic | same key → one entry per destination (rank filter, expert only, craft in progress) | the work on screen | **per device** |
| All | Cache Storage `eveniunt-tracker-<build>`, `eveniunt-atelier-<build>`; `__t` test keys | offline copies, probes | **per device**; not migrated |
| — | (none today) | free companies and submarines | **shared, per free company** (rule 7), new in phase 2 |

Not storage, but kept in mind: BroadcastChannel `eveniunt-tracker` (tab-to-tab messages) and the backup file names.

## Choices for the owner

**Your answers (2026-11-09):**

- **A:** option 1. Cloud sync starts compressing the save in gate 1C, together with the new save.
- **B:** a new option of your own: a **character switcher inside the Atelier**.
  - Each character keeps its own crafter stats for all 8 jobs, with its own food and medicine.
  - Switching characters loads that character's saved stats, so you never type them in again.
  - The switcher is built in gate 1C, when per-character stats arrive. Without it they couldn't be used, so it is the one new feature phase 1 takes on.
  - Today's single set still has to start on one character. On first opening, the Atelier asks once which character it belongs to (my earlier recommendation, kept for this one step). After that, you move between characters with the switcher.

The options as first presented are kept below for the record.

**A. When cloud sync starts compressing the save**

- **1. In gate 1C, with the new save (recommended).**
  - What happens: compression arrives with the one save, once.
  - Improves: one change to the cloud format instead of two, designed together with moving your data.
  - Costs: nothing extra.
  - Risk left: if your save passes the limit before 1C ships (weeks, unknown), sync stops with a plain message until then; nothing is lost, and backups still work.
  - Gives up: nothing.
  - Confidence: high on the sizes, which are measured. Your own save's size is unknown.
- **2. Now, as its own small fix to today's tracker.**
  - What happens: a separate small change before the rebuild.
  - Improves: heavy saves sync again sooner.
  - Costs: one more small deliverable and one more `ship`.
  - Risk left: the cloud format changes twice, and a device still on the old version refuses the new copy until it reloads.
  - Gives up: a little time on the rebuild.
  - Confidence: high.
- **3. Keep it as it is.**
  - What happens: the cloud copy stays uncompressed.
  - Improves: nothing.
  - Costs: nothing now.
  - Risk left: sync stays impossible for full saves. With the new modules, it fails much earlier.
  - Gives up: reliable cloud sync.
  - Confidence: high.

Recommendation: **1**. It lands in the right place once; choose **2** if you have already seen the "too large" message.

**B. Whose crafter stats today's single Atelier set becomes, when data moves (gate 1C)**

- **1. Ask once, on first opening, which character they belong to (recommended).**
  - What happens: one question.
  - Improves: nothing is guessed.
  - Costs: one click.
  - Risk left: none.
  - Gives up: nothing.
  - Confidence: high.
- **2. Give them to the first character.**
  - What happens: they go to the first character automatically.
  - Improves: no question.
  - Costs: none.
  - Risk left: they land on the wrong character if your crafter isn't first, and you would move them by hand.
  - Gives up: certainty.
  - Confidence: high.
- **3. Copy them to every character.**
  - What happens: every character starts with the same stats.
  - Improves: none are missing.
  - Costs: none.
  - Risk left: wrong stats on characters that don't craft at that level, which leads to wrong solves until corrected.
  - Gives up: accuracy.
  - Confidence: high.
- **4. Keep one set for the whole app (as today).**
  - What happens: stats stay shared by all characters.
  - Improves: no change for you.
  - Costs: none.
  - Risk left: different characters can't have different stats; "Solve in the Atelier" can't use the right character's stats.
  - Gives up: per-character stats.
  - Confidence: high.

Recommendation: **1**. One click, and nothing guessed.

## Files

- `serve.js`: static server, no isolation headers, draws the two icons.
- `check.js`: browser checks, writes `evidence/checks.json`.
- `measure.js`: sizes, writes `evidence/measure.json`.
- `site/`: `index.html`, `shell.js`, `shared.js`, `sw.js`, `signin.html`, `manifest.webmanifest`, `atelier/` (`index.html`, `atelier.js`, `pool-worker.js`, `sw.js`).

Run them from this folder:

```bash
node check.js
```

```bash
node measure.js
```

Nothing outside this folder changed except one entry each in `.ai/STATE.md` and `.ai/DECISIONS.md`. The blueprint itself is updated with F1 to F4 when gate 1B starts, because this card did not include it in its writes.
