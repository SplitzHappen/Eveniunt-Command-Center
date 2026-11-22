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
