# Independent review of the Lists fixes

Verdict: **publish after fixes**. Five of the seven accepted findings are fixed in the reviewed cases; two are partly fixed. The remaining issues can misstate craft completion and material needs.

## Seven accepted findings

| Earlier finding | Assessment | Evidence and test strength |
| --- | --- | --- |
| Stock count lost above 999,999 | **Fixed** | The store caps before normalization and signals the cap. ST-16 covers ordinary, high-quality, collectable, multi-yield and purchase boundaries, progress and material changes. With the previous store substituted, ST-16 failed. |
| Orphaned items invisible | **Fixed**, with a new ownership limitation below | The page displays and safely removes or restores saved orphans; ST-17 and C167 exercise it and failed with the old store/page. C167 has the old build write a seeded orphan, rather than running its complete sync; the existing LY-8 test exercises the old merge separately. |
| Actions and rows use another recipe | **Partly fixed** | Made and Bought it now filter by recipe, and C168 checks two unfinished recipes in two lists; it failed with the old page. A completed target can still fall back to a different recipe's line, as reproduced below. |
| Must-craft recorded in ordinary quality | **Partly fixed** | Single high-quality and collectable targets now record the requested stock quality; mixed targets get a selector. C169 failed with the old page and passes on the candidate. It does not assert that the selected quality is credited to a compatible target; the counterexample below fails. |
| Added recipes and empty stamp transitions missing from history | **Fixed** | The data tool records additions with a null old row and empty transitions. LD-11 to LD-14 failed when the previous tool was substituted; C170 checks the rendered notice and failed with the old page. |
| Old-build preservation check allowed Tracker save not to run | **Fixed** | C145 now requires “saved” for both Tracker builds; a missing function produces “not run,” which no longer satisfies the predicate. C145 passed here. The missing-function case was assessed from the predicate, not separately injected. |
| Price-check wait could return before fetch | **Fixed for C155**, with a remaining C166 issue below | C155 now waits for the fetched text itself and passed here. The prior test was timing-sensitive, so the old assertion is not guaranteed to fail on every run; the previous review observed a failure followed by a passing retry. C166 retains the old helper. |

## Findings

### MAJOR — A craft can be credited to a target requiring a different quality

`tracker/command-center/src/lists/lists.js:881`, called from line 962.

With an unfinished high-quality target followed by an ordinary target for the same recipe, the player can select ordinary quality and press “Made 1.” In the built page, that saved one ordinary Bronze Ingot but marked the high-quality target crafted; the ordinary target stayed unfinished. “Made all” can similarly credit targets that the selected output quality cannot satisfy. The plan can stop requesting a craft the player still needs.

The quality selector changes the stock quality, but `creditsFor` filters by item and recipe only. Fix the credit allocation to respect compatible qualities, including multi-yield crafts, both selector choices, collectables, list order and “Made all.” C169 checks the mixed line's stock, not which target received the credit.

### MAJOR — A completed wanted row can show another recipe's need

`tracker/command-center/src/lists/lists.js:341`.

In the built page, Bronze Ingot recipe 1 was crafted 1 of 1 while recipe 170 still needed 3. The recipe-1 wanted row showed “need 3” and “Crafted by Armorer,” the other recipe's job. When its own line disappears from the plan, `lineFor` falls back to the first line for the item. The player can believe a finished recipe still needs materials or use an incorrect suggested purchase quantity.

Fix: render the completed target's own state when its line is absent, without borrowing another recipe. Add a test with a completed target and an unfinished different recipe of the same product. C168 only checks the rows while both lines are unfinished.

### MINOR — A restored list cannot be assigned to a character

`tracker/command-center/src/lists/store.js:149`.

The recovery action always creates the list with no character, and the list page has no character selector. With a character present and an orphaned target, the built page restored it under “No character.” Its plan uses the no-character stock and order and cannot join that character's combined view. The missing header cannot establish the original owner, so guessing would be wrong; nevertheless, the player has no way to choose the right owner for the retained entries and must recreate them manually.

Fix: offer a character choice when restoring or allow a later change, defaulting to no character rather than guessing. Preserve every target field and guard concurrent writes. This limitation also makes the “restore is harmless” rationale for no undo incomplete.

### MINOR — The other price-table check can still finish its wait early

`tracker/command-center/check.js:6186`.

C155's wait is fixed, but C166 still calls the shared wait that accepts the initial “Price not fetched” text. In an isolated copy, adding a 500 ms delay to the mocked price reply caused C166 to fail several price assertions before the response arrived. This can make release checks fail even when the price service works.

Fix: wait for request completion or each expected result in C166 and other remaining callers.

## View on the two rulings

For the partly accepted sync finding, I agree that when a player explicitly removed the whole list and the other copy's orphan is genuinely unchanged, propagating that chosen removal is a defensible ordinary merge. The merge inputs do not themselves prove why the first copy lacks the item, however; older builds can also produce incomplete copies during sync. I would not assume every absence is an explicit removal when an orphan is present. The code is unchanged and the narrowed spec now documents the chosen behavior; no new reproduction here proves that the particular missing item arose without a prior choice.

For the no-undo ruling, the stated transaction rule does refuse recreating a new orphan, and the remove action asks first. I agree that offering an undo which cannot work would be misleading. The restore action currently commits the entries to the no-character owner with no way to change that owner, so I do not agree that it is harmless until the character-choice limitation above is addressed. Removal remains irreversible in the page after confirmation; backups may be the only recovery.

The real choices for the orphan sync behavior are:

- **Keep the current rule.** An unchanged orphan is removed when the other copy removed it, with no extra question. This keeps sync simple and honors a known deliberate removal. It costs no new work; the risk is an absence whose origin is uncertain being treated as deliberate, with odds and recovery effort unknown. The owner gives up a further chance to retain the orphan. Confidence is high in the code behavior and limited in assumptions about how every old copy became incomplete.
- **Keep the orphan or ask before removing it.** The player retains it by default or explicitly chooses between retention and removal. This protects against ambiguous provenance, at the cost of extra implementation, testing and possibly a repeated question; time and money are unknown. It may preserve something the player intended to delete, and its odds are unknown. The owner gives up silent propagation in this case. Confidence is high that an explicit choice resolves the ambiguity.

I recommend retaining or asking when an orphan remains, because the saved copies do not record the reason for the absence.

The real choices for recovery undo are:

- **Keep the present no-undo actions, after fixing character selection.** Removal remains a confirmed permanent page action and restoration remains available. This avoids a risky save-rule change and costs the character-selection work, with effort unknown. A mistaken confirmed removal still needs a backup or other recovery; odds and recovery cost are unknown. The owner gives up one-tap undo. Confidence is high in the current refusal rule.
- **Add a guarded undo for recovery actions.** Players can reverse a mistaken removal or restore if no conflicting change occurred. This improves recovery but requires changes and tests to safely reintroduce orphans; effort and remaining race risk are unknown. The owner gives up the simplicity of the current save gate. Confidence is moderate until those changes are independently tested.

I recommend the first option with clear confirmation and character selection, because the current gate deliberately refuses recreating orphans.

## Regression review and validation

The fix diff does not change `save.js`, `merge.js`, the planning engine, Submersibles prices or their request path. The merchant-first and purchase paths remain in place; the changed cap preserves existing stock and reports saturation, though quantities beyond the cap cannot be represented. Added orphan names and data are escaped, and the selected quality is drawn from fixed values. I found no unrelated edits to existing tests or checks beyond C145 and C155; the other changes append tests. These observations and passing checks do not prove that no other defect exists.

In an isolated checkout of the candidate, `npm ci --ignore-scripts --no-audit --no-fund` and `npm run test:unit` passed. Focused browser checks C145, C155 and C167–C170 passed 6 of 6. In another isolated copy, substituting the old store made ST-16 and ST-17 fail; substituting the old data tool made LD-11 through LD-14 fail; substituting the old built page and store made C167–C170 fail. The browser reproductions above and the delayed-response C166 experiment were also run. The full browser suite, full Command Center check and live cross-device cloud sync were not run for this review.

## Publication options

- **Keep the live site as it is and hold this change.** Existing players avoid the candidate's issues, but the planner remains unavailable. There is no new implementation cost now; delay and existing-site risks are unknown. The owner gives up immediate publication. Confidence is high that holding avoids introducing these candidate defects.
- **Fix the findings and verify again before publishing.** This addresses the reproduced accounting errors and reduces their chance of returning. Time and effort are unknown; other defects may remain, with odds unknown. The owner gives up immediate publication. Confidence is high in the two browser reproductions; safety after a fix requires new verification.
- **Publish now.** Players get the planner immediately, but mixed-quality crafts and completed recipe rows can mislead them, and recovered lists have the ownership limitation. Frequency and recovery cost are unknown; the owner gives up fixing and verifying first. Confidence is high in the reproduced behavior.

Recommendation: fix and verify before publishing because the planner can report a required high-quality craft as complete after an ordinary craft.

Technical: PR #4; fix candidate `1b7641f3cbceecc467f73e961ce106844fd6c696`; earlier reviewed candidate `ad41b595b2eac9ec36d3e8dc58baabf36b4ecde2`.
