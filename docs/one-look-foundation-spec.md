# One look, step 2: the shared foundation (spec)

Written 2026-11-24 for a Haiku clerk and a Sonnet builder. Owner decisions of 2026-11-24: one look for the whole app,
from the mock-ups; section titles in the Atelier's book style (Q1); every screen's main action as the Atelier's seal
(Q2); Submersibles changes only its shared parts (Q3); order B: build the foundation now, every new module (next:
Market) on it, existing screens move later (one pull request each, or a final pass). Read for this spec: `CLAUDE.md`,
`docs/STATE.md` (Next, item 0), `docs/one-look-spec.md`, `docs/one-look/mock/{one-look.css,themes.css,kit.html}`,
`docs/one-look/tools/make-themes.mjs`, `docs/one-look/pictures/notes.md`, `docs/design-rules.md`, `package.json`,
`crafting/atelier/src/atelier.js` (lines 14-51, 185-209, 1338-1625), `crafting/atelier/src/atelier.html` and
`tracker/src/app/tracker.html` (headers), `tracker/command-center/src/index.html` (head and header),
`tracker/command-center/build.js`, `tracker/tools/build.js`, `crafting/atelier/tools/build.js`,
`tracker/command-center/restore-build-inputs.js` (verify), and grep results over `check.js` and the browser tests.
Nothing was built or run. I did not open the pictures.

## 1. Goal and constraints

- Goal: one shared stylesheet, one header on every page, the shared parts as classes, the Atelier following the chosen
  theme, the design-rules change, and a check that stops drift. New modules start on it; existing bodies do not move.
- Offline-first, public, GitHub Pages: no CDN, no external URL, no personal names or private paths. Never automate or
  read the game; never invent game data (the fixture parts in checks carry no game figures).
- `save.js` and `merge.js` are untouched: the theme lives in two device keys (`eveniunt-tracker-ui`,
  `eveniunt-atelier-device-v2`); neither is read or written by `tracker/src/core/` (grep: no match).
- Every existing check and test stays passing and unchanged, except a selector edit forced by the header (section 6);
  no edit loosens what a check protects. Built copies are rebuilt and committed.
- `npm run build` verifies by rebuilding the Tracker and the Atelier and exits 1 when a built file changed
  (`restore-build-inputs.js` lines 50-59), which also skips the Command Center build. After a source change run it
  twice: the second run must exit 0. That is the build acceptance of every item.

## 2. Scope

**In:** (a) the design-rules amendment; (b) the shared stylesheet in all three builds; (c) the one header on Home,
Settings, Submersibles, Lists, Tracker and Atelier; (d) the shared parts as classes; (e) the Atelier theme fix; (f) the
drift check; the pictures.
**Not in:** moving the bodies of existing screens (Tracker overview, Atelier panels, Submersibles lanes, Lists rows,
Home cards, Settings sections) onto the shared parts. Existing body styles stay until each module's own pull request.
Also not in: the ledger row, rail, status line and empty state as shared classes (the brief's list is the scope; add
them when Market's look spec needs them).

## 3. Decisions (alternatives rejected)

1. **Shared stylesheet source: `tracker/src/app/one-look.css`**, next to `shared.css`, where the other shared sources
   already live. Rejected: a new top-level folder (new layout row, no gain); serving `docs/one-look/mock/one-look.css`
   (a mock that sits beside a copied theme table).
2. **Every shared class is prefixed `ol-`, and the sheet has no global rules** (no `*`, `html`, `body`, `button`, `a`,
   `:focus-visible` selectors). The mock's names collide with live classes: `.menu-btn` (Tracker drawer, `ui.js` 726),
   `.clock` (Tracker), `.status` (shell header), `.empty` (Atelier, `atelier.js` 828), `.row`, `.dim`. Rejected:
   unprefixed names (restyles live screens); a wrapper scope like `.ol .chap` (every module must remember the wrapper).
3. **Theme tokens come only from `applyLook`** (the one appearance module, `atelier.js` 1344-1532, which the Tracker
   embeds and `look.js` wraps). `one-look.css` defines none of them. It owns only: layout tokens (`--slant --line-2
   --line-dbl --line-row --leader --s1..--s6 --content --gut`), derived tokens (`--slab --on-slab --on-slab-2 --molten
   --hazard`), fonts (`--f-disp --f-kick --f-serif --f-body --f-data`), state and kind hues (`--back --on-back --out
   --on-out --idle --on-idle --bad --on-bad --on-mid --lr-*-fill` and the `color-mix` tones), in `:root` and
   `:root[data-theme="dark"]` (`applyLook` always sets `data-theme`, line 1395). Values: the two mode-only blocks of
   `docs/one-look/mock/themes.css`; never a block that names a theme. Rejected: generating per-theme blocks
   (one-look-spec section 6: a copy of the formulas).
4. **Load order:** `shared.css`, `one-look.css`, then module sheets. Module sheets that already define a shared token
   (fonts in `shared.css`/`atelier.css`, state hues in `subs.css`/`lists.css`) keep them until their move; the unit test
   freezes that list and the browser check proves the computed values match. Rejected: deleting the duplicates now
   (touches module sheets that the `subs-roles` and `lists-roles` tests may read).
5. **One header, written once, filled at build time** by `tracker/tools/one-look-header.js` (Node, not shipped). Each
   page source marks its header with `<!--ol-header word="…" here="…" home="…" href="…" act="…" menu="static|runtime"-->`
   the page's own tools `<!--/ol-header-->`; each build replaces the block. Rejected: a runtime script drawing the
   header (layout shift, timing changes in checks); a hand copy per page (drifts).
6. **Hooks stay.** Each element keeps every id, `data-*` and legacy class a script or check reads today (F0 lists
   them): the tool slot is `class="ol-tools mast-tools"`; the Main menu keeps `cc-back`, `data-cc-back` and `.cc-txt`
   exactly on the pages that have them today; nav links keep `data-module`. Old header CSS rules are removed; the boot
   splash `.lb-mark` rules stay. Rejected: renaming hooks and editing checks to match.
7. **Tracker and Atelier, downloaded single file:** no Main menu link and the nav `hidden`, as today (tests
   `atelier.test.js` 49, `ui.test.js` 62 require no `a[data-cc-back]` there). Hosted: the existing hosted-only code
   inserts the Main menu at the start of `.ol-hdr-in` and removes `hidden` from the nav.
8. **Atelier fix: the shared choice wins; the Atelier's own record is kept and used as fallback** (section 5).
   Rejected: copying the Atelier's own theme into the shared choice on first open (silently re-themes every page);
   ignoring the Atelier's own record (a player's chosen theme disappears from the Atelier).
9. **Electrope Skyline moves into the Atelier's theme list** (the one source), and both builds stop injecting it.
   Without it, a player on Electrope Skyline would see the Atelier fall back to Crystarium (line 1374). Rejected:
   leaving the injection (two copies of one theme in two build scripts; the Atelier still cannot follow it).
10. **Drift check in two places:** a unit test for the static rules and a `check.js` record for computed styles, with
   one fixture fragment of every shared part injected into each live page. Rejected: publishing a kit page on the site
   (a public page nobody asked for); measuring only parts already on pages (none use them yet).

## 4. The one header

Markup (from the approved `kit.html`, classes prefixed):
`<header class="ol-hdr" data-ol-hdr><div class="ol-hdr-in">` · Main menu `<a class="ol-menu" href="{home}">` drawn
stroked menu icon (`aria-hidden`) and `<span class="cc-txt">Main menu</span>` (on Home `aria-current="page"`) ·
wordmark `<a class="ol-mark" href="{href}" [data-act]>` with `ol-mk-top` "Eveniunt", `ol-mk-word` {word},
`ol-mk-gauge` · tool slot `<div class="ol-tools mast-tools">` the page's tools `</div>` · `<nav class="ol-nav"
aria-label="Command Center">` Home, Tracker, Atelier, Submersibles, Lists, Settings, current one `aria-current="page"`
`</nav></div></header>`. Sizes, phone rows and the double rule: one-look-spec section 2.3 and the mock's
`one-look.css` lines 50-68 and 287-297. No Unicode symbols (rule M5): "⚙", "☰", "⌂" go.

| Page | Keeps (in the tool slot unless said) | Loses | Gains |
| --- | --- | --- | --- |
| Home | wordmark "Command Center"; the six links (now the nav); `#status` | the "⚙" in "Settings" | Main menu |
| Settings | as Home, Settings current | as Home | as Home |
| Submersibles | wordmark; its tools (F0 lists them); rail and bottom bar (body) | its masthead styling | nav |
| Lists | as Submersibles | as Submersibles | nav |
| Tracker | search `#q`, clock `#clock` (weather), `#sync-state`, Settings, install button, the index drawer button (`.menu-btn`, `data-act="drawer"`; label per owner question 1) | the tag line "Network Command Center / Completion" | nav (hosted) |
| Atelier | language `#locale`, Settings (Workbook settings live there), install button | the tag line; the "Command Center" wording (the same link becomes the Main menu, same href and hooks) | nav (hosted) |

## 5. The Atelier theme fix: cause found in the code

- The Atelier stores its look under its own key: `atelier.js` 15 `DEVICE = 'eveniunt-atelier-device-v2'`; `load()`
  (45) reads only that key or the old `STORE` (14); `restore()` (200-209) takes `S.theme` from it; `S.look` (1374) is
  built from the same `load()`, and an unknown theme falls back to `crystarium-dawnglass`; `persist()` (48-51) writes
  `theme` and `look` only to that key. Nothing in `atelier.js` reads `eveniunt-tracker-ui` (grep: no match).
- Every other page reads and writes `eveniunt-tracker-ui`: `look.js` (`command-center/build.js` 41-44, live updates
  on line 50), the Tracker (`ui.js` 35-42). Settings' Appearance writes there.
- So the Atelier shows its own stored theme, by default Crystarium Dawnglass, while its light/dark comes from its own
  `S.theme`, default `system`, which follows the device (`isDark`, 1376). Azure Dragoon dark should paint `--paper`
  `#0e2257` (line 1358); the Atelier paints Crystarium dark `#0f2234` (1349): a near-black navy, as the brief reports.

**Fix (all outside lines 1344-1532, which the other builds copy; only the theme list inside them changes):**
1. `var UI_KEY = 'eveniunt-tracker-ui';` beside line 15.
2. `load()`: start from the device record as today; if `UI_KEY` holds `theme`, use it; if it holds `look`, use it.
   Return a new object; never write here.
3. Snapshot `var lookSeen = JSON.stringify([S.theme, S.look]);` just before `var sharedReady = loadShared();` (1542).
4. `persist()`: when `UI_KEY` held a `look` before this write, the device record keeps the `theme` and `look` it already
   had (read back, not overwritten, not deleted); otherwise it is written exactly as today. When `[S.theme, S.look]`
   differs from `lookSeen` (an Appearance change in the Atelier), read `UI_KEY`, set `theme` and `look`, keep every
   other field (`ui`), write it back, update `lookSeen`. No new field anywhere; no write without a player's change.
5. A `storage` listener for `UI_KEY`, the same as `look.js` line 50, so a change in Settings in another tab shows.
6. Electrope Skyline: append the line now at `command-center/build.js` 37 to `THEMES` (after 1368); comment "20" to
   "21"; `tracker/tools/build.js` 36-42 expects 21 and stops injecting; `command-center/build.js` 37-38 stops injecting
   and fails unless the module holds 21 themes.

Old builds stay readable: the device record's format is unchanged, so a cached older Atelier reads its own record as
before; the shared key gains no field, so the Tracker's whole-object write (`ui.js` 42) loses nothing.

## 6. Checks that may need an edit (never loosened)

- `check.js` 8189 measures from `header.mast` (Lists P3, first row under the header): becomes `header.ol-hdr`, same
  measure, same limit. F0 lists any other selector on `.mast`, `.cc-mast`, `.subs-mast`, `.lists-mast`, `.switcher`,
  `.lb-tag`, `.wordmark`; each edit is a like-for-like selector swap, named in the pull request.
- Unchanged by design (hooks kept): C9 (`check.js` 381, "Main menu" in `.cc-txt`), `check.js` 189, 520-534, 709, 750,
  5766-5773, 7512, 8299; `atelier.test.js` 49, 175, 479, 488, 516-519; `ui.test.js` 62, 405, 417.

## 7. Work items

Branches: F1 on `one-look-atelier-theme` from `main`, its own pull request. F2 to F6 on `one-look-foundation`, one
pull request, based on the branch holding `docs/one-look/` (draft pull request 8) unless that has merged. Never merge;
the owner ships. Common acceptance: the second `npm run build` exits 0; `npm run test:unit`, `npm run test:browser`,
`npm run check` pass; `git status --porcelain` lists only the item's files and rebuilt copies.

**F0. Hook inventory (Haiku clerk).** Files: none written. Steps: grep `ui.js`, `atelier.js`, `shell.js`,
`settings.js`, `submersibles/*.js`, `lists/*.js`, `check.js`, `tracker/tests/*.js`, `crafting/atelier/tests/*.js`,
`crafting/tests/*.js` for `mast`, `cc-mast`, `subs-mast`, `lists-mast`, `mast-tools`, `lb-tag`, `wordmark`, `lb-mark`,
`switcher`, `data-module`, `cc-back`, `cc-txt`, `menu-btn`, `#status`, `#sync-state`, `#q`, `#clock`, `#locale`,
`install-btn`; list each header's current children on the six pages; list every custom property defined in
`shared.css`, `shell.css`, `tracker.css`, `atelier.css`, `subs.css`, `lists.css`. Hand back file:line lists only.
Acceptance: every pattern reported with its hits or "none". Escalate if: a header element is built by code other than
`ui.js` 1351-1360, `atelier.js` 1610-1621 or the page HTML.

**F1. The Atelier follows the chosen theme (Sonnet builder).** Files: `crafting/atelier/src/atelier.js`,
`tracker/tools/build.js`, `tracker/command-center/build.js`, `crafting/atelier/tests/atelier.test.js`, rebuilt
`crafting/atelier/{dist,site}`, `tracker/{dist,site}`, `tracker/command-center/site`. Steps: section 5. New browser
tests, served page, stored values set by `addInitScript`: (1) `UI_KEY` `{theme:'dark',look:{shared:{theme:
'azure-dragoon'}}}` gives `--paper` `#0e2257`; (2) `{theme:'light'}` with look `uldah-sultanate-gilt` and the device
emulated dark gives `#efe0b0`; (3) only the device record, look `uldah-sultanate-gilt`, theme light, gives `#efe0b0`;
(4) with `UI_KEY` owning, changing the language keeps the device record's `look` byte-equal; (5) `electrope-skyline`
dark gives `#070a20`; (6) choosing a theme in the Atelier's Appearance writes it to `UI_KEY` and keeps its `ui` field.
Acceptance: tests 1, 2, 5, 6 fail on `main`; all six pass; `grep -c electrope-skyline
tracker/command-center/site/look.js` prints 1. Escalate if: any test pins 20 themes, or the fix needs a line inside
1344-1532 other than the theme list.

**F2. The shared stylesheet in three builds (Sonnet builder).** Files: `tracker/src/app/one-look.css` (new),
`tracker/tools/build.js` (css = `shared.css` + `one-look.css` + `tracker.css`), `crafting/atelier/tools/build.js`
(css = `one-look.css` + `atelier.css`), `tracker/command-center/build.js` (copy to `site/one-look.css`),
`<link>` after `shared.css` in `tracker/command-center/src/{index,submersibles/index,lists/index}.html`,
`tracker/tests/one-look.test.js` (new), `package.json` (`test:unit` runs it), rebuilt copies. Steps: port
`docs/one-look/mock/one-look.css` per decisions 2 and 3: tokens; type helpers `ol-lbl ol-kick ol-fig`; `ol-page`
(graph paper, opt-in); role classes `ol-r-*`; answer band `ol-slab`; state block `ol-sb` with forms `ol-solid
ol-outline ol-hatch ol-done`; section title `ol-chap` (`ol-num`, `h2`, `ol-sub`, `ol-sum`, `ol-closed`) and
`ol-subgroup`; index line `ol-ix`; fields `ol-fld ol-sel ol-chk ol-step`; buttons `ol-seal` (with `ol-key`), `ol-btn-p`,
`ol-btn-2`, `ol-btn-q`, `ol-seg`; their phone rules. Drop the `caps` variants. Unit test: every selector starts with
`.ol-` or is `:root` / `:root[data-theme="dark"]`; no hex, `rgb(` or `oklch(` outside the token blocks; radius only 0;
`box-shadow` only `inset`; none of the tokens `applyLook` sets (read from `atelier.js` by `/set\('(--[\w-]+)'/`); the
built Tracker and Atelier pages contain the stylesheet text; `site/one-look.css` equals the source and the three pages
link it. Acceptance: the test fails before the change and passes after; every existing check passes unchanged.
Escalate if: a live screen changes look (a class or token collision the test missed).

**F3. The one header on six pages (Sonnet builder; needs F0, F2).** Files: `tracker/tools/one-look-header.js` (new),
`tracker/src/app/tracker.html`, `tracker/src/app/ui.js` (1351-1360: insert the Main menu first in `.ol-hdr-in`, with
icon and `.cc-txt` "Main menu"; unhide the nav), `crafting/atelier/src/atelier.html`, `crafting/atelier/src/atelier.js`
(1610-1621 likewise; the word becomes "Main menu"), the three Command Center pages, `shell.js` only if it selects the
old nav, the three builds (fill headers before their own `{{…}}` step), old header rules removed from `shared.css`,
`shell.css`, `tracker.css`, `atelier.css`, `subs.css`, `lists.css`, the header rules added to `one-look.css`, the
`check.js` selector swaps of section 6, assertions added to `one-look.test.js`. Steps: section 4 and decisions 5 to 7.
Acceptance: unit test: each built page holds exactly one `class="ol-hdr"`, one `ol-tools`, no `lb-tag`, no
`class="mast`; fails before. Existing suites pass with only the listed selector swaps; C9 and P1 at 360 px pass.
Escalate if: a check reads text or a class the header removes, or the Tracker's tools do not fit 360 px without
sideways scroll.

**F4. The drift check (Sonnet builder; needs F1 to F3).** Files: `tracker/command-center/check.js` (one new record,
next free id), `tracker/command-center/one-look-fixture.html` (new: one of each shared part, plain words, no game
figures; not copied into `site/`), `tracker/tests/one-look.test.js`, `tracker/tests/one-look-allow.json` (new).
Browser record: for Home, Settings, Submersibles, Lists, Tracker and Atelier (hosted), at 1440 and 360, stored choice
default light and `azure-dragoon` dark: inject the fixture; compare across pages the computed header height,
border-bottom style and width, wordmark font and size, Main menu height and border, nav display; `ol-chap` numeral and
`h2` font family, size, weight, style; `ol-seal` background (equals `--seal`), font, min-height; `ol-fld input`
border-bottom, height, font; `ol-btn-2`, `ol-btn-q`, `ol-sb`, `ol-ix`, `ol-slab`; and `--paper --seal --back
--f-serif`. All equal per width and choice. Unit: a module sheet defining a token that `one-look.css` defines or
`applyLook` sets fails unless listed in the allow file (today's list from F0; header comment: may only shrink).
Acceptance: passes; a temporary `.ol-seal{font-style:normal}` in `subs.css` makes the record fail, and a new token
duplicate in `lists.css` makes the unit test fail (both reverted, both reported). Escalate if: the computed values
differ between pages for a reason other than a module rule.

**F5. Design-rules amendment (Haiku clerk).** File: `docs/design-rules.md`. Steps: apply the text of section 8
verbatim; update the count line (58 to 60); add the drift check to section 12 step 5. Acceptance: `git diff --stat`
shows only this file; the rule ids M1, M6, C6, T1, T5, A1 appear once each in a table. Escalate if: a rule id is taken.

**F6. Pictures (Sonnet builder; last).** Files: `docs/one-look/tools/shoot-site.mjs` (new),
`docs/one-look/foundation/*.png`, `docs/one-look/foundation/notes.md`. Steps: serve the site laid out as `pages.yml`
does (root, `/tracker/`, `/atelier/`), reusing `check.js`'s server; set the stored choice as `check.js` 8299 does;
pages Home, Settings, Submersibles, Lists, Tracker, Atelier at 1440x1000 and 360x800 in `crystarium-dawnglass` light
and dark, `azure-dragoon` dark, `uldah-sultanate-gilt` light: 48 pictures `<page>-<1440|360>-<theme>-<mode>.png`;
one line per page in `notes.md` on the header and the Atelier's theme. Acceptance: 48 files; in each theme and mode the
Atelier's measured `--paper` equals Home's (written into `notes.md`). Escalate if: a page cannot be opened without a
seeded save.

## 8. Design-rules text (F5 applies it)

- **M1 (replaces):** One header on every page, made by one shared helper: the "Main menu" button (icon and word, 40 px),
  the wordmark, a tool slot for the page's own tools, the app's pages from 701 px with the current one underlined, and
  a double rule beneath. A module never draws its own masthead. Its own views stay in a tab bar: a left rail from
  701 px, a bar fixed to the bottom on a phone. Check: the drift check. From: main menu round, 2026-11-12; one look,
  2026-11-24.
- **M6 (new):** Shared parts come from the shared stylesheet: section title, main-action seal, fields, secondary and
  quiet buttons, state block, index line, answer band. A module adds layout only; it never restyles a shared part or
  defines a shared token. Check: the drift check. From: one look, 2026-11-24.
- **C6 (new):** A section head is book style: a Roman numeral in Fraunces italic in the accent, the title in Fraunces
  600 with an italic line under it, the state summary at the right (C4), and a 2 px rule under the whole head. From:
  owner Q1, 2026-11-24.
- **T1 (amends):** Display (Big Shoulders, uppercase): fixed app words, answer numerals and state words. Fraunces:
  section and page titles, names the player or the game supplies, window titles, the main-action seal. Kicker, body
  and data unchanged.
- **T5 (amends):** Buttons are sentence case in the body face, bold. The screen's one main action is the seal: the
  accent fill with an inner frame and its word in Fraunces 900 italic, 64 px high (48 px on a phone). From: owner Q2.
- **A1 (adds):** The screen's one main action is the seal (T5); at most one seal per screen.
- **Who it binds:** M1 and M3 bind every page now. C6, M6 and the T1 and T5 changes bind every new module now and
  each existing screen from its move (its own pull request or the final pass); until then its body keeps its look.

## 9. Risks, and the first thing to verify

- **First:** after F1, on the served site, the same stored choice gives the same `--paper` and `--seal` on Home and
  in the Atelier (F1 test 1). If not, the cause is elsewhere and F2 to F6 wait.
- Changing the theme inside the Atelier now changes it on every page (rule M3); say so in the pull request.
- A player who chose a theme only in the Atelier keeps it there until they choose in Settings; other pages show theirs.
- The Tracker's header carries six tools; at 360 px it may need two rows (P1 is checked).
- 48 pictures add several megabytes to a public repository.
- The fixture in `check.js` proves no page overrides the shared parts; it does not prove the parts look right on a
  real screen. Market's look spec and pictures do that.

## 10. Owner questions

**1. What the Tracker and Atelier headers keep.** The mock-ups show only search and clock (Tracker) and the language
menu (Atelier); today they also have a sync line, a Settings button, an install button and, on the Tracker, a "Menu"
button that opens its list of sections on a phone. Recommendation: the first.
- Keep them all in the header's tool area for now, and rename the Tracker's "Menu" to "Index" so it is not confused
  with "Main menu". Nothing is lost; the header is busier than the mock-up, mostly on a phone. Small cost. Fairly sure.
- The same, keeping the name "Menu". Nothing is lost; two buttons named "menu" sit side by side.
- Match the mock-ups now: those controls leave the header. Their contents would have to move into the pages, which is
  the later body work brought forward; more work, and a risk of losing the phone's way to the Tracker's sections.
- Keep things as they are: the Tracker and the Atelier keep their own headers until their own move; the shared header
  appears on Home, Settings, Submersibles and Lists only. No cost there; the first visible sign of one app is partial.
