# Independent Lists review

Verdict: do not publish — the review is partial and a recording path can erase a stock count.

## Findings

### BLOCKER — Recording a craft can erase existing stock

`tracker/command-center/src/lists/store.js:314`, with validation at `tracker/src/core/save.js:182`.

When a recorded craft takes a product count above 999,999, the store applies the result and normalizes it; the checker drops the out-of-range field rather than refusing the edit. The player loses the recorded count for that quality, while the target's crafted progress and material changes can still be saved. In a direct Node reproduction using the actual engine, store and checker, 999,999 ordinary items plus one crafted item produced `{hq:0,coll:0}` and `crafted:1`. The previous 999,999 is gone from the returned section. The boundary is high, so frequency in ordinary play is unknown; the consequence is silent loss of player data.

Fix: support the resulting count or reject the entire operation with a clear explanation before changing stock, materials or progress. Test the boundary for each quality and multi-yield crafts.

### MAJOR — Recording one recipe credits another

`tracker/command-center/src/lists/lists.js:847`, called at line 922; related display at line 331.

The page credits any unfinished must-craft target for the same item, without checking the recipe of the selected craft line. The shipped game data contains item 5056 with recipes 1 and 170. If the target for recipe 1 comes first and the player records recipe 170, the first target receives the credit. A list built from the crafting log can therefore mark the wrong recipe crafted and continue asking for the one actually made; material needs are wrong. The page's `lineFor` also picks the first matching part without matching its recipe, so wanted rows can describe the wrong line.

Fix: resolve targets to the same recipe used by the planner, match the selected recipe when crediting and displaying, and exercise two real recipes of one product through the page. The model test constructs its own credits filtered by recipe (`tracker/tests/lists-model.test.js:444`), so it does not cover the page's credit selection.

### MAJOR — Must-craft output is recorded in the wrong quality

`tracker/command-center/src/lists/lists.js:923`, with the make-line quality in `tracker/command-center/src/lists/engine.js:256`.

The page passes the make line's ordinary quality to recording even when a wanted item is marked high quality or collectable. The line groups targets by item and recipe and offers no output-quality choice. The wanted row also prefers the line's ordinary quality over the target flag. Recording a high-quality or collectable craft thus increases ordinary stock, and other lists can show incorrect stock and material totals.

Fix: let the player record the quality actually made, with a clear default from the target where possible; handle mixed-quality targets on a line and show/edit the correct quality on wanted rows. Add page-level tests for both qualities.

## What was checked and what remains

The candidate and base are `ad41b595b2eac9ec36d3e8dc58baabf36b4ecde2` and `31cb0ba3a104eeb4c29809a4585421a7fa99e8b4`. The assignment's design, save and sync changes, shared price extraction, planner and store logic, and relevant page paths were inspected selectively. The merge retains removed-against-changed Lists units for an answer, has a whole-list conflict path, and the existing free-company and slot code is not changed by the Lists pass. The old-build preservation checks and the store's transactional undo expectation are present. The Submersibles price service retains its storage keys, query, reply reading, cache rules and gate in the extraction; Lists gates automatic attempts and coalesces a follow-up. The inspected hash handlers parse constrained identifiers and open screens; the inspected player and data text rendering uses escaping. These observations are limited to the paths inspected, not a proof of safety.

The complete unit command `npm run test:unit` passed in an isolated checkout with the necessary history. `npm ci --ignore-scripts --no-audit --no-fund` succeeded there with a temporary npm cache. The stock-boundary example above was also run directly. Browser checks were not run. The review did not finish a line-by-line examination of all requested tests and browser checks, all page rendering and event paths, the data generator and cross-check, build and service-worker integration, or every save and sync scenario. No claim is made that remaining tests can fail or that no other defect exists. The removed existing test lines inspected correspond to renaming the unrelated stand-in Lists section to Notes; module and card count adjustments were also observed. Further independent review is needed before a publish decision.

## Decision options

- Keep the site as it is and hold this change: players retain the existing site and avoid these new failures. It costs delay, whose length is unknown; players give up the new planner for now. Existing site risks remain, with odds unknown. Confidence: high that holding avoids introducing this candidate's defects.
- Fix the findings and finish the missing review and browser checks, then reconsider publishing: this addresses the demonstrated problems and reduces the chance of an overlooked failure. Time and effort are unknown; further defects may still remain, with odds unknown. Players wait longer for the planner. Confidence: high that the demonstrated failures need targeted regression checks; publication safety remains unproven.
- Publish the candidate now: players get the planner immediately, with no repair delay. They accept the demonstrated stock loss and incorrect craft accounting, and any missed problems; frequency and potential recovery effort are unknown. They give up the protection of completing fixes and review first. Confidence: high in the code paths identified; the stock-boundary failure was reproduced.

Recommendation: hold publication, fix the findings, and complete the outstanding review because player stock can be lost.

Technical: PR #4; candidate `ad41b595b2eac9ec36d3e8dc58baabf36b4ecde2`; base `31cb0ba3a104eeb4c29809a4585421a7fa99e8b4`.
