# Bourse plan: adjudication of the two outside reviews (round four)

Written 2026-11-26 by the requester (Claude), from the private Continuity repository.

| Reviewer | Branch | Final head | Results commit | Package commit |
| --- | --- | --- | --- | --- |
| ChatGPT | `assignments/ASG-20261126-bourse-plan-review-chatgpt-004` | `161e665` | `da88d02` | `1c112c3` |
| Mistral | `assignments/ASG-20261126-bourse-plan-review-mistral-004` | `4c5432c` | `2873a41` | `16d4d48` |

Both reviewed pull request 10 at `3282839`. Both packages are byte-identical to what was dispatched.

## Verdicts and ruling

- **ChatGPT** (Codex, GPT-6 family): **FAIL**, with 4 blockers, 9 major findings and 2 minor ones. It names 6 of its 16 round-three findings closed and 10 open or partly open.
- **Mistral** (`mistral-large-4-0`): **PASS**, with 5 notes. It corrects its own two wrong round-three claims (R4-1). It inspected 3 of the 44 pictures.

**Ruling:** the plan fails round four, and the Bourse stays paused. Rounds three and four were the owner's choices beyond the two rounds the request covered. A fifth round, or a change of approach, is the owner's decision.

## Checked by the requester

- **R4-07: an unchanged cloud copy is classed as foreign.** Confirmed in the spec text. D63 counts a copy as a known descendant only when its line holds the recorded copy id, and the line lists ancestors, not the copy's own id. An unchanged copy on the next sync therefore merges with no base, which can bring back what the player removed.
- **R4-12: the Profit picture contradicts the spec.** Confirmed. The picture reads "40 sales in 1.0 days, at least 41 a day". The spec (D44, BM-8) gives 40 ÷ 7 = "at least 5.7 a day". The picture's second profit figure is also a fixed 92% of the first, not worked out from a listing.
- **R4-13: the Trip picture miscounts its hops.** Confirmed. The route goes Aether (Gilgamesh) to Primal (Exodus, Famfrit) to Light (Odin): 2 data-center hops, one of which is the region hop. The picture says 1.
- **R4-14: the home-world picker clips on the phone.** Confirmed in the 360 px picture.
- **R4-01: a version-2 save with no guard copy.** Confirmed in the spec text. D61 states that on the fallback storage, when there is no room for the guard copy, "there is no guard (known limit)". Such a save is exposed to an older page's erase with no restore. Mistral records the same fact as a note (R4-3). ChatGPT's severity is kept: the loss would cover every module.
- **R4-10: the 300-stack rule fails at equality.** Confirmed by its arithmetic. The rule admits extra stacks only when all weighed stacks hold *more* than the need.

The remaining findings concern behaviour that exists only as plan text. They follow from the spec as written, and none is contradicted by the code read.

## How the reviews have moved

| Round | ChatGPT | Mistral | New faults in the save and sync design |
| --- | --- | --- | --- |
| One | FAIL, 2 blockers, 14 major | PASS | Credits, tick identity, the version-1 merges |
| Two | FAIL, 1 blocker, 16 major | PASS | The credit merge, the cloud create race |
| Three | FAIL, 3 blockers, 11 major | PASS | The old erase (live-app code), the credit rule's limits, the overwrite approval |
| Four | FAIL, 4 blockers, 9 major | PASS | The guard on fallback storage, stale restore prompts, the held pair's storage, the blind cloud create |

Each correction closed what was found and added new safeguards (the guard copy, the held pair, the cloud lineage), and the next round found faults inside those safeguards. Three of the 13 serious round-four findings sit in the optional Lists credit setting (R4-03, R4-04, R4-09); a fourth (R4-05) is about trips. The cloud-create faults (R4-06) have a simpler remedy that ChatGPT names: write the version-2 cloud copy under a new file name, out of reach of older apps.

## Rulings

| # | Severity | Ruling | Where the fix goes |
| --- | --- | --- | --- |
| ChatGPT R4-01 | BLOCKER | Accepted. No version-2 migration or write without a guard copy that can be stored reliably; otherwise the save stays version 1, the reason is shown and backups stay available. | Spec (D61, B3, B30) |
| ChatGPT R4-02 | BLOCKER | Accepted. Restore and Keep compare both shown generations in one transaction. A stale prompt changes nothing and reopens; sync waits while recovery is pending. | Spec (D61, B30) |
| ChatGPT R4-03 | BLOCKER | Accepted. Both alternatives of a held pair are kept, durably and portably, with the storage plumbing named (`storage.js` 27 to 44, 106 to 114). | Spec (D46, D62, B26), or removed with the setting |
| ChatGPT R4-04 | MAJOR | Accepted. A matching Undo wins regardless of lineage; restores rebind or clear held questions. | Spec, or removed with the setting |
| ChatGPT R4-05 | MAJOR | Accepted. Own-item units are keyed by trip, item and quality. | Spec (D47, B13) |
| ChatGPT R4-06 | BLOCKER | Accepted. The version-2 cloud copy is written under a new file name (older apps keep writing the old one, which is read only to migrate), and is created only by a verified create-only route. | Spec (D48, D63, B27) |
| ChatGPT R4-07 | MAJOR | Accepted (confirmed). An exact match of item, copy id and tag counts as known. A missing target or an unconfirmed write never advances the base. | Spec (D63, B27) |
| ChatGPT R4-08 | MAJOR | Accepted. A rate refusal always pauses, whatever the order of the replies. A slot is freed only when the request has really ended. | Spec (D4, D56, B2, B18) |
| ChatGPT R4-09 | MAJOR | Accepted. C216 compares the shared fields with the older behaviour and checks the off build on its own terms. | Spec (B21), or removed with the setting |
| ChatGPT R4-10 | MAJOR | Accepted (confirmed). Stacks are added while the weighed supply is short. | Spec (D55, B16) |
| ChatGPT R4-11 | MAJOR | Accepted. "Cheapest" only from a clean ordered slice; otherwise "cheapest seen". | Spec (D49, B5, B20) |
| ChatGPT R4-12 | MAJOR | Accepted (confirmed). The picture follows D44, and both profit figures are worked out from shown inputs. | Look |
| ChatGPT R4-13 | MAJOR | Accepted (confirmed). The hop counts are worked out from the route: 2 data-center hops, 1 region hop. | Look, plus a check in B7 |
| ChatGPT R4-14 | MINOR | Accepted (confirmed). The source sentence goes outside the picker, as visible text. | Look |
| ChatGPT R4-15 | MINOR | Accepted. "Hourly limit" says Bourse requests. | Look, plus the spec's wording |
| Mistral R4-1 to R4-5 | NOTE | Accepted as records. R4-3 is superseded by R4-01's ruling. | — |

## What happens next

The owner decides how to proceed (asked separately, with every option). Building stays paused until the plan passes. Then it follows the owner's order: the one-look rules, the module moves, and the Bourse last, with the erase fix first.
