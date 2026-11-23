# Independent review of the second Lists fixes

Verdict: **publish after fixes**. The four specific fixes hold in the requested cases. The new character selector exposes a reproducible stale-write path that can erase a step added in another tab.

## Four accepted findings

| Earlier finding | Assessment | Evidence |
| --- | --- | --- |
| A craft credits a target of an incompatible quality | **Fixed** | The page filters credits by output quality: ordinary to ordinary, high-quality to high-quality then ordinary, collectable to collectable. C171 covers both orders, separate lists, multi-yield output, “Made all” and collectables. It passes at the candidate and fails when only the quality filter is removed, although that mutation stopped at a later selector timeout rather than reporting its individual assertions. |
| A completed wanted row borrows another recipe's line | **Fixed in the reported case** | A completed make target no longer falls back to another recipe; C172 passes and fails with the earlier page. A separate no-recipe fallback regression is described below. |
| A restored list cannot be assigned to a character | **Fixed** | The card offers a character choice with no character as default, and the list bar permits changing it later. ST-18 and C173 check the choices and preserved targets; both fail with the earlier implementation. The concurrent-write risk of the new selector is described below. |
| The other price-table check waits too early | **Fixed** | The shared wait now requires every row to leave its initial state and the request to finish. C174 holds the reply back and passes; restoring the old wait makes C174 fail with the initial text. C166 also passed. |

## Findings

### MAJOR — Changing a character can erase a step saved in another tab

`tracker/command-center/src/lists/store.js:156`; the existing merge behavior is at `tracker/src/core/save.js:290`.

Using the real store and save transaction, two tabs start with the same list and one step. Tab B adds a second step and saves it. Tab A, still holding the older revision, changes the list from the first character to the second. Its write succeeds, but the saved list has only the original step. Undoing the character change restores the old character and still does not restore the added step. Wanted items referring to the lost step remain, but their step is no longer available.

The new operation rewrites the whole list header, including its steps. The existing merger treats that header as one unit and takes the later stale copy. This is an instance of the **documented same-unit last-write-wins limit**, not a change to the shared merge code; the new selector makes that data-loss scenario reachable through a character change.

Fix: refuse a stale character change when the header or combined selection changed, using a transaction-time condition, or apply only the requested field to the latest stored header atomically. Test concurrent step additions, renames and combined selection changes, including undo.

### MINOR — A valid no-recipe target can show the wrong wanted-row state

`tracker/command-center/src/lists/lists.js:345`.

A saved target can retain “must be crafted” with recipe 0 when no usable recipe exists; the engine's established fallback plans it as an ordinary item. With a valid saved target for Blunt Bastard Sword, quantity 2, recipe 0 and that flag set, the candidate's Wanted row says “crafted 0 of 2” while the plan buys two from a gil merchant. The earlier page showed “need 2” for the same state. Such a combination is accepted in saved or imported data; its frequency in ordinary play is unknown.

Fix: distinguish a completed make line from a target for which the engine falls back because no recipe is usable, and display the actual fallback need and its explanation. Keep the stored flag and test both cases beside another recipe of the same item.

### NOTE — Old-build merge behavior weakens the certainty of the orphan rationale

`tracker/src/core/storage.js:106` in the published old build; the current merge code is unchanged.

The ruling's stated premise is that an unchanged orphan absent from the other copy must reflect the player's own removal because old builds preserve the Lists section as plain data. I agree with taking a removal when that premise is known to be true, but byte-preserving validation alone does not prove the provenance of an absence: the old build also performs unattended merges.

In an isolated code-level experiment using the shipped old `ET.saveMerge`, the shared base had a list and a wanted item at quantity 1; the old local copy lacked both, while the stored copy had the header missing and the item changed to quantity 2. The old save merge returned no item without an answer. Separately, the current merge, with that quantity-2 orphan as base and local and the empty old result as remote, removed the orphan with no conflict. This demonstrates the relevant functions can produce the ambiguous states; I did **not** reproduce a complete real-device cloud sequence establishing how often they meet. The old behavior and the narrowing decision predate this fix.

A complete old-build two-device integration test would establish whether this sequence can be reached through the actual sync lifecycle. Until then, the reason does not fully convince me that every such absence proves an explicit choice.

## View on the rejected sync rule

The practical choices are:

- **Keep the present rule.** An unchanged orphan follows the other copy's removal without another question. This keeps sync simple and honors a known deliberate removal; no new work is needed. If the other copy's absence came from an earlier unattended merge, an item could instead be removed without a fresh choice; the odds and recovery effort are unknown. The owner gives up a further chance to retain it. Confidence is high in the current merge result, but limited about the origin of every old copy.
- **Keep the surviving orphan automatically.** The player retains the item and can later remove it. This avoids treating ambiguous absence as removal, but may bring back an item the player intended to delete. Implementation and testing effort, and the odds of either case, are unknown. The owner gives up automatic propagation of this removal. Confidence is high that the item would remain if correctly implemented.
- **Ask when the surviving orphan meets a removal.** The player chooses whether to retain it. This resolves the ambiguity but adds implementation and testing effort and another question; time, cost and remaining defects are unknown. The owner gives up a silent merge in that case. Confidence is high that an explicit choice resolves the decision if the conflict is preserved.

I recommend asking in the ambiguous case, because the copies do not record why the item is absent.

## Regression review and validation

The fix diff does not change the shared save and merge files, the planning engine, Submersibles prices or their request paths. The existing merchant-first engine and “Bought it” behavior remain in place. The built Lists scripts match their source. Character names and identifiers added to the page are escaped, and quality choices are fixed values. Existing tests were not edited beyond the requested price wait; the remaining changes add checks and a store test. The known same-unit behavior limits the concurrency conclusion above; this review cannot establish that no other defect exists.

In an isolated checkout of the candidate with the necessary history, `npm ci --ignore-scripts --no-audit --no-fund` and `npm run test:unit` passed (577 tests). Focused browser checks C166 and C171–C174 passed (5 of 5). In a separate copy, ST-18 failed against the old store; C172 and C173 failed against the old built page; C174 failed with the old wait and a held reply; and C171 failed when only its quality filter was removed. Browser reproductions checked the no-recipe row on both versions. Node reproductions exercised the stale character write and old/current merge functions. The full browser suite, full Command Center check and a real-device cloud sync were not run in this review.

## Publication options

- **Keep the live site as it is and hold this change.** Players avoid the candidate's new character-change hazard but do not get the planner yet. There is no new implementation cost now; delay and existing-site risk are unknown. The owner gives up immediate publication. Confidence is high that holding avoids introducing this selector.
- **Fix the findings and verify again before publishing.** This addresses the demonstrated stale-write loss and row mismatch. Time and effort are unknown; other defects may remain, with odds unknown. The owner gives up immediate publication. Confidence is high in the code-level reproduction; safety after changes requires fresh verification.
- **Publish now.** Players receive the planner immediately, but a stale character change can discard a concurrently added step, and a no-recipe row can misstate its need. Frequency and recovery effort are unknown. The owner gives up fixing and verifying these cases first. Confidence is high in the reproduced behavior, subject to the documented same-unit rule.

Recommendation: fix and verify before publishing because a character change can discard a step saved in another tab.

Technical: PR #4; candidate `d9d03eb528e72ec0fab5f0777e6d9c795e7ca959`; previous candidate `1b7641f3cbceecc467f73e961ce106844fd6c696`; published base `31cb0ba3a104eeb4c29809a4585421a7fa99e8b4`.
