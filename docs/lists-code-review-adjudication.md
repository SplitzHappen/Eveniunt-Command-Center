# Lists: rulings on the outside code reviews (2026-11-22)

Third review round, asked for by the owner (option B of the ship request): an independent code review of pull request 4
at `ad41b59` by ChatGPT (verdict: do not publish; 1 blocker, 4 major, 3 minor) and Mistral (verdict: publish after
fixes; 1 major, 1 note). Results: branches `assignments/ASG-20261122-lists-code-review-chatgpt-001` and
`assignments/ASG-20261122-lists-code-review-mistral-001`. Ruled by the orchestrator; two findings were confirmed in the
code before ruling (several recipes for one item: 657 items in the real data; "Made" passes the line's quality).

| Reviewer | Finding | Given | Ours | Ruling | Reason | Fixed in |
| --- | --- | --- | --- | --- | --- | --- |
| ChatGPT | Recording a craft that takes a count above 999,999 loses that count (the checker drops the field) | Blocker | Minor | Accepted | Real data loss, though only past 999,999 of one item; the store must cap at 999,999 (and say so), never write a count the checker drops | W14 |
| ChatGPT | An orphaned wanted item disappears in a sync when one side removed the list and item and the other (old build) holds it unchanged without a header | Major | Note | Accepted in part | The removal was the player's own explicit action on one device and the other side did not change the item, so taking the removal is the ordinary rule and deletes nothing the player did not choose to delete. The spec's case 4 wording ("held by either device stays") was too broad: it now reads "changed or added by either device stays" | spec, section 4 |
| ChatGPT, Mistral | The "Restored list" view for wanted items without their list is not built; such items are kept but invisible | Major | Major | Accepted | The spec promises it; a kept item the player cannot see, move or remove is not really kept | W14 |
| ChatGPT | "Made" and "Bought it" act on every wanted item of the same product, not the recipe of the row (e.g. Bronze Ingot, recipes 1 and 170) | Major | Major | Accepted | Confirmed: credits and the must-craft flag are chosen by item; 657 items have more than one recipe | W14 |
| ChatGPT | A must-craft craft is recorded as normal quality even when the wanted item is high quality or collectable | Major | Major | Accepted | Confirmed: "Made" passes the line's quality; the default must follow the wanted items, and the player can choose | W14 |
| ChatGPT | The data tool records no added recipes and no entry for a stamp change without differences | Minor | Minor | Accepted | An added recipe can change how an item in a list is got; a missing link makes the notice fall back to the general sentence | W14 |
| ChatGPT | C145 can pass without running the Tracker saves | Minor | Minor | Accepted | A check must not pass on "not run" | W14 |
| ChatGPT | C155's wait can finish before the price fetch (flaky) | Minor | Minor | Accepted | Seen failing once in the reviewer's run; wait for the fetched state | W14 |
| Mistral | Collectable stock is shared in recipe order, not list order as the spec says | Note | Note | Accepted (spec wording) | Accepted choice of W2 so that reordering lists never moves a figure; the spec text is corrected | spec, section 5 |

**Applied in W14** (commit b6d4f0e), each fix pinned by a test seen failing without it: unit 576 of 576, browser 61 of
61, full check 175 of 175 (C26b not run). One ruling during the fix: the Restored list card's two actions have no undo
(an undo would recreate an item without its list, which the save refuses by design); Remove asks first.

## Fourth round: review of the fixes (2026-11-22)

Asked for by the owner (option B of the second ship request). Mistral: publish (all seven fixes verified, each test
seen failing without its fix, no regressions, both rulings agreed). ChatGPT: publish after fixes (five fixed, two
partly fixed, two minor). Results: branches `assignments/ASG-20261122-lists-fix-review-chatgpt-001` and
`assignments/ASG-20261122-lists-fix-review-mistral-001`.

| Reviewer | Finding | Given | Ours | Ruling | Reason | Fixed in |
| --- | --- | --- | --- | --- | --- | --- |
| ChatGPT | "Made" credits a wanted item whose quality the output cannot satisfy (a normal craft marks a high-quality item crafted) | Major | Major | Accepted | The credit filter checks item and recipe, not quality; seen in the reviewer's browser run | W15 |
| ChatGPT | A finished recipe's wanted row borrows another recipe's line (shows its need and job) | Major | Major | Accepted | `lineFor` falls back to the first line of the item when the row's own line has left the plan | W15 |
| ChatGPT | A restored list always has no character, with no way to choose one | Minor | Minor | Accepted | The owner of an orphan cannot be known, so the player must be able to choose; default stays "no character" | W15 |
| ChatGPT | C166 still uses the early-finishing price wait | Minor | Minor | Accepted | Same race as C155; reproduced with a delayed reply | W15 |
| ChatGPT | The unchanged-orphan sync rule should keep the item or ask | (view) | Note | Rejected, kept as ruled | In a three-way merge the side that lacks the item had it at the last sync and removed it since; old builds keep the lists section byte for byte (pinned by LY-8 and C145), so that absence comes from a removal on that device, the player's own action. Mistral agreed. Recorded as a known limit. | spec, section 4 |
| Mistral | Note: the same rule, probed and agreed | Note | Note | Noted | | |

## Fifth round: review of the second fixes (2026-11-23)

Asked for by the owner (option B of the third ship request). Mistral: publish (all four fixes verified, one caveat
noted). ChatGPT: publish after fixes (one major, one minor, one note). Results: branches
`assignments/ASG-20261123-lists-fix2-review-chatgpt-001` and `assignments/ASG-20261123-lists-fix2-review-mistral-001`.

| Reviewer | Finding | Given | Ours | Ruling | Reason | Fixed in |
| --- | --- | --- | --- | --- | --- | --- |
| ChatGPT | A stale tab's character change keeps its old list header and drops a step another tab saved; undo does not bring it back | Major | Major | Accepted | The header is one saved unit, so the later save wins (a documented limit), and the new character selector made it easy to hit; renaming and adding a step had the same exposure. Every header edit becomes a conditional write: refused with the usual "Not saved on this device" line when the header changed elsewhere since the page read it | W16 |
| ChatGPT | A must-craft item with no usable recipe shows "crafted 0 of 2" and hides the real need | Minor | Minor | Accepted | The W15 own-state row should apply only when the make line is really complete; otherwise the item's actual plan line is shown | W16 |
| ChatGPT, Mistral | Note: an old build's own sync can already drop a changed orphan, so a later absence is not always a deliberate removal | Note | Note | Noted, limit recorded | The old build is already published and behaves so on its own; the new rule adds no deletion the old build would not make, and the case ends once every device has updated. Recorded as a known limit | STATE, Known limits |
