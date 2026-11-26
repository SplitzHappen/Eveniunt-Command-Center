# Bourse plan: adjudication of the two outside reviews (round five)

Written 2026-11-26 by the requester (Claude), from the private Continuity repository.

| Reviewer | Branch | Final head | Results commit | Package commit |
| --- | --- | --- | --- | --- |
| ChatGPT | `assignments/ASG-20261126-bourse-plan-review-chatgpt-005` | `6c2f7e5` | `46967de` | `426ed96` |
| Mistral | `assignments/ASG-20261126-bourse-plan-review-mistral-005` | `4248359` | `885e0d4` | `fc992e2` |

Both reviewed pull request 10 at `c66b46d`. Both packages are byte-identical to what was dispatched.

## Verdicts and ruling

- **ChatGPT** (Codex, GPT-6 family): **FAIL**, with 2 blockers, 8 major findings and 2 minor ones. It names 10 of its 15 round-four findings closed and 5 partly open.
- **Mistral** (`mistral-large-4-0`): **PASS**, with 7 notes. Every note is a limit the spec already states.

**Ruling:** the plan fails round five, and the Bourse stays paused. A sixth round, or a change of scope, is the owner's decision.

## Checked by the requester

- **R5-02: an answer is not bound to its question.** Confirmed in the spec text. D70(5) stores an answer as `{ ans: 'x' | 'y', at }`. Nothing in it names the two alternatives it chose between, so a late answer can land on a newer question with different contents.
- **R5-03: a third device's purchase.** Follows from D70(3) to (5) as written. A question offers only the two alternatives it was raised with, and "leave this device's pair alone" does not add a third device's distinct pair to it. LI7 freezes typed counts, ticks and Undo, but not Lists' own Bought, Made, hand-in and Undo.
- **R5-11: stale text in section 8.** Confirmed. It still says new code "always writes 2" with one cloud file, and B27 still names BV-8 with its old expected result.
- **Mistral's notes** match limits the spec states. None contradicts a ChatGPT finding.

## How the reviews have moved

| Round | Blockers | Major | Blockers in the optional Lists credit setting |
| --- | --- | --- | --- |
| One | 2 | 14 | 1 |
| Two | 1 | 16 | 1 |
| Three | 3 | 11 | 1 |
| Four | 4 | 9 | 1 |
| Five | 2 | 8 | **2 of 2** |

- **The credit setting.** In round five, five of the ten serious findings sit in the credit setting and its held-pair protocol (R5-02, R5-03, R5-04, R5-05, R5-08). A sixth touches it in part (R5-01).
- **Everything else** has fewer findings each round, and they are narrower: R5-06 migration replay, R5-07 "cheapest seen", R5-09 importing a version-2 backup on a browser limited to version 1, R5-12 the first trip identity.

## Rulings

Every finding is accepted, at the reviewer's severity.

| # | Severity | Where the fix goes |
| --- | --- | --- |
| R5-01 Keep rotates the epoch; stale edits after Keep are refused | MAJOR | D65, D70(8), B30 |
| R5-02 Content-bound question identity; the answer bound to it | BLOCKER | D70, B26 (credit setting) |
| R5-03 A third distinct pair becomes a new alternative; every Lists change to the frozen stock is refused | BLOCKER | D70, LI7, B21, B26 (credit setting) |
| R5-04 The hold reaches the cloud, or is shown as local only | MAJOR | D70, B26 (credit setting) |
| R5-05 Invalid alternatives are quarantined, never offered | MAJOR | D70, BY2 step 0, B3, B26 (credit setting) |
| R5-06 A shared migration checkpoint, so old-file entries are not replayed | MAJOR | D67, B27 |
| R5-07 "Cheapest seen" unless a selection contract or a complete slice is proven | MAJOR | D49, D69, B5, B20 |
| R5-08 The off build refuses or keeps opaque the credited pairs it cannot merge | MAJOR | C216, B26 (credit setting) |
| R5-09 A version-2 import needs a guarded version-2 write first | MAJOR | D64, B3, B30 |
| R5-10 Sample and seller rate readable beside the Profit figure on both widths | MINOR | Look |
| R5-11 Stale section 8 text and BV-8 replaced | MINOR | Spec |
| R5-12 A trip identity is allocated with the first own-item write | MAJOR | D66, 6.7, B10, B13 |
| Mistral R5-1 to R5-7 | NOTE | Records only |

## What happens next

The owner decided (`docs/bourse-questions.md`, tenth round): keep the Lists setting in this plan; fix all twelve findings; a sixth outside round with both reviewers. Building stays paused until the plan passes.
