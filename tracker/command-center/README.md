# Eveniunt Command Center: the shell (gates 1B to 1E)

Date: 2026-11-09. Blueprint: `.ai/planning/COMMAND_CENTER_BLUEPRINT.md`, sections 4a (rules 1, 5 and 10), 4b (finding F1), 4c (F5, F6) and 5 (gates 1B to 1E). Cards: `.ai/planning/CARD-phase-1C.md`, `.ai/planning/CARD-phase-1D.md`, `.ai/planning/CARD-phase-1E.md`.

## Gate 1E: the root app on the public site (round 1 built; sign-in waits for the owner's answer)

Card: `.ai/planning/CARD-phase-1E.md`. Release note for the owner's phone check: `.ai/planning/RELEASE-NOTE-gate-1E.md`.

- **Its own icon.** `make-icons.js` draws the Command Center's icons (the letters **CC**, the gauge full, the shared Limit Break mark and colours) into `src/icons/`, and `build.js` uses them instead of the Tracker's. Check C15 proves they differ from both apps' icons and that the browser loads every one the manifest names.
- **The root of the public site is the shell.** The publish script (`projects/ffxiv-cosmic-crafting-solver/tools/publish-public.sh`) and the Pages workflow (`.../public/.github/workflows/pages.yml`) put `command-center/site/` at the root of the site, the Atelier at `atelier/`, the Tracker at `tracker/`, the Cosmic guides at `cosmic/`, and keep the hourly refresh of the Tracker's events list and Lodestone news (rule 10). The old static front page is gone; the shell's home screen now carries the Cosmic Exploration links, the two offline-file downloads and the licence and credits line. The workflow stops the publish unless the root is the Command Center and every module is in place. Check C16 runs the real publish script into a scratch clone and the workflow's own assemble commands, then opens the result in a browser (shell under its worker, every home-page link answers, a Cosmic page opens, the Tracker opens and comes under its own worker).
- **Sign-in that works everywhere (round 2).** Designed in the card's section 3 and put to the owner as one question with a recommended default; nothing of it is built until the owner answers. Until then the Tracker's sign-in on the site is today's (one tap per opening).
- **The owner's phone check** (Safari; finding F5: each installed app on an iPhone or iPad keeps its own copy of the save) is in the card's section 5 and the release note.

**Checks:** 20 of 20 in Chromium (`evidence/checks.json`; C1 to C16 with their error checks). Firefox and WebKit: still not installed in the session, recorded as not run (`evidence/checks-firefox.json`, `checks-webkit.json`).

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
| `site/save.js` | The one save (gate 1C), copied from `src/core/save.js` by `build.js` |
| `restore-build-inputs.js` | Recovers the fonts, the Atelier's solver and its action icons from the committed single-file builds, so both apps can be rebuilt in a session without the toolchain (`--verify` rebuilds and compares byte for byte) |
| `build.js` | Builds the shell into `site/` (about 137 KB, 11 files) |
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
| **C16** The published layout (gate 1E, rule 10) | Passed | publish script into a scratch clone (234 files, privacy check clean); the workflow's own assemble commands; root, Tracker and Atelier byte for byte the committed builds; four Cosmic pages; old front page and private records absent; all 10 files of the shell's worker present; fresh-list paths written by the job and served by the Tracker's worker; in the browser: shell under `sw.js`, 12 local links all answer, the Sinus Ardorum page opens, the Tracker opens from the root under `tracker/sw.js`, no errors |
| C2-4 errors, C6 errors | Passed | no page or console errors |

The two existing test suites still pass: `node tests/core.test.js` 61 of 61, `node tests/ui.test.js` 28 of 28 (gate 1D: the hosted test also checks the header link, the notice, **Got it** and its record; the file opened from disk has neither). The Atelier's suite: 14 of 14 (one new hosted test: one reload under its own worker, isolated on more than one thread, the link and the notice).

## What this does not prove

- **Firefox and Safari.** Only Chromium is installed in the session, in gate 1D as in gate 1B: Playwright's Firefox and WebKit are not present and may not be installed here, so `check.js` records them as not run (`evidence/checks-firefox.json`, `evidence/checks-webkit.json`). Safari on an iPhone, which rule 5 names, is a different build again: the owner checks it on the phone when gate 1E publishes, with the hand-over notice's warning about each installed app's own copy of the save in mind.
- **Real Google sign-in.** Google cannot be reached from the session; the sign-in design of gate 1E (card, section 3) is checked against a stand-in service in round 2, and the real sign-in is the owner's check on the published site. Cloud sync stays in the Tracker (gate 1C correction); moving it into the shell waits for a later step.
- **The live site.** github.io is not reachable from the session; the publish is verified by the deployment run and by check C16's rebuild of the published layout, not by opening the live page.

## Left for later gates

- **Gate 1E round 2:** the sign-in design the owner chooses (card, section 3), its checks C17 to C19 and tests, the republish, the Ship Request.
- **After gate 1E:** the new Continuity project registered in `PROJECTS.md` (decision D2) in its own small pull request.
