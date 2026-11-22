# Independent review of the Lists specification

**Verdict: not ready.** Resolve the data-loss and contradictory engine contracts before implementation. This is a paper review of the candidate, not a proof or an execution of the model tests. The listed examples are proposed cases for the requester to adjudicate.

## 1. BLOCKER — Unanswered entry conflict can delete an entry

**Spec section:** 4 Sync; 5 model C  
**Problem and consequence:** A Tracker tab's automatic merge can silently discard a remotely changed wanted item, despite the no-deletion promise.  
**Proposed fix:** Give deletion versus edit of each wanted item a no-answer preservation rule, retain the question until answered, and test both local/remote orientations through actual automatic saves and subsequent sync.  
**Evidence:** Spec 176-184, 305-310; tracker/src/core/merge.js:54-67, 166-196; tracker/src/core/storage.js:98-112. Base has target T; local deletes T but keeps list; remote changes T. LY1 does not apply because neither header was removed. Ordinary conflict defaults to local null; applyMerge with {} deletes T.

## 2. BLOCKER — Recorded crafting cannot complete must-craft targets as specified

**Spec section:** 5, E12; 7  
**Problem and consequence:** Crafting-log targets remain planned forever or are marked complete without accounting for how many were made; multi-craft targets and shared recipe rows are ambiguous.  
**Proposed fix:** Specify an atomic operation carrying target identities, quantities and quality, stock changes, partial progress and undo; distinguish completed log crafts from physical stock, then test partial and shared crafts and reload/sync.  
**Evidence:** Spec 124, 141-143, 208, 231-236, 277-281, 383-384: craftDone receives only have, data, recipeId, times, quality, ways and returns have and short; it cannot change target.done. A make target of 3 at yield 1 needs 3 presses but has only a boolean done.

## 3. BLOCKER — Already-have source violates the conservation invariant and can hide real shortages

**Spec section:** 5, E2, E11  
**Problem and consequence:** A need may be presented as met without stock, while the required model test demands it be accounted for as stock or acquired output.  
**Proposed fix:** Represent an explicit unverified external supply or outstanding amount and label it honestly; revise conservation and tests to count it, without consuming actual stock implicitly.  
**Evidence:** Spec 243-247, 260-261, 276: need 5, stock 0, way have yields got 0, stock used 0, spare 0; E2 demands 0 = 5.

## 4. BLOCKER — The recorded-craft invariant fails when spare output serves another part

**Spec section:** 5, E12  
**Problem and consequence:** The permanent model test is required to fail on legitimate inputs, blocking the engine and making the promised unchanged totals false.  
**Proposed fix:** Replace the exact unchanged-total claim with a conservation/replanning contract, including spare, quality and must-craft cases; specify whether recording a craft is permitted when ingredients are short.  
**Evidence:** Spec 231-247, 277-281: one must-craft X and one ordinary X, yield 3, ordinary way craft, no X stock. Before recording there are two crafts; record the must-craft once with all materials available: 3 X enter stock and the make target is marked done; the ordinary craft also disappears, so crafts fall by 2, not 1, and its material needs fall.

## 5. BLOCKER — Undo can overwrite another tab's newer stock or edits

**Spec section:** 4 stale writes; 7 undo  
**Problem and consequence:** A one-tap undo can silently erase work entered elsewhere after the original action, including gathered quantities.  
**Proposed fix:** Make undo a conditional inverse against the exact post-action units and refuse or explicitly reconcile concurrent changes; do not restore a stale snapshot as an unconditional edit.  
**Evidence:** Spec 69-73, 170-174, 404-416, 509-518; save.js:450-464. Tab A buys 1 from stock 0; tab B changes stock to 10; A's undo restores 0, and LI3 says the later change to the same unit wins.

## 6. BLOCKER — Dependency cycles and alternate recipes lack a defined deterministic resolution

**Spec section:** 5 graph, E14, E17  
**Problem and consequence:** A real or generated craft/trade cycle can prevent topological settlement, or cause the selected source to contradict the owner’s merchant-first rule and the model's termination test.  
**Proposed fix:** Define the selected dependency graph, cycle detection across both recipes and trades, deterministic cycle-break policy and the displayed unmet quantity; test mixed and self cycles and source priority.  
**Evidence:** Spec 222-233, 243-246, 283, 287-291, 301-305. If X is crafted from Y and Y traded for X, neither item can be settled after all parents. Cutting a trade loop by putting an item under other must specify which item and what happens to the remaining needs.

## 7. MAJOR — Whole-list keep and unanswered semantics do not specify how to preserve concurrent contents

**Spec section:** 4 Sync LY1-LY4  
**Problem and consequence:** A keep decision or unattended merge can discard a target that exists only on the other side, and two devices can settle differently; the test's no-loss claim does not specify the actual result.  
**Proposed fix:** Define the complete base/local/remote truth table, including one-sided target removals, additions and edits on both sides, choice scope, unanswered result, repeat sync and post-upload base; keep all unresolved records and surface any irreconcilable conflict.  
**Evidence:** Spec 176-184 and 305-310; merge.js:35-68, 166-225; storage.js:106-112. LY1 says keep the keeping side's header and targets, whereas LY2 says unanswered nothing of that list is deleted; an automatic save persists the provisional state without choices.

## 8. MAJOR — The item-level output cannot represent different sources, recipes and yields for one item

**Spec section:** 5 quality; 3 data  
**Problem and consequence:** A normal need bought from a merchant and a high-quality need crafted have different sources and costs, but one row's by, recipe, crafts and offer cannot faithfully drive all views and actions.  
**Proposed fix:** Represent each quality and must-craft/collectable part with its own source, selected recipe, offer, need, crafts and output; define aggregation, controls and purchase counts explicitly.  
**Evidence:** Spec 97-99, 141-146, 200-206, 222-242. Normal X can be vendor while high-quality X is craft; one line.by and one line.recipe cannot both hold the required answers. Two must-craft targets may specify different recipes for X.

## 9. MAJOR — Partial purchase and trade surplus are not specified consistently

**Spec section:** 5 E3 E8 E12; 7  
**Problem and consequence:** Players can buy fewer than the shortfall, and bundles can exceed it; the row may still need a craft even though the text promises it disappears, and stock can be recorded in the wrong quantity.  
**Proposed fix:** Define the entered amount as physical units or transactions, apply actual yield and price, keep any remaining demand visible, and test partial and excess purchases in each quality and from each view.  
**Evidence:** Spec 243-247, 269, 292-297, 404-412. Need 5, yield 3 per craft, buy 2: stock rises by 2 but 3 remain, so the craft and its materials cannot drop out at once.

## 10. MAJOR — Collectable and high-quality actions lack a complete compatible state model

**Spec section:** 5 E6 E7; 7  
**Problem and consequence:** The planner may claim an impossible source or consume the wrong stock for mixed quality, and cannot consistently finish or undo collectable and must-craft targets.  
**Proposed fix:** Define allowed flag combinations, collectability thresholds and recipe capability; define exactly which quantities each action produces and consumes and validate imported combinations without silently dropping user data.  
**Evidence:** Spec 96-97, 124-127, 141-147, 231-242, 277-280, 382-384. A target can have make, hq and coll simultaneously, but make is settled first, coll is always crafted and craftDone accepts one unspecified quality; no threshold or precedence is defined.

## 11. MAJOR — The patch notice does not define how to find removed intermediate recipes

**Spec section:** 6 patch notice; 3 changes  
**Problem and consequence:** A player returning after a patch can see a changed or missing plan without the promised explanation, despite preserved progress.  
**Proposed fix:** Compare against both old and new reachable recipe graphs over every intervening change, including deleted recipes and changed ingredients, and specify how old stamps and multiple sequential patches compose.  
**Evidence:** Spec 102, 313-321. If A used B, B's recipe disappears and the current tree stops at B, a notice restricted to affected recipes in the present tree cannot reliably find the removed B recipe or its old descendants.

## 12. MAJOR — Capping offers at four can erase the only usable quality or trade

**Spec section:** 3 data; 5 E8  
**Problem and consequence:** The planner may claim no high-quality vendor or trade exists, ignore a valid source, or violate merchant-first behavior for that quality.  
**Proposed fix:** Retain all offers required to preserve every source, quality and currency choice, or prove a lossless pruning rule and test a fifth unique offer.  
**Evidence:** Spec 98-100, 104-111, 222-228. Four cheaper normal gil offers can fill the table and exclude a fifth high-quality offer; the planner then cannot select that vendor for high-quality demand.

## 13. MAJOR — Trade offer selection, multiple currencies and recursive currency planning are underspecified

**Spec section:** 3, 5 trade; E8 E14  
**Problem and consequence:** Different builders can produce different material totals or select an inaccessible trade; a crafted currency can be omitted or charged incorrectly.  
**Proposed fix:** Specify deterministic offer eligibility and choice per quality, how every currency including gil is charged, recursive planning of non-gil currencies, cycles, and data closure; test a multi-currency trade whose currency is crafted.  
**Evidence:** Spec 90-100, 243-246, 269, 283. Trade X yields 2 for 3 Y plus 50 gil; Y needs 2 Z. Need 3 X means 2 trades, 6 Y, 100 gil and 12 Z when Y yield is 1; the spec does not choose between several non-gil offers.

## 14. MAJOR — Oversize merged arrays are truncated by old and new generic cleaning

**Spec section:** 4 compatibility; 7  
**Problem and consequence:** A large synced selection can silently lose data in an older build despite the unlimited-checker and compatibility guarantees.  
**Proposed fix:** Bound or redesign stored arrays so every valid merged save survives the pre-check cleaner, or change compatibility strategy and explicitly protect old clients; test at 5,001 elements through all shipped builds.  
**Evidence:** Spec 128, 148-158, 627-629; save.js:30-36, 143-150. clean slices every array to 5,000 before any module checker. An unbounded combined list selection can exceed this after many merges.

## 15. MAJOR — The per-list monotonicity promise contradicts proportional attribution

**Spec section:** 5 E9 and 7 steps; 11 Q4  
**Problem and consequence:** The owner is offered a guarantee the design explicitly says it cannot give, and step leftovers are described differently from the global calculation.  
**Proposed fix:** Correct the owner-facing option and acceptance criteria to distinguish whole-character totals from individual shares; define whether sequential step leftovers are a display allocation or a separate calculation.  
**Evidence:** Spec 76-79, 249-253, 612-613, 657-661; research 90-92. X yields 3, two lists each need 1: first receives the craft share. Remove the first target and the second share rises from 0 to 1, even though the character total stays 1.

## 16. MAJOR — Work-item dependencies and acceptance checks conflict

**Spec section:** 8 W1, W6, W10, W12  
**Problem and consequence:** Builders can be blocked by missing files or forbidden changes even when the intended implementation is sound.  
**Proposed fix:** Align named files, prerequisites and fallback ownership with actual execution, and make the log data available at the stage that validates it; reconcile whether missing Atelier recipes are allowed.  
**Evidence:** Spec 101, 113-115, 447-455, 500-508, 362-368. W1 validates log recipe IDs although log is only added by build.js in W6; W6 says escalate if Atelier lacks any recipe while section 6 explicitly permits missing ones as no hand-over.

## 17. MINOR — The link is placed inside a button-like fold control

**Spec section:** 7 Tracker link; 8 W12  
**Problem and consequence:** The link nests an interactive control in a keyboard-operable button and the existing delegated handler folds the row on click; keyboard activation and accessibility need explicit treatment.  
**Proposed fix:** Place the link outside the fold control or change markup and handlers with appropriate accessibility tests, including mouse and keyboard, while retaining folding and ticking.  
**Evidence:** Spec 557-575; tracker/src/app/ui.js:475-482, 752-753, 783. W12 requires an anchor inside the first cell, which has role=button and data-fold; closest('[data-fold]') captures link clicks.

## 18. MINOR — Missing or stale listings do not have a complete price contract

**Spec section:** 6 price service; E15  
**Problem and consequence:** A zero, stale or missing listing can be shown as a real price or an outdated price without the promised unknown distinction.  
**Proposed fix:** Specify no-listing, zero, malformed, partial-failure and old-cache behavior with per-item freshness, and test market totals and user wording.  
**Evidence:** Spec 284, 323-338; earn.js:182-204. Existing settle records missing reply separately and maps a missing average to 0; the new listing reader and shared settle must explicitly distinguish unavailable from free.

## 19. MINOR — Generated identifiers do not specify collision handling

**Spec section:** 4 IDs; 7  
**Problem and consequence:** Two offline devices can independently create the same list or target ID, turning separate records into one conflict or silently conflating them.  
**Proposed fix:** Specify collision-resistant generation and collision handling across devices, including imported IDs, and test same-ID independently created records.  
**Evidence:** Spec 123-135, 176-180. Time plus a random part with 4-16 characters has no mandated entropy, collision check or separate-creation behavior.

## 20. MINOR — Remove-and-add identity and exact undo are underspecified

**Spec section:** 5 E13; 7  
**Problem and consequence:** Re-adding an item with a fresh target ID, order or step may change shares and make an exact-plan assertion fail even when item totals are the same.  
**Proposed fix:** Define whether E13 means restoring the exact original target and position, or compare semantic totals only; test both remove-and-undo and a fresh add.  
**Evidence:** Spec 134-143, 249-253, 259, 282 and 415-416. Shares include list and step IDs and allocation depends on ordering, so a newly generated ID or different position is not necessarily an identical plan.

## Rule-by-rule checks and coverage

I tried the stated rules with small examples; lack of a counterexample is not proof. The existing code was read for the named integration points; the spec is not implemented, and no tests or builds were run.

- E1: no counterexample to purity and stable ties found, provided all iteration and cycle handling are deterministic; the selected dependency cycle is not defined (finding 6).
- E2: broken by the already-have case (finding 3).
- E3: for one part, need 7, stock 1, yield 3 gives 2 crafts, 6 produced and no spare; need 8 gives 3 crafts and 2 spare. No arithmetic counterexample for an individual valid craft part; the parts and multiple recipes need clearer representation (finding 8).
- E4: for fixed source and acyclic dependencies I found no stock-increase counterexample; normal stock 1 plus high-quality stock 1 against one normal and one high-quality need covers both without using stock twice. The general graph needs the cycle rule first.
- E5: with a fixed source and the spec's exclusion of unrecorded spare, I found no character-total counterexample; a list share can rise (finding 15). This is weaker than the owner-facing claim.
- E6 and quality: the high-quality-only merchant example respects the stated stock priority, but mixed flags and per-quality sources cannot be fully represented (findings 8 and 10).
- E7: a collectable need of 2 with 1 collectable held leaves 1 to craft; the make/collectable combination and recording are unresolved (findings 2 and 10).
- E8: 3 wanted, trade gives 2 for 3 tokens, requires 2 trades and 6 tokens. No rounding counterexample; multiple offers and crafted currencies remain unspecified (finding 13).
- E9: whole-owner totals are invariant under repartition in the stated algorithm; allocation between individual lists is not (finding 15). No claim of a proof for cyclic or mixed-recipe inputs.
- E10: no counterexample to a topological sequence grouped into possibly repeated job blocks on an acyclic resolved graph; cycle handling and recipe selection remain open.
- E11: the no-stock-consumption part is explicit but conflicts with E2 and truthful shortage presentation (finding 3).
- E12: false for shared spare and incomplete for must-craft progress (findings 2 and 4).
- E13: exact identity after a fresh remove/add is not defined (finding 20).
- E14: a mixed craft and trade cycle is not resolved by the text (finding 6).
- E15: unpriced is intended unknown; the interaction with the existing price cache and empty listings is not specified (finding 18).
- E16: no arithmetic counterexample to the stock ceiling when all parts draw from one owner pool; actions and concurrent undo need protection (findings 5 and 10).
- E17: the default source order correctly chooses an eligible gil offer in the simple owner fixture; capped offers and mixed quality can invalidate availability (findings 8 and 12). Explicit player override and must-craft exceptions remain intentional.
- E18: a craft-to-vendor switch with already-gathered ingredients leaves the typed ingredients intact in the pure plan. The UI's immediate-disappearance claim fails for partial purchases (finding 9); no general proof of the trade bound was possible without a defined offer and graph. The exact undo promise fails under concurrent writes (finding 5).

Requirements coverage: research sections 1–7 are addressed in the design, including local computation, current data, combined views, steps, price service, Tracker and Atelier links; the findings above identify gaps in totals, stock, vendor quality, patch notices, no-loss sync and integration. The owner’s merchant-first rule is represented at each eligible normal or high-quality level with explicit must-craft and player-choice exceptions; the offer cap threatens it. Every-view source controls and undo are described, but partial purchases and concurrent undo are not safe as specified. Old builds preserve the proposed ordinary bounded shape via the generic cleaner, but the cleaner is not unbounded and old unit-by-unit sync cannot enforce the new integrity pass. Q1–Q3 are reflected in the proposed design; Q4 remains open.

## Owner decision: where to choose how an item is obtained

The current design makes one choice for each character and applies it to all that character's lists. There are three real choices considered here, including keeping that design. All costs and likelihoods below are estimates from a paper review; no implementation timing or failure odds are known.

1. **Keep the current design: choose once for each character.** One choice controls the item wherever that character needs it, apart from entries that must be made personally. This improves consistency and avoids different lists issuing competing instructions. It costs no additional change to the planned choice layout, though the defects above still need repair; the time and money are unknown. A list's own displayed share can still increase when another list is removed, and other calculation or sync errors remain possible; their odds are unknown. You give up choosing to make the same item for one list while buying it for another. Confidence is moderate, conditional on repairing and testing the underlying rules.
2. **Choose separately for each list and share only stock already recorded.** Each list can buy or make the same item differently, while all lists still draw on one character's recorded stock in order. This improves flexibility and avoids depending on another list's unrecorded spare. It needs a changed save layout and planning and screen work; time and money are unknown. Before a craft is recorded the combined plan can ask for more than ultimately needed, and allocation and sync mistakes remain possible; their odds are unknown. You give up automatically using an earlier list's planned spare in a later list. Confidence is moderate that the tradeoff is understandable, but the complete calculation has not been proved.
3. **Return to the earlier design: choose separately for each list and also share planned spare.** Each list can choose its own method, and an earlier list's expected spare can satisfy a later list before it is made. This improves flexibility and may reduce planned purchases. It requires revising the current design and testing the allocation; time and money are unknown. Removing an earlier target can make a later purchase increase, and recalculation and attribution are harder to explain; the likelihood is unknown, but the example is certain. You give up a simple promise that removing work cannot increase every displayed figure. Confidence is high in that tradeoff, not in the unbuilt design.

**Recommendation:** keep one choice for each character for the first release, because it gives the clearest single instruction for a shared stock. Correct the promise about individual list shares and fix the blocking findings before treating the design as ready. This recommendation does not make the owner's decision.

Technical: Q4; `docs/lists-spec.md` sections 4, 5, 10 and 11.
