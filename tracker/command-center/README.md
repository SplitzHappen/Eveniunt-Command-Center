# Eveniunt Command Center: the shell (gates 1B to 1E) and the Submersibles module (step S2)

Date: 2026-11-09. Blueprint: `.ai/planning/COMMAND_CENTER_BLUEPRINT.md`, sections 4a (rules 1, 5 and 10), 4b (finding F1), 4c (F5, F6) and 5 (gates 1B to 1E). Cards: `.ai/planning/CARD-phase-1C.md`, `.ai/planning/CARD-phase-1D.md`, `.ai/planning/CARD-phase-1E.md`.

## Submersibles step S3 (rest): rank after a voyage, size meter (2026-11-12)

Card: `.ai/planning/CARD-S3-submersibles-rank.md`. Logging a voyage moves the sub's rank and experience on by the route's base experience ("at least"); the Back sheet takes the game's rank if higher and keeps both (`trip.rankCalc`, `trip.rankAfter`); suggestions and the one-press button for a Back sub use the rank after its voyage; Setup shows the save's compressed size against the 4 MB cloud limit. Check C22 covers both.

## Submersibles step S2: the fleet board and guided setup (2026-11-11)

Card: `.ai/planning/CARD-S2-submersibles-board.md`. Design: `.ai/planning/SUBMERSIBLES_DESIGN.md` (sections 3.1, 3.2 send only, 3.6, 4, 6 in-app part, 7.1, 7.3).

- **Where it lives.** A page of the shell's own site at `submersibles/` (source `src/submersibles/`: `index.html`, `subs.js`, `subs.css`, `advisor.js` (worked-out voyages and suggestions), and `fleet.js`, which the shell loads too). `build.js` copies them and writes `submersibles/data.js` with a copy of `data/submarines.json` and the worlds list of the shared place setting (`data/live.json`). The data is kept compressed inside the page because that is smaller: 27.8 KB against 84.2 KB as plain text (both printed by every build). The page loads the one save from `../save.js` and the shell's `../shell.css`. **Not isolated**, under the shell's site-wide worker, which keeps its files with the shell's and opens it network first, like the shell's own page; the module also registers that worker when opened directly. The module page is about 158 KB with the save and the styles. The all-in-one offline file (blueprint rule 6) is not built yet, so its measurement waits for that file.
- **The shell** has a **Submersibles** entry in the switcher and on the home screen; the module's header carries the same **⌂ Command Center** way back as the Tracker and the Atelier. **Coming next** no longer lists it.
- **Guided setup**, once per free company: name, world, character (or none), then each of the 4 slots (unlocked or not, name, rank, the four parts filtered by the rank's classes, any voyage under way as the game shows it), then the sectors already discovered as a tick list by sea. The next-slot sectors (Deep-sea Site J, O, T) show with the source's two notes, labelled community data. Everything stays editable; removing a free company keeps its logged voyages.
- **The board:** Back (green, how long it has waited), Out (blue, countdown and local return time), Idle (amber), Locked (grey, with the sector that unlocks the slot); name, rank, the parts as a short code (S, U, W, C, Y; `+` for modified), the route if entered. Top strip: next back and how many are back. Sorting by free company or by return time. Phone: bottom tab bar (Board and Setup live; Log, Map and Earnings say which step brings them); tablet: two columns; computer: 4 × 2.
- **Send (owner's request, 2026-11-11: no typing):** one tap on a Back or Idle sub opens the send sheet. A sea dropdown opens one button per discovered sector of the free company; tapping builds the route in order (numbered badges, up to 5, tap again to drop one) and the return time, range, tanks and experience (at least) are worked out again on every tap (`advisor.js`, the S1 formula, labelled "calculated, not yet confirmed" until 10 entered game times agree). An optional "The game says…" time wins for that voyage and is kept beside the worked-out one as evidence. "Send again" or "Collected" logs the voyage as a trip. "Send all back" sends each picked sub on its own suggested route.
- **Suggestions (owner's order):** 1. unlock all four subs (routes towards Deep-sea Site J, O, T), 2. discover every sector (the most new reveals, quickest first; sectors already on another sub's voyage are not counted twice), 3. farm gil (community gil routes from the data, until logging brings real gil per hour). Levelling happens inside steps 1 and 2 when rank is what holds the next unlock. Parts are suggested only at step 3. Each suggestion says why, with up to two other routes. **One press:** every Back or Idle sub on the board has a "Send ▸ (route)" button that sends it on its suggested route at once; the sheet's suggestion has "Send on this route".
- **Accuracy:** the formula's three numbers match what players measured in the game (official forum; pinned by a core test). Each Out sub's card has "Check against the game"; Setup shows the accuracy table, and the label reads confirmed after 10 checks within a minute.
- **Alerts (blueprint rule 8):** while the module or the shell is open, a banner (and a sound, if turned on in the strip) when a sub comes back; subs back within the same minute share one banner; what came back while no page was open shows as Back, with no banner. The marks and the sound choice live in the device key `eveniunt-command-center-device` (`subs`), never in the save. **Calendar:** each Out sub, and each free company's last return, offers a one-event `.ics` file with a 0-minute alarm. The Tracker and the Atelier do not show the banner: they are built by their own projects and adding the script would change them, so they are left as they are.
- **The save:** `modules.submersibles` exactly as design 7.1, checked by `CC.checkSubmersibles` in `src/core/save.js` and merged per free company, sub, trip and preference.

**Checks C20 to C25** (Chromium): opens from the shell and directly, not isolated, offline after one visit (C20); one free company with four subs set up end to end, then renamed (C21); send by tapping a route with the time worked out (no typing), the page clock moved past it, Back with one banner, a reload with none, "Send all back" on each sub's own suggested route, and two game times in the same minute sharing one banner (C22); the `.ics` time and alarm (C23); 390 px with no sideways scrolling (C24); 8 free companies × 4 subs inside 1920 × 1080, two columns on a tablet, sorting by return time (C25). Screenshots: `evidence/submersibles-board.png`, `evidence/submersibles-phone.png`, `evidence/submersibles-desktop.png`. C1, C4, C5, C14 and C16 now expect the third module card and the fourth switcher entry.

## Gate 1E: the root app on the public site, and sign-in once per device

Card: `.ai/planning/CARD-phase-1E.md`. Release note for the owner's phone check: `.ai/planning/RELEASE-NOTE-gate-1E.md`.

- **Its own icon.** `make-icons.js` draws the Command Center's icons (the letters **CC**, the gauge full, the shared Limit Break mark and colours) into `src/icons/`, and `build.js` uses them instead of the Tracker's. Check C15 proves they differ from both apps' icons and that the browser loads every one the manifest names.
- **The root of the public site is the shell.** The publish script (`projects/ffxiv-cosmic-crafting-solver/tools/publish-public.sh`) and the Pages workflow (`.../public/.github/workflows/pages.yml`) put `command-center/site/` at the root of the site, the Atelier at `atelier/`, the Tracker at `tracker/`, the Cosmic guides at `cosmic/`, and keep the hourly refresh of the Tracker's events list and Lodestone news (rule 10). The old static front page is gone; the shell's home screen now carries the Cosmic Exploration links, the two offline-file downloads and the licence and credits line. The workflow stops the publish unless the root is the Command Center and every module is in place. Check C16 runs the real publish script into a scratch clone and the workflow's own assemble commands, then opens the result in a browser (shell under its worker, every home-page link answers, a Cosmic page opens, the Tracker opens and comes under its own worker).
- **Sign-in once per device (round 2, owner's answer `sign-in: B (OneDrive)`).** Cloud sync moves from Google Drive to the owner's OneDrive (`src/core/cloud.js`, the app's own folder, "write only if unchanged" with eTags) and a small free helper of the owner's (`helper/worker.js`, a Cloudflare Worker; set-up in `helper/README.md`) keeps each device's sign-in alive: Settings → Cloud sync → **Sign in with Microsoft** once, through `tracker/oauth.html`, then the device syncs by itself on every browser and installed app, with the result stated plainly in the status line and the panel. Checks C17 to C19 run the whole flow against stand-ins (`tests/standins.js`: Microsoft's sign-in, the real helper in-process, OneDrive); the real sign-in is the owner's check on the published site. The owner's two set-up values are in `site-src/sync-config.json` and the site was republished with them on the owner's `ship` (2026-11-09).
- **The owner's phone check** (Safari; finding F5: each installed app on an iPhone or iPad keeps its own copy of the save) is in the card's section 5 and the release note.

**Checks:** 23 of 23 in Chromium (`evidence/checks.json`; C1 to C19 with their error checks). Firefox and WebKit: still not installed in the session, recorded as not run (`evidence/checks-firefox.json`, `checks-webkit.json`).

## Gate 1D: today's installed apps and offline use keep working through the move

Card: `.ai/planning/CARD-phase-1D.md`. Three changes, none visible unless you look for them:

- **The Atelier's reload rule (F1, second half).** On a first visit that is not yet isolated, the Atelier reloads itself once, but only once its **own** worker controls the page. A site-wide worker that takes the page first no longer spends that one reload. Under a root worker that does not isolate `atelier/` (what gate 1A's check X5 failed under), the Atelier now ends isolated on 4 threads after exactly one reload (check C13); under the real root worker it arrives isolated and needs no reload at all (check C2, unchanged).
- **A way back.** Each app's header starts with a **⌂ Command Center** link to the site root, where the shell lives (hosted pages only; the file opened from disk has none). From the Tracker, from the Atelier, and from an Atelier opened directly with the shell never visited, it opens the shell, which is not isolated each time (check C14). The shell's welcome text names it instead of the Back button.
- **The hand-over of the old installed apps (rule 5).** `/tracker/` and `/atelier/` stay complete offline pages under their own workers: they are where the modules live, so there is nothing to redirect them to. An app installed or bookmarked on its own shows a one-time notice under its header ("The Tracker is now part of the Eveniunt Command Center … it reads the same save as this page, so nothing needs to move, and this icon keeps working"), with **Open the Command Center** and **Got it**. **Got it**, or installing the Command Center (the shell records it), ends the notice in both apps; the header link stays. Opened from the shell, no notice. On an iPhone or iPad the notice adds that each installed app keeps its own copy of the save there, so the data must be moved with a transfer code, a backup or cloud sync before an icon is removed (check C12, screenshots `evidence/tracker-handover.png`, `evidence/atelier-handover.png`, `evidence/tracker-phone-handover.png`).

**Checks:** 18 of 18 in Chromium (`evidence/checks.json`; C1 to C14 with their error checks). **Firefox and WebKit could not run:** `check.js` takes `BROWSER=firefox` or `BROWSER=webkit`, but Playwright's Firefox and WebKit are not installed in this session (only Chromium is, and the session's rules do not allow installing browsers); the attempt is recorded in `evidence/checks-firefox.json` and `evidence/checks-webkit.json` as *not run*, with the reason. Those two engines are desktop builds in any case, so Safari on an iPhone, which rule 5 names, can only be checked by the owner on the phone, in gate 1E or after it. One new key on the device, `eveniunt-command-center-device` (`installed`, `handoverSeen`), never in backups, transfer codes or the cloud copy.

**Gate 1C:** the shell, the Tracker and the Atelier now share one save on the device (`src/core/save.js`). The home screen shows the shared characters and writes nothing. Check C11 runs the whole move in one browser profile: the Tracker copies its save in, the Atelier asks once whose stats are whose and keeps each character's stats, and the old data stays untouched. Since gate 1C changes both apps on purpose, check C10 now confirms the test site serves their current builds byte for byte. The gate 1B text below is kept as it was, with corrections marked.

## In short

**The shell works, and today's Tracker and Atelier open from it unchanged.** All 14 browser checks passed in Chromium (15 with gate 1C's C11):

- The shell has a header, a module switcher (Home, Tracker, Atelier) and a home screen.
- The shell is **not** isolated, so Google's sign-in window can keep working there (gate 1C moves sign-in into it).
- The Atelier opened from the shell is isolated and solves on 4 threads, with no extra reload.
- Today's Tracker and Atelier pages still open, also directly, and work offline.
- Nothing in either app changed.

Gate 1E (round 1) puts the shell at the root of the public site.

## What is here

| File | What it is |
|---|---|
| `src/index.html`, `src/shell.css`, `src/shell.js` | The shell page: header, module switcher, home screen with the two modules, the Cosmic Exploration guides, the coming modules in the owner's order, the offline-file downloads, the credits, and an install button |
| `src/icons/`, `make-icons.js` | The Command Center's own icons (gate 1E) and the script that draws them |
| `src/sw.js` | The site-wide service worker (template; `build.js` fills in the build id and file list) |
| `src/submersibles/` | The Submersibles module page (step S2): `index.html`, `subs.js` (setup, board, send), `subs.css`, `advisor.js` (worked-out voyages, suggestions), `fleet.js` (typed times, statuses, calendar file, alerts; also loaded by the shell) |
| `site/save.js` | The one save (gate 1C), copied from `src/core/save.js` by `build.js` |
| `restore-build-inputs.js` | Recovers the fonts, the Atelier's solver and its action icons from the committed single-file builds, so both apps can be rebuilt in a session without the toolchain (`--verify` rebuilds and compares byte for byte) |
| `build.js` | Builds the shell and the Submersibles page into `site/` (16 files; the icons are most of it) |
| `site/` | The built shell. On the public site it is the root, next to `tracker/`, `atelier/` and `cosmic/` (gate 1E) |
| `serve.js` | Test server: the published layout under `/Eveniunt-Command-Center/`, assembled on the fly from the shell, today's `site/` (Tracker) and `../ffxiv-cosmic-crafting-solver/atelier/site/` (Atelier), with no isolation headers, like GitHub Pages |
| `check.js` | The browser checks (`BROWSER=chromium|firefox|webkit`); writes `evidence/checks*.json` and the screenshots. C16 also runs the publish script and the Pages workflow's assemble step into a scratch clone |
| `fixtures/naive-root-sw.js` | A site-wide worker that controls every page and adds no isolation headers, served as the root worker of a second test site for check C13 only; never deployed |
| `evidence/` | `checks.json` (Chromium), `checks-firefox.json` and `checks-webkit.json` (not run here; see gate 1D above), `shell-desktop.png`, `shell-phone.png`, `tracker-handover.png`, `atelier-handover.png`, `tracker-phone-handover.png` |

Run from the project root:

```bash
node command-center/build.js
```

```bash
node command-center/check.js
```

To look at it yourself: `node command-center/serve.js`, then open http://127.0.0.1:8418/Eveniunt-Command-Center/.

## How the shell opens the apps

- **Each app opens as its own page**, by a plain link. The Atelier must, because multi-core solving needs its own isolated page (rule 1); the Tracker does the same, so both behave alike, and its sign-in, install button and offline helper stay exactly as today. The browser's Back button returns to the shell, and since gate 1D so does the **⌂ Command Center** link in each app's header.
- **The site-wide service worker** (the browser's offline helper, scope: the whole site):
  - keeps the shell's own files for offline use, with **no** isolation headers;
  - adds the Atelier's three isolation headers (the same ones its own worker adds) to everything under `atelier/`, which is finding F1;
  - passes `tracker/` through unchanged;
  - offline, serves an app's pages from that app's own offline copy, so nothing is stored twice; a module never opened on this device shows a short note with a link back;
  - leaves other sites (Google, FFXIV Collect, Universalis) and every other path on the site untouched.
- Once an app's own worker is installed, the browser hands that app's pages to it, not to the site-wide one (check C7). The site-wide worker only covers an app's first visit.
- The shell follows the Tracker's light or dark choice by reading it; it writes nothing to either app's storage.

## Checks

Chromium 153.0.8010.12 (headless), Playwright 1.63.0, Node v22.23.4. Every request to another site was blocked.

| Check | Result | Evidence (`evidence/checks.json`) |
|---|---|---|
| **C1** The shell is not isolated; its own worker controls it | Passed | `isolated: false` before and after its worker took control; switcher Home, Tracker, Atelier; two module cards; no errors |
| **C2** Shell → Atelier: isolated, more than 1 thread, solves, no extra reload | Passed | `isolated: true`, 4 threads, one page load (no reload). A real solve of recipe 38200 on 4 threads in 18.3 s gave quality 19,710, the same as the native solver. The server sends no isolation headers and the Atelier's own worker was not installed before that page load, so the isolation on arrival came from the site-wide worker (F1) |
| **C2b** Back to the shell | Passed | the shell is again not isolated |
| **C3** Shell → Tracker works | Passed | not isolated; 2 characters set up; overview shown; its own worker took over |
| **C4** Offline after one visit | Passed | the shell opens; the Tracker opens with its save; the Atelier opens isolated on 4 threads |
| **C5** Offline, a module never opened | Passed | the shell's note "You are offline" with a link back, which works |
| **C6a** Today's Atelier opened directly, as today | Passed | after its usual one reload, under its own worker: isolated, 4 threads; offline too (gate 1D also records the one reload and its mark) |
| **C6b** Today's Tracker opened directly, as today | Passed | works; offline with its save |
| **C7** Both apps installed before the shell existed | Passed | three workers side by side (site, `tracker/`, `atelier/`); each app stays under its own; the Atelier is isolated on 4 threads; each app shows the way back (gate 1D) |
| **C8** The shell is installable | Passed | Chromium lists no installability errors |
| **C9** Phone width (390 px) | Passed | no sideways scrolling in the shell (`shell-phone.png`) nor in the Tracker with its header sign and the hand-over notice (`tracker-phone-handover.png`, gate 1D) |
| **C10** Gate 1B: nothing in either app changed. Gate 1C: the test site serves both apps' current builds | Passed | gate 1B: no difference from `main`. Gate 1C changes both apps on purpose; the check now confirms the test site serves their current builds byte for byte, without isolation headers from the server |
| **C11** One save for the shell and both modules (gate 1C) | Passed | the Tracker copies a seeded save in (`from: indexeddb`, both characters, every tick); the Atelier, still isolated on 4 threads, asks once whose today's stats are, then keeps Alba at 5,555 craftsmanship and Brio at the default 4,900; the shell lists Alba and Brio; the old Tracker save and the old Atelier key are byte for byte the same; the one save holds the Tracker's ticks, the Atelier's profile and the kept macro |
| **C12** Old installed apps keep working offline after the shell arrives, and hand over (gate 1D, rule 5) | Passed | both apps opened directly first (own workers), then the shell; offline, the Tracker opens with its 2 characters under `tracker/sw.js` and the Atelier isolated on 4 threads under `atelier/sw.js`, each with the header link and the notice; **Got it** in the Atelier ends the notice in both; with the record cleared, the shell's install mark ends it too; the link stays |
| **C13** The Atelier's reload rule under a root worker that does not isolate `atelier/` (gate 1D, F1) | Passed | a second test site whose root worker controls every page and sends `atelier/` without isolation headers (probe: no COOP or COEP header); from its shell, the Atelier's first visit ends isolated on 4 threads under its own worker after exactly 2 page loads (the arrival and one reload), with the reload mark set; a second tab arrives isolated with 1 page load |
| **C14** The way back (gate 1D) | Passed | shell → Tracker → link → shell; shell → Atelier → link → shell; Atelier opened directly (shell never visited) → link → shell; the shell is not isolated and shows both module cards each time |
| **C15** The shell's own icons and manifest (gate 1E) | Passed | four icons present, each different from the Tracker's and the Atelier's; the manifest names three, the browser loads each (200, PNG); page icon, Apple icon and manifest links point at the shell's files |
| **C17** First sign-in on a device (gate 1E) | Passed | from the Tracker opened through the shell: one tap, the stand-in Microsoft, back through `oauth.html` with a code, the helper keeps one device, the cloud copy is created, "Synced HH:MM"; the device handle appears in no backup, transfer code, save or cloud copy |
| **C18** A new sitting on a signed-in device (gate 1E) | Passed | tab storage cleared and reloaded: no sign-in page, one quiet renewal through the helper, "Synced"; the panel says the device is signed in and syncs by itself; a rename made on another device arrives on the next sync and the copy's eTag moves on |
| **C19** An ended sign-in (gate 1E) | Passed | the sign-in revoked at Microsoft: the status line says "tap to sign in", the device record is gone, the cloud copy untouched, the panel offers the sign-in; the tap works again; **Sign out on this device** forgets the device at the helper |
| **C16** The published layout (gate 1E, rule 10) | Passed | publish script into a scratch clone (234 files, privacy check clean); the workflow's own assemble commands; root, Tracker and Atelier byte for byte the committed builds; four Cosmic pages; old front page and private records absent; all 10 files of the shell's worker present; fresh-list paths written by the job and served by the Tracker's worker; in the browser: shell under `sw.js`, 12 local links all answer, the Sinus Ardorum page opens, the Tracker opens from the root under `tracker/sw.js`, no errors |
| C2-4 errors, C6 errors | Passed | no page or console errors |

The test suites pass: `node --test tests/core.test.js` 61 of 61 (the sync logic now against a stand-in OneDrive with eTags), `node --test tests/helper.test.js` 5 of 5 (the helper), `node --test tests/ui.test.js` 29 of 29 (gate 1E: one new hosted test runs the whole sign-in flow). The Atelier's suite: 14 of 14.

## What this does not prove

- **Firefox and Safari.** Only Chromium is installed in the session, in gate 1D as in gate 1B: Playwright's Firefox and WebKit are not present and may not be installed here, so `check.js` records them as not run (`evidence/checks-firefox.json`, `evidence/checks-webkit.json`). Safari on an iPhone, which rule 5 names, is a different build again: the owner checks it on the phone when gate 1E publishes, with the hand-over notice's warning about each installed app's own copy of the save in mind.
- **The real Microsoft sign-in, the real helper and the real OneDrive.** None can be reached from the session; checks C17 to C19 run against stand-ins (the real helper code in-process). The owner's first sign-in on the published site is the live check. Cloud sync stays in the Tracker (gate 1C correction); moving it into the shell waits for a later step.
- **The live site.** github.io is not reachable from the session; the publish is verified by the deployment run and by check C16's rebuild of the published layout, not by opening the live page.

## Left for later gates

- **Gate 1E is final** (PR 991). The owner's first real sign-in and the phone check follow the release note.
- **After gate 1E:** the new Continuity project registered in `PROJECTS.md` (decision D2) in its own small pull request.
