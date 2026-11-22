# Independent Lists review

Verdict: **do not publish**. One recording path can erase stock, and sync and planner defects need fixes before publication.

## Findings

### BLOCKER — Recording a craft can erase existing stock

`tracker/command-center/src/lists/store.js:314`, with validation at `tracker/src/core/save.js:182`.

When a recorded craft takes a product count above 999,999, the store applies the result and normalizes it; the checker drops the out-of-range field instead of refusing the edit. The player loses the recorded count for that quality while the crafted progress and material changes can still be saved. A direct Node run of the actual engine, store and checker started with 999,999 ordinary items and a yield-one must-craft target. Recording one returned stock `{hq:0,coll:0}` and `crafted:1`. The boundary is high and the frequency is unknown; the consequence is silent loss of recorded player data.

Fix: support the resulting count or reject the whole operation clearly before changing stock, materials or progress. Test every quality and multi-yield crafts at the boundary.

### MAJOR — An orphaned wanted item can disappear during sync

`tracker/src/core/merge.js:207`; the generic merge is at lines 87–88.

Start with a shared list and item. One device removes the whole list and item; the other lacks the list header but still holds that unchanged item, a state the design allows an older build to leave. Both headers are missing, so the Lists pass skips the case. The generic merge takes the one-sided item removal. A direct run of `ET.threeWay` and `ET.applyMerge` returned no item and no conflict with no answer supplied. The design's both-headers-missing case says wanted items held by either device stay. The earlier whole-list removal was a player action; the surviving orphan on the other side is nevertheless removed without the separate handling the design requires.

Fix: handle that case explicitly, preserve surviving items and retain normal value conflict handling. Test both orientations and a repeat sync. The existing case-4 tests cover changed or added survivors, while the model accepts this unchanged survivor as an ordinary one-sided removal.

### MAJOR — The page hides retained items without headers

`tracker/command-center/src/lists/lists.js:738`.

The spec promises a “Restored list” for wanted items left without headers by an older build. The home page enumerates only headers, and the planner likewise starts from headers. In the built page, a valid saved orphan remained in `__lists.section().targets`, but the screen said “No lists yet” and offered no way to reach it. Players cannot see, plan, restore or remove the retained item through the page. The old-build tests check the saved section but do not check this recovery screen.

Fix: expose orphaned items in a recoverable view with explicit, safe restore and removal actions, and test the real page with an orphan from an old-build sync.

### MAJOR — Recipe-specific actions affect other recipes for the same item

`tracker/command-center/src/lists/lists.js:847`, with the purchase handler at lines 854–856 and 905–911 and row lookup at line 331.

The built game data has Bronze Ingot as recipe 1 and recipe 170. In a browser, with an unfinished must-craft target for each, “Made 1” on recipe 170 credited recipe 1. In a separate run, “Bought it” on recipe 170 cleared the must-craft flag from both targets. The page filters targets by item rather than the selected recipe; the wanted-row lookup also takes the first matching part. A crafting-log list can therefore show the wrong recipe completed or stop requiring another recipe, and the material totals can be wrong.

Fix: resolve targets to their actual planned recipe and apply credits, flag changes and row lookup to the selected line only. Test duplicate-product recipes across lists. The model test constructs credits already filtered by recipe (`tracker/tests/lists-model.test.js:444`), so it bypasses the page's selection.

### MAJOR — Must-craft output is recorded in the wrong quality

`tracker/command-center/src/lists/lists.js:923`; `tracker/command-center/src/lists/engine.js:256`.

A make line is always labeled ordinary quality and the page passes that quality to recording, even when the wanted item is marked high quality or collectable. A browser run with one high-quality must-craft Bronze Ingot target and “Made 1” saved `crafted:1` and ordinary stock 1, high-quality stock 0. The wanted row also favors the line's ordinary quality over the target flag. Other lists can consequently use or request the wrong stock.

Fix: let the player record the quality actually made, with a sensible target-based default and support for mixed-quality targets on a line. Show and edit the appropriate quality on wanted rows. Test both high-quality and collectable cases in the page.

### MINOR — Patch history omits new recipes and empty transitions

`tracker/tools/lists-data.py:127`.

The comparison records changed existing and removed recipes, but not added ones; it emits no history entry when only the stamp changes. A direct call with one unchanged old recipe and one new recipe returned no entry. If a patch also changes another recipe, the entry contains only the changed one. A future notice can therefore miss a newly craftable item in the list's tree, or fall back to a generic notice because a stamp transition is missing.

Fix: record added recipes with a missing old row and preserve a link for each stamp transition, even with no recipe differences. Test additions alone, mixed changes and multiple patches.

### MINOR — Compatibility check can pass without running the Tracker save

`tracker/command-center/check.js:5649`.

The check claims to verify that both current and old Tracker saves preserve the Lists section. The variable starts as “not run” when Tracker save functions are unavailable, and the final predicate explicitly accepts that value for both Tracker pages. Thus that portion can pass without performing the save it claims to cover.

Fix: require the functions and a successful Tracker save for both Tracker pages, then compare the saved Lists section byte for byte.

### MINOR — Price-check wait can finish before the fetch

`tracker/command-center/check.js:6186`.

The focused browser run failed C155 only on its fetch-time assertion; the same check passed on an isolated retry. Its wait accepts any row text without “Fetching,” including the initial “Price not fetched” text. The page constructs the row before starting the request, so this is a plausible timing race. The failed run did not capture the actual text, so the exact cause of that failure is not established. This can make release checks flaky.

Fix: wait for the expected fetched value or an explicit completed-request state before checking the price and request count.

## Review coverage and checks

Reviewed the candidate against the stated base, the design and accepted deviations, and existing save, merge, planner, page, price, data-generation, build and test code. The old-build preservation tests cover representative saves; the new checker preserves valid Lists records and stale writes use transaction-time undo expectations. The Lists removed-against-changed and whole-list conflict handling generally retains the changed unit until a choice, subject to the both-headers-missing case above. The existing free-company and slot merge passes are unchanged. The extracted Submersibles service retains the original storage keys, request, reply reading, freshness rules and attempt gate. The inspected link handlers constrain their identifiers; player and game text in the inspected rendering paths is escaped. The engine's merchant priority, quality partition, rounding, trade currencies, loop cuts and stock-allocation rules were checked against the spec and unit/model tests; the findings above limit the overall conclusion. No review proves the absence of other defects.

Existing test edits were examined: the unrelated stand-in section was renamed from Lists to Notes in the core and Submersibles tests, and existing shell checks changed module/card counts. New unit, model, page and browser checks were examined, including the weaknesses noted above.

In an isolated checkout with the candidate history, `npm ci --ignore-scripts --no-audit --no-fund` succeeded using a temporary cache, and `npm run test:unit` passed. `npm run test:browser` passed all 61 tests after installing Chromium in temporary storage; its initial attempt could not launch because the browser binary was missing. Focused Command Center checks C145–C166 and L2 passed 22 of 23 on the first run: C155 failed only its fetch-time assertion, then passed alone on retry. A broader Command Center run was stopped after the relevant focused run was chosen; it was not completed. Independent Node and browser reproductions produced the findings above. The user's actual devices and live cloud service were not tested.

## Decision options

- **Keep the site as it is and hold this change.** Players retain the existing site and avoid the candidate's new failures. It costs delay, whose length is unknown; players give up the new planner for now. Existing site risks remain, with odds unknown. Confidence is high that holding avoids introducing these candidate defects.
- **Fix the findings and verify the fixes before reconsidering publication.** This addresses the demonstrated failures and reduces the chance of their return. Time and effort are unknown; other defects may remain, with odds unknown. Players wait longer for the planner. Confidence is high in the reproduced failures; safety after changes requires fresh verification.
- **Publish the candidate now.** Players get the planner immediately, with no repair delay. They accept the demonstrated stock loss, inaccessible or removed orphaned items, and incorrect craft accounting, plus any missed problems. Frequency and recovery effort are unknown; they give up fixing and verifying first. Confidence is high in the reproduced failures.

Recommendation: hold publication, fix the findings, and verify the fixes because recorded player data can be lost.

Technical: PR #4; candidate `ad41b595b2eac9ec36d3e8dc58baabf36b4ecde2`; base `31cb0ba3a104eeb4c29809a4585421a7fa99e8b4`.
