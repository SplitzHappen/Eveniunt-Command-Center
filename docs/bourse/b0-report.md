# B0 report: baseline and facts

Run on 2026-11-25. Branch `claude/loving-lamport-iy3cg1`. `<base>` = `d7322c7` (HEAD when B0 started). While B0 ran, commit `8f93ae2` ("Bourse B1: real Universalis replies saved as fixtures") landed on the branch at 07:23:52 UTC. It was not made by this run. Unit tests ran before it; the browser tests and C196 ran after it; the unit suite was rerun at `8f93ae2` (below). No repository file was edited.

## Suites

- `npm ci`: exit 0 (node_modules was missing).
- `npm run build`: exit 0 at `d7322c7` and again at `8f93ae2` (second run). `git status` afterwards shows only the two test artifacts listed here, not build output.
  - ` M crafting/tests/screenshots/phone-crafting.png` (changed by the browser tests, not by the build)
  - `?? tracker/command-center/evidence/checks-only.json` (written by `CHECK_ONLY=C196 npm run check`)
- `npm run test:unit`: at `d7322c7` exit 0, 634 tests, 634 pass, 0 fail. At `8f93ae2` exit 0, 645 tests, 645 pass, 0 fail (the 11 extra are `bourse-replies.test.js`, added by that commit).
- `npm run test:browser`: exit 0, 67 tests, 67 pass, 0 fail (Tracker ui 36, Atelier 22, crafting ui 9).
- `CHECK_ONLY=C196 npm run check`: exit 0, `PASS C196 ...`, 1/1 passed. Full `npm run check` not run (per instructions).

## Q: highest check id

- Highest id in `tracker/command-center/check.js` is C196 (grep `C[0-9]{3}`, sorted). Matches the expected value.

## Q: `<base>` and whether the one-look rules and every module move are in it

- `<base>` = `d7322c7`. Commit `645f0b4` ("One look: the owner chose B") is in history, and `tracker/src/app/one-look.css` exists at base.
- The one-look rules pull request is not in base: as the spec expects, this is a fact, not a failure. Not verified beyond this.
- Module moves are not done: Tracker source is still `tracker/`, Atelier still `crafting/atelier/`, Lists and Submersibles still under `tracker/command-center/src/`.
- `tracker/tests/one-look.test.js:114-115` still expects six modules (Home, Tracker, Atelier, Submersibles, Lists, Settings), no Bourse.

## Q: every line of check.js and the tests that count nav links, modules or Home cards

- `tracker/command-center/check.js:155` `cards: document.querySelectorAll('.modules .card').length`
- `check.js:254` `'["Home","Tracker","Atelier","Submersibles","Lists","Settings"]' && again.cards === 4`
- `check.js:296` `sOff.cards === 4` (C4); `check.js:313` `s.cards === 4` (C5)
- `check.js:535-537` `s1.cards === 4`, `s2.cards === 4`, `s3.cards === 4`
- `check.js:630` `detail.shell.cards === 4`
- `check.js:767` `JSON.stringify(shell.modules) === '["Home",...,"Settings"]' && shell.cards === 4`; `check.js:769` `shellOffline.cards === 4`; `check.js:773` (reported values)
- `check.js:5784` `JSON.stringify(shell.modules) === '["Home",...,"Settings"]' && shell.cards === 4`; `check.js:5791` (reported values)
- `check.js:8964` `out['nav display'] = ... '.ol-hdr .ol-nav'` (reads display only, no count)
- `tracker/tests/ui.test.js:186` `.nav-menu > .nav-link` count 0 (Tracker menu, not the shell)
- `tracker/tests/ui.test.js:197` and `:200` `.nav-folder` groups (Tracker menu)
- `tracker/tests/one-look.test.js:114` module list of six `data-module` ids; `:115` labels (six)

## Q: every test and check that reads the Tracker's Market Board, `mlist`, `mbadd` or a universalis request from the Tracker

- `mlist`: not found in `tracker/command-center/check.js`, `tracker/tests`, `crafting/atelier/tests`, `crafting/tests`.
- `mbadd`: `tracker/tests/ui.test.js:833` (`[data-mbadd]` click).
- Market Board: `tracker/tests/ui.test.js:799` (test "Hunts, Market Board, Housing and News ..."), asks at `:809` (`universalis.app/api/v2/North-America/...`) and `:840` (external hosts `paissadb.zhu.codes`, `universalis.app`).
- `tracker/tests/lists-data.test.js:540` (`MARKET(id)`, a data check, no request).
- `tracker/command-center/check.js`: about 40 `page.route('https://universalis.app/**')` stubs or request reads. Lines: 2405, 2661, 2791, 4281, 4583, 4636, 4725, 4780, 4806, 4847, 4937, 4977, 5015, 5040, 5077, 5113, 5128, 5197, 5237, 5277, 5311, 5803, 6717, 7712, 8300, 8765; and external-host asserts at 7866, 7898, 7939, 7984, 8030, 8052, 8104, 8140, 8175, 8409, 8515, 8751. I did not map each line to its check id or page, so the per-page attribution is not done.

## Q: how Lists unpacks `LISTS_DATA_PACKED`

- `tracker/command-center/src/lists/lists.js:251`: `window.LISTS_DATA ? Promise.resolve(window.LISTS_DATA) : CC.unpack(window.LISTS_DATA_PACKED).then(JSON.parse);`
- `CC.unpack` is defined at `tracker/src/core/save.js:704`: `new TextDecoder().decode(await pipe(unb64(...), new DecompressionStream('deflate-raw'), limit || 256MB))`.
- The packing is in `tracker/command-center/build.js:134` (`zlib.deflateRawSync`, base64).

## Q: the data centers with worlds in `live.json`, by region

Source: `tracker/data/live.json`, keys `dc` (regions) and `worlds`.

- North America (`dc`): Aether, Crystal, Dynamis, Primal. Worlds keyed: Aether 8, Crystal 8, Dynamis 8, Primal 8.
- Europe: Chaos, Light, Shadow. Worlds keyed: Chaos 8, Light 8. Shadow has no `worlds` key.
- Japan: Elemental, Gaia, Mana, Meteor. Worlds keyed only under `Elemental` (32 worlds, covering the four Japanese DCs). Gaia, Mana, Meteor have no key of their own.
- Oceania: Materia. Worlds keyed: Materia 5.
- Total worlds in `worlds`: 85.

## Q: where the Tracker's and the Atelier's hosted-only code adds the Main menu

- Tracker: `tracker/src/app/ui.js:1343-1358`. Line 1345 `if (!HOSTED || !('serviceWorker' in navigator)) return;`; line 1356 "the Main menu, with the app's pages beside it"; the back link is inserted at 1359 (`hin.insertBefore(back, hin.firstChild)`). `HOSTED` is defined at `ui.js:19`.
- Atelier: `crafting/atelier/src/atelier.js:1624` `if (!HOSTED || !('serviceWorker' in navigator)) return;`; `:1651` comment; `:1654` `back.className = 'ol-menu cc-back'`.
- Content policy: none found. Searched for `Content-Security-Policy` in html, js, json, `_headers` and yml: no matches.
- Service worker rules: the Command Center worker `tracker/command-center/src/sw.js:94` `if (url.origin !== self.location.origin) return;` passes cross-origin requests (including `universalis.app`) straight to the network. The Tracker worker `tracker/site-src/sw.js:17` does the same. Nothing refuses a script from the Command Center folder.

## Q: whether `checks.yml` uses `fetch-depth: 0`

- Yes: `.github/workflows/checks.yml:21` `fetch-depth: 0`.

## D32 (answered from the code, not run in a browser)

Facts used: `CC.VERSION = 1` at base (`tracker/src/core/save.js:17`). `CC.checkDoc` throws code `'newer'` for `doc.v > CC.VERSION` (`save.js:209`, message "This save was written by a newer version of the app. Reload the page to update."). `CC.emptyDoc` writes `CC.VERSION` (`save.js:216`).

**Tracker, on opening (v: 2 save).** `tracker/src/core/storage.js:204`: `CC.checkDoc` throws; `rescue()` (`storage.js:92-96`) keeps a copy under a `main-unreadable-…` key; `loadState` returns null. `ui.js:1317` then calls `loadProblemDialog()` (`ui.js:1294-1301`): heading "Saved data could not be read"; text "The tracker found saved data on this device but could not read it (This save was written by a newer version of the app. Reload the page to update.). A copy has been kept. Download it first so nothing is lost, then load a backup, use cloud sync, or start fresh."; buttons "Download the unreadable data" and "Continue".

**Tracker, on its next save.** `storage.js:269` rethrows the `'newer'` error, so the save is refused (`storage.js:279` `return done(false)`). `ui.js:1261-1265`: toast "This browser did not let the tracker save. Save a backup file now (Settings → Import and backup)." and sync line "Not saved on this device: save a backup file".

**Atelier, on opening.** `crafting/atelier/src/atelier.js:131`: `SH.problem = e.message` (the newer-version message); the page shows the old local section (`applySection(sectionFromOld(...))`). No visible text found: `SH.problem` is not rendered anywhere in `atelier.js` (only set at 131, 146, read at 151).

**Atelier, on its next save.** `atelier.js:151` `if (!CC || !SH.ready || SH.problem) return` in `writeShared` (`:149`): nothing is written and no text is shown. Not verified whether edits still update the old local key.

**Lists, on opening.** `tracker/command-center/src/lists/lists.js:258` sets `SH.problem`; `:1272` shows "The save cannot be used here." + the message + " Nothing has been written over it."

**Lists, on its next save.** The write (`CC.writeSection`, `save.js:571`) throws the newer message; `lists.js:299-306` re-reads (which also throws), sets `SH.problem = 'The saved data could not be reloaded after a refused save; reload the page to continue.'` and `SH.note = 'Not saved on this device: ' + message + ' ' + SH.problem`, then renders the `:1272` text with the note.

**Submersibles, on opening.** `tracker/command-center/src/submersibles/subs.js:76` sets `SH.problem`; `:229` shows "The save cannot be used here." + the message + " Nothing has been written over it."

**Submersibles, on its next save.** `subs.js:138-153`: same pattern as Lists; status line "Not saved on this device: <message> The saved data could not be reloaded after a refused save; reload the page to continue.", then the `:229` text.

**Settings, on opening.** `tracker/command-center/src/settings.js:26` sets `last = 'The save cannot be used here: ' + message`; shown in `.set-msg` at `settings.js:73`.

**Settings, on its next save.** `settings.js:214` throws the newer error; the character-count path (`settings.js:244`) calls `failed(e)` (`settings.js:173-174`): "Not saved on this device: This save was written by a newer version of the app. Reload the page to update."

**Home (shell), on opening.** `tracker/command-center/src/shell.js:59` catches the error and sets `doc = null`; no message is shown; the page shows the empty-save block ("Start here: cloud sync" or "Getting started"). Home does not save.

**Tracker sync after a refused cloud read.** No upload after a refused read. `tracker/src/core/cloud.js:198` `remote = await ET.readCloud(remote)` throws (`cloud.js:164` outer version above 2, `cloud.js:170` inner version above `CC.VERSION`) before any merge or upload; the uploads are at `cloud.js:193` (only when no cloud file exists, no read) and `cloud.js:228` (owner-chosen overwrite).

**Backup or transfer code.** Not merged silently. `tracker/src/app/ui.js:995` and `:1003` ask "Replace everything on this device with this backup/code (...)?" before `adoptLoaded`. The desktop-save file path (`ui.js:994`, `deskImport`) was not checked for a prompt. Format guards: `tracker/src/core/codec.js:41` (`BACKUP_V = 1`, `codec.js:6`) and `:124`.

**Cached copy updates (reading only, not run).**
- Shell (Command Center worker, `tracker/command-center/src/sw.js`, cache name carries BUILD at `:18`): the page calls `reg.update()` on opening and when visible (`shell.js:18-22`); no reload on takeover found in `shell.js`. Result: 1 reload (the next opening) to run new shell code.
- Submersibles: same worker; `subs.js:1977-1981` reloads the page once on `controllerchange` unless busy (guarded by `sessionStorage`). Result: no manual reload needed.
- Lists: no `controllerchange` handler found in `lists.js`. Result: 1 reload.
- Tracker (`tracker/site-src/sw.js`, own worker): `ui.js:1348` registers; no `update()` call or reload found. Navigations are network first. Result: 1 reload.
- Atelier (`crafting/atelier/site-src/sw.js`): navigations network first, other requests cache first. `atelier.js:1627` registers; no reload found. Result: 1 reload.

## D33/D34

- `lists/store.js` loads on a page without the Lists page: yes. It is an IIFE attaching `globalThis.LISTS` (`store.js:13-15`); `globalThis.CC` is read inside functions (`store.js:41`). Checked in Node: `require(store.js)` with no CC and no window gives `LISTS.store` as an object. Only `tracker/command-center/src/lists/index.html:42` includes it.
- `S.bought` (`store.js:331-345`) returns the section and entry from `s.finish('Bought it')` (`store.js:61`), plus `capped: true` when a count was kept at 999,999 (`store.js:337`; check at `:61`). Shape: `{ section, entry, capped? }`.
- Look spec states page (section 9 added states): `docs/bourse/mock/states.html` has "made without" (1), "approximate" (1), "quick split" (1), "the only listings" (1), "without a home price" (1). Not found: the "to check" row, the no-Web-Locks line, and the copy's line. The section 9 text is in `docs/bourse-spec.md:557-570`; the look spec is `docs/bourse-look-spec.md` (it has no section 9).

## Escalate-if check

- No suite failed.
- Gates not in base: the one-look rules pull request and module moves are not in `d7322c7`. Reported as expected (per B0).
- Old copy writing over a v2 save: none found in the code paths above (every write path checks `CC.checkDoc` and refuses the newer version; the Tracker's cloud read refuses before uploading).
- `store.js` running outside the Lists page: no (Node load check above).
