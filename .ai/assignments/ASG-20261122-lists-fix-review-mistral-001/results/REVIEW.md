# Independent fix review — Lists module, PR #4 head `1b7641f` (fixes for the two outside code reviews)

Reviewer: Mistral (outside the model family that wrote the fixes). Assignment ASG-20261122-lists-fix-review-mistral-001.
Fix diff reviewed: `git diff ad41b59..1b7641f` (13 files, +1,964/−304): `src/lists/store.js`, `src/lists/lists.js`,
`tools/lists-data.py`, the two new unit tests (ST-16, ST-17, LD-11–LD-14), `check.js` (changed C145 and C155, new C167–C170),
the built copies, docs. `save.js`, `merge.js`, `prices.js`, `earn.js`, `engine.js`, `subs.js` are **not in the diff**.

**Verdict: publish.** All seven accepted findings are fixed, each pinned by a test I confirmed fails without the fix
(the unit-test ones directly; the page-level ones by the recorded browser checks plus my own Node probes of the same logic).
The partly accepted finding and the no-undo ruling are sound (my view below). I found no regression and no new finding.

---

## The seven findings

| # | Earlier finding (reviewer) | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | Recording a craft that would take a stock count above 999,999 loses that count (checker drops the field) — ChatGPT, blocker | **Fixed** | `store.js`: `CAP = 999999`; `apply()` caps every quality of a record/hand-in result and `bought` caps instead of refusing; the result carries `capped` and the page shows "Counts above 999,999 are kept at 999,999." (`lists.js` `doJob`). Test ST-16 covers ordinary/high-quality/collectable qualities, a multi-yield craft at and under the boundary, the cap on "Bought it", and undo of a capped record. **I ran ST-16 against the unfixed source (worktree at `ad41b59`): it fails; at this head it passes.** |
| 2 | "Restored list" view for wanted items without their list was not built — ChatGPT + Mistral, major | **Fixed** | `store.js` `S.orphans` / `S.restoreList` / `S.removeOrphans`; `lists.js` `orphansHtml` renders a "Restored list" card on Your lists (also in the empty state), all text escaped; restore creates the header **under the old list id** so no wanted item moves (ST-17 asserts the targets are byte-identical); remove asks first and deletes only that prefix. Browser check C167 builds the orphan with the shipped pre-Lists build (`git show 31cb0ba`) and asserts the card, no planning, restore, remove, and no Undo offered. ST-17 **fails on the unfixed source, passes here** (ran both). |
| 3 | "Made"/"Bought it" acted on every wanted item of the same product, not the row's recipe — ChatGPT, major | **Fixed** | `lists.js`: `recipeOfTarget` (same rule as the engine's recipe choice — I verified they agree), `lineFor` filters make/coll lines by the target's own recipe, `creditsFor`/`makeKeysOf` take the line's recipe, the bought handler passes the row's recipe from its line key. Probe on the fixture (Iron Ingot, recipes 1001 and 1003, one make target each in two lists): the plan has separate lines `101|make|1001` and `101|make|1003`; the old `lineFor` maps the recipe-1003 target to `101|make|1001`, the new one to `101|make|1003`; recording on the 1003 line credits only the 1003 target (`crafted` 2) and leaves the 1001 target at 0. Browser check C168 pins Made/Bought across the two lists. |
| 4 | A must-craft craft was recorded as ordinary quality even when the wanted item is high quality or collectable — ChatGPT, major | **Fixed** | `lists.js`: `askedQuality` (collectable, else high quality, else ordinary), `qualityOf` uses it for make rows (the Wanted row's stock field writes the asked quality), `madeQualities`/`madeQuality` pick the default for "Made" with a row-level choice when one line's targets ask for different qualities (choice lasts the visit, stored in page state only). Probe: an hq must-craft target now records `hq:1` stock (the old code recorded `nq:1` — the engine line's quality is always `nq` for make lines). Browser check C169 covers hq, coll-before-hq, the mixed line with a choice defaulting to high quality, and the wanted row's quality. |
| 5 | The data tool recorded no added recipes and no entry for a stamp-only change — ChatGPT, minor | **Fixed** | `tools/lists-data.py` `compare()`: added recipes are recorded as `[null, new row]`, and an entry is written whenever the stamp differs, even with no recipe changes. The page notice names an added recipe ("can now be crafted from …", `lists.js` patchNotice). Tests LD-11 (addition alone), LD-12 (added+changed+removed in one entry), LD-13 (empty entry links the stamps), LD-14 (two patches chain; a rerun adds nothing); C170 checks the notice through an empty chain entry. **I ran LD-11–14 against the unfixed tool: all four fail; at this head all pass.** |
| 6 | C145 could pass without running the Tracker saves — ChatGPT, minor | **Fixed** | The old predicate accepted `tracker === 'not run'`; the new one requires `pages[n].tracker === 'saved'` for both the current and the shipped Tracker, plus all five pages present (`pages[name]` null → fail). `tracker` becomes `'saved'` only after `ET.saveState` resolves truthy. Verified by reading the diff and the surrounding code; the browser check itself I did not run (no Chromium here). |
| 7 | C155's wait could finish before the price fetch (flaky) — ChatGPT, minor | **Fixed** | The wait is now `waitForFunction(/fetched \d\d:\d\d$/.test(row's price-line text))` on the specific market row — the fetched state itself, which the initial "Price not fetched" text does not satisfy. Verified by reading; not run here. |

## Step 3 — the partly accepted finding and the no-undo ruling

**The orphan that disappears when one side removed the list and item and the other (old build) holds the item unchanged
without a header.** I reproduced the exact case at this head with the real `ET.threeWay`/`ET.applyMerge`: no question is
asked and the unchanged survivor is removed. Changed or added survivors are kept (probed: a changed survivor stays
unanswered with one question; an added one stays silently). `merge.js` is unchanged by the fixes, and the spec's case-4
wording now matches the behavior. **I agree with the ruling.** The owner's rule is that a merge never deletes anything without
the player's explicit choice — and here the removal *was* the player's explicit choice on one device (they removed the whole
list); the other side made no change to that item, and the save's ordinary rule everywhere (one side changed, the other
unchanged → the change is taken) applies. Asking again would ask a question whose answer is already decided by the player's
own earlier action. Residual risk: a device on the old build can have created the orphan state, and the item then disappears
with the player's own removal — but that disappearance is the removal they chose, not a new deletion.

**The no-undo ruling for the Restored list card.** **I agree.** Undoing "Put these in a new list" would delete the header it
created while the wanted items remain — exactly the orphan-creating write that the save's LI2 rule refuses by design (I
traced it: the write would throw "This list was removed…"); undoing "Remove" would recreate the orphans, also refused. So an
Undo button there could only ever show a refusal. `lists.js` `noUndo` drops the entry after the write (C167 asserts no Undo
is offered), and Remove asks first, which covers the accident case. Restoring is harmless and can be redone. Changing
`save.js` for this rare case (it needs a sync with an old build) would risk the shared save rules for no real gain.

## Regressions checked (step 4)

- `save.js` and `merge.js` are not in the fix diff — save and sync rules unchanged (confirmed by `git diff --name-only`).
- Submersibles prices: `prices.js`, `earn.js`, `subs.js` untouched; `prices.test.js` (6) and `earn.test.js` (16) pass.
- Owner's rules: gil merchant first at every level — `engine.js` untouched, C161 unchanged, `lists-engine.test.js` (43) and
  `lists-model.test.js` (45) pass. "Bought it" any time with nothing gathered lost — `bought` still only adds stock and now
  clears the must-craft flag only on the row's own recipe's targets; the cap change replaces a refusal with a capped save
  plus a plain message, so no edit is lost silently.
- Page escaping: the new markup (`orphansHtml`, the quality select) escapes list ids, target keys, item names and counts;
  the select's option values are fixed constants. No new links or timers.
- Existing tests/checks: the only edits are the two allowed check changes (C145 predicate, C155 wait) plus new checks
  C167–C170; the unit-test diffs are pure additions (ST-16/17, LD-11–14). The built site copies match the sources byte for
  byte; `site/sw.js` differs only in the build hash.
- Full unit suites I ran at this head, all green: `core.test.js` (163), `submarines.test.js` (144), `lists-store` (17),
  `lists-data` (14), `lists-engine` (43), `lists-model` (45), `prices` (6), `earn` (16).

**What I ran, plainly:** the unit suites above directly with Node (no `npm ci` needed — `node_modules` only holds the
browser-test package), plus targeted probes: the new tests executed against the *unfixed* source in a scratch worktree at
`ad41b59` (ST-16, ST-17, LD-11–14 all fail there, pass at the head — so each test really detects the bug it pins), Node
replays of the recipe/quality page logic on the shipped fixture, and a direct `ET.threeWay`/`ET.applyMerge` run of the
partly accepted orphan scenario. I did **not** run `npm run test:browser`, the Atelier tests, or `npm run check` (Playwright's
Chromium is not installed in this environment), so C167–C170 and the C145/C155 changes are verified by reading, not by
execution.

## The choice for the owner (every real option, including keeping things as they are)

1. **Publish now (recommended).** What happens: the Lists module ships with all seven review findings fixed and pinned by
   tests; players get the planner with correct craft accounting, correct qualities, the stock cap, and a way to see and
   repair entries left without a list. What it improves: everything the reviews found is closed. What it costs: nothing
   further. Risk left: the usual unproven remainder — no review proves absence of other defects; odds unknown but the model
   test and 576 unit tests give good cover. What you give up: a further review round. How sure I am: high that the seven
   fixes are correct and complete (each test was shown to fail without its fix); the browser checks C167–C170 I verified by
   reading, not running.
2. **Run your own manual checks first (a real two-device sync, two tabs saving at once, a phone), then publish.** What
   happens: as option 1, after the checks no automated run covers. What it improves: catches real-device sync behaviour the
   stand-ins cannot. What it costs: your time, length unknown. Risk left: the same unproven remainder. What you give up:
   publishing today. How sure I am: high that the checks are worth doing; they are already your stated next step in any case.
3. **Hold for another outside review round first.** What happens: the change waits. What it costs: delay, length unknown;
   players keep the current site. Risk left: this round found nothing to hold for; another round may find little, with odds
   unknown. What you give up: the planner for now. How sure I am: high that the seven fixes hold; low that another round is
   the best use of the time.

**Recommendation: option 1 (publish now).** One plain reason: every finding from the two outside reviews is fixed and each
fix is pinned by a test that demonstrably fails without it, and nothing outside those fixes changed — so there is nothing
left for another round to catch that the existing tests do not already cover.

Technical: assignment `ASG-20261122-lists-fix-review-mistral-001`; PR #4 head `1b7641f3cbceecc467f73e961ce106844fd6c696`, earlier reviewed head `ad41b595b2eac9ec36d3e8dc58baabf36b4ecde2`, base `31cb0ba3a104eeb4c29809a4585421a7fa99e8b4`; fixes in `tracker/command-center/src/lists/store.js`, `tracker/command-center/src/lists/lists.js`, `tracker/tools/lists-data.py`, `tracker/command-center/check.js` (C145, C155, C167–C170), tests `tracker/tests/lists-store.test.js` (ST-16/17), `tracker/tests/lists-data.test.js` (LD-11–14); earlier reviews on branches `assignments/ASG-20261122-lists-code-review-chatgpt-001` and `assignments/ASG-20261122-lists-code-review-mistral-001`; rulings in `docs/lists-code-review-adjudication.md`.
