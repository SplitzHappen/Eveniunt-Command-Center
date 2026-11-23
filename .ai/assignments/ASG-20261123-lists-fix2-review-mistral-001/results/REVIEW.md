# Independent fix-2 review — Lists module, PR #4 head `d9d03eb` (fixes after the review of the earlier fixes)

Reviewer: Mistral (outside the model family that wrote the fixes). Assignment ASG-20261123-lists-fix2-review-mistral-001.
Fix diff reviewed: `git diff 1b7641f..d9d03eb` (11 files, +618/−252): `src/lists/lists.js`, `src/lists/store.js`,
`check.js` (changed shared price wait + new C171–C174), `tests/lists-store.test.js` (ST-18), built copies, docs.
`save.js`, `merge.js`, `engine.js`, `prices.js`, `earn.js`, `subs.js` are **not in the diff**.

**Verdict: publish.** All four accepted findings are fixed, each pinned by a test I confirmed fails without the fix (ST-18
reproduced by me on the previous head; the page-level ones by the recorded browser checks plus my own Node replays of the same
logic against the real engine). No regression found, and I agree with the rejected view's ruling, with one caveat noted below.

---

## The four findings

| # | Earlier finding (fourth round, ChatGPT) | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | "Made"/"Made all" credits a wanted item whose quality the output cannot satisfy (a normal craft marks a high-quality item crafted) — major | **Fixed** | `lists.js` `creditsFor` now takes the made quality and groups targets: collectable output → collectable items only; high-quality output → high-quality items first, then ordinary; ordinary output → ordinary only; list-then-step order inside each group; leftover output stays in stock. Called with `madeQuality(...)` in the "Made" handler, so "Made all" is covered too. My Node replay on the fixture (real engine plan + real store record): with an hq and an nq target of one recipe, an ordinary-quality record under the old logic marks the hq target crafted (bug reproduced); under the new logic only the nq target is credited and stock goes to `nq`; hq output credits the hq target; multi-yield (yield 3) hq output across two lists credits the hq target first even when the ordinary list is earlier; collectable output credits only the collectable target. Browser check C171 pins all of these cases (either order, across lists, multi-yield, "Made all", collectable). |
| 2 | A finished recipe's wanted row borrows another recipe's line (shows its need and job) — major | **Fixed** | `lists.js` `lineFor`: a must-craft target now returns only its own recipe's line (`if (t.make) return found;`); when that line has left the plan, `renderRow` shows the row's own state ("crafted c of qty") plus its own recipe's job and level, never another line. Probe: with recipe 1001 crafted in full and recipe 1003 still needed, the plan holds only `101|make|1003`; the old `lineFor` returns that other line (need 3, recipe 1003 — the bug), the new one returns null for the finished target and its own line for the fresh one. Browser check C172 pins the finished row showing "crafted 1 of 1" and its own job/level, and the other row showing its own need. |
| 3 | A restored list always has no character, with no way to choose one — minor | **Fixed** | `store.js`: `restoreList` takes a validated character (default none; anything but `c1`–`c8`/none refused); new `setListChar` changes a list's character afterwards (same validation, no-op if unchanged), keeps every target field and stock untouched, and drops the list from the combined-view selection. `lists.js`: the Restored list card has a character select before "Put these in a new list", and the list bar's character is now a select; all option values/names escaped. Test ST-18 covers defaults, invalid ids, target-field preservation, the stock owner following, and the combined tick being dropped — **I ran ST-18 against the previous head `1b7641f` in a scratch worktree: it fails there; at this head it passes.** Browser check C173 pins the card's select, the restore with a chosen character, and the list-bar changes. |
| 4 | C166 still used the early-finishing price wait (same race as C155) — minor | **Fixed** | The only removed line in `check.js` is the old shared `lWaitPrices`; the new one (used by C155, C166 and C174) waits until every market price row has left both first texts ("Fetching", "Price not fetched") **and** the page reports no request in flight. C174 holds the stand-in reply back 700 ms and asserts the wait returns only with the fetched prices shown and exactly one request made. Verified by reading; not run here (no Chromium). |

## Step 3 — the rejected view (unchanged orphan removed by a sync after the player removed its list on the other device)

The reason given: in a three-way merge, the side that lacks the item had it at the last sync and has removed it since; older
builds keep the lists section byte for byte through their own saves (pinned by LY-8 and C145), so that absence comes from a
removal on that device — the player's own action — and the ordinary one-sided rule applies. **This convinces me for the
common case, and I agree with keeping the rule.** I re-probed the exact scenario at this head: unchanged survivor removed
without a question; changed or added survivors kept (changed one asked). One honest caveat, which the other reviewer also
raised: the merge inputs alone cannot prove *why* a side lacks a unit when an orphan is present, because a still-old build's
own sync can drop units on its own side (the documented known limit). But every such drop traces back either to an explicit
removal somewhere or to that documented old-build limit, and the new builds never delete a lists unit without an explicit
choice or while a question is open — so the rule never deletes anything the player did not choose to delete. Keeping it is
right; the caveat stays recorded as a known limit (spec section 4).

## Regressions checked (step 4)

- `save.js`, `merge.js`, `engine.js` are not in the fix diff — save/sync rules and the planning engine unchanged. Submersibles
  prices (`prices.js`, `earn.js`, `subs.js`) untouched; `prices.test.js` (6) and `earn.test.js` (16) pass.
- Owner's rules: gil merchant first at every level — engine untouched, `lists-engine.test.js` (43) and `lists-model.test.js`
  (45) pass. "Bought it" any time with nothing gathered lost — `bought` unchanged this round (stock-only addition, make flag
  cleared on the row's own recipe's targets only, from the previous round).
- Page escaping: the new markup (character selects, own-state line) escapes every id and name; select values are character
  ids or empty. No new links, timers or fetches.
- Existing tests/checks: the only edit is the one permitted shared price wait; the test diff is a pure addition (ST-18);
  the built site copies match the sources byte for byte; `site/sw.js` differs only in the build hash.
- Unit suites I ran at this head, all green: `lists-store` (18), `lists-data` (14), `lists-engine` (43), `lists-model` (45),
  `core` (163), `prices` (6), `earn` (16), `submarines` (144).

**What I ran, plainly:** the unit suites above directly with Node (no `npm ci` needed — `node_modules` only holds the
browser-test package), plus probes: ST-18 executed against the previous head in a scratch worktree (fails there, passes here),
and Node replays of the credit-allocation and row-lookup logic against the real engine and store on the shipped fixture,
including a reproduction of both bugs under the old logic. I did **not** run `npm run test:browser`, the Atelier tests, or
`npm run check` (Playwright's Chromium is not installed here), so C171–C174 and the C166 wait are verified by reading and by
the logic replays, not by execution.

## The choice for the owner (every real option, including keeping things as they are)

1. **Publish now (recommended).** What happens: the Lists module ships with all four second-round findings fixed and pinned
   by tests, on top of the seven from the round before. What it improves: craft credits now always match the quality made,
   finished rows show their own recipe, restored lists can be given a character, and the price checks can no longer pass on a
   race. What it costs: nothing further. Risk left: the usual unproven remainder — no review proves the absence of other
   defects; odds unknown, but 577 unit tests and the model test give good cover. What you give up: another review round.
   How sure I am: high that the four fixes are correct and complete (ST-18 shown to fail without its fix; the other three
   verified by logic replays and the recorded browser checks).
2. **Run your own manual checks first (a real two-device sync, two tabs saving at once, a phone), then publish.** As option
   1, after the checks no automated run covers. What it costs: your time, length unknown. Risk left: the same unproven
   remainder. What you give up: publishing today. How sure I am: high that the checks are worth doing; they are already your
   stated next step.
3. **Hold for another outside review round.** What happens: the change waits; players keep the current site. What it
   costs: delay, length unknown. Risk left: this round found nothing to hold for. What you give up: the planner for now.
   How sure I am: high that the fixes hold; low that another round is the best use of the time.

**Recommendation: option 1 (publish now).** One plain reason: every finding from the review of the fixes is closed with a
test that demonstrably fails without it, and nothing outside those fixes changed — the save, sync and engine code are
untouched, so there is nothing new for another round to catch.

Technical: assignment `ASG-20261123-lists-fix2-review-mistral-001`; PR #4 head `d9d03eb528e72ec0fab5f0777e6d9c795e7ca959`, previous head `1b7641f3cbceecc467f73e961ce106844fd6c696`, base `31cb0ba3a104eeb4c29809a4585421a7fa99e8b4`; fixes in `tracker/command-center/src/lists/lists.js` (`creditsFor`, `lineFor`, `renderRow`, `charOptions`, restore/listbar handlers), `tracker/command-center/src/lists/store.js` (`restoreList`, `setListChar`), `tracker/command-center/check.js` (`lWaitPrices`, C171–C174), test `tracker/tests/lists-store.test.js` (ST-18); rulings in `docs/lists-code-review-adjudication.md` "Fourth round", previous fix reviews on branches `assignments/ASG-20261122-lists-fix-review-chatgpt-001` and `assignments/ASG-20261122-lists-fix-review-mistral-001`.
