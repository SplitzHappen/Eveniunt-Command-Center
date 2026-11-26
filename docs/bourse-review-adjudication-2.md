# Bourse plan: adjudication of the two outside reviews (round two)

Written 2026-11-26 by the requester (Claude). Read from the repository: branches
`assignments/ASG-20261125-bourse-plan-review-chatgpt-002` (final head `eda48b3`, results commit `4ce9e4e`) and
`assignments/ASG-20261125-bourse-plan-review-mistral-002` (final head `551087b`, results commit `8026efc`) of the private
Continuity repository; both reviewed pull request 10 at `f6610c6`. Both packages are byte-identical to what was
dispatched (package commits `3baa8a5` and `d0c292c`, the parents of the dispatched status commits).

**Verdicts.** ChatGPT (Codex, GPT-6 family): **FAIL**, 1 blocker, 16 major, 2 minor, 1 note; most round-one findings
"partly open". Mistral (`mistral-large-4-0`): **PASS**, 2 minor, 3 notes; all its round-one findings closed. As in round
one, ChatGPT's findings carry concrete counterexamples and Mistral's are a subset of them. **Ruling: the plan fails round
two; the Bourse stays paused; the plan and the look are corrected again.** A third review round is beyond the two rounds
the owner's request covers, so the owner decides whether to run one.

**Checked by the requester.**
- R01 (blocker): Lists keeps an absolute count per item, merged unit by unit; two devices that each credit 40 from 10 both
  store 50, which merges as one equal value with no question, while two purchase marks of 40 each survive. Confirmed from
  the merge rule (`merge.js` line 80: equal values merge silently).
- R03: `cloud.js` lines 143 to 148 upload with `If-Match` only when an `eTag` is known; when the cloud copy was missing the
  upload is an unconditional replace, so an older device that saw "missing" can replace a copy a newer device created
  meanwhile. Confirmed.
- R10: re-checked against all 139 saved listings: every one pays exactly 5% of its total, rounded down, from retainers in
  eight different cities (city numbers 1, 2, 3, 4, 7, 10, 12, 14). The "lower" observation is that rounding on a small
  total (1 gil on 35 is 2.8%). The flat buyer's 5% is confirmed by the data; R10's request to adopt a different buyer
  basis is rejected on the evidence. Its request to document what the field means and to sum the rounded tax per stack
  is accepted.
- R17: the Item phone picture shows the search box squeezed to two characters and its label wrapped over three lines.
  Confirmed.

## Rulings

| # | Reviewer's severity | Ruling | Where the fix goes |
| --- | --- | --- | --- |
| ChatGPT R01 | BLOCKER | Accepted, BLOCKER, limited to the optional "Also add to I have in Lists" setting (the owner's default is tick only). A credit must survive a two-device merge: either a merge rule (new builds only; older builds are already shut out by save version 2) that rebuilds a credited count from the purchase records, or the setting stays off until such a rule exists. Tests: equal and unequal credits on two devices, Undo against an edit, an ordinary stock edit, through the real local and cloud paths with no choice. | Spec |
| ChatGPT R02 | MAJOR | Accepted. A tick binds to the need and the lists it was checked against; a receipt survives the retry window apart from the visible mark; the fallback storage's document and revision change together or cross-section writes are refused there. | Spec |
| ChatGPT R03 | MAJOR | Accepted. New builds create the cloud copy only if none exists and replace it only if it is the copy read; a cloud copy that an older app replaced is detected and never turns into silent removals on a newer device. The transition case is stated and tested (a missing-file race between an old and a new device). | Spec |
| ChatGPT R04 | MAJOR | Accepted. The ranking's listing figure comes from a source that carries world and age, filtered to the travel area, or is shown as unavailable; sales per day uses a declared window and denominator. | Spec |
| ChatGPT R05 | MAJOR | Accepted. A world reply's rows inherit the world of the reply; region rows must carry their own; listing review time and report time are kept apart. Fixture tests for both. | Spec |
| ChatGPT R06 | MAJOR | Accepted. A successful home-world reply is the authority for home listings (no double count with the region reply); tests for overlapping replies and two equal but distinct offers. | Spec |
| ChatGPT R07 | MAJOR | Accepted. "Confirmed empty" only from a reply whose scope proves it for that quality; a zero minimum is a missing value, never a zero-gil offer. | Spec |
| ChatGPT R08 | MAJOR | Accepted. A recipe cost is used only when every ingredient's quantity is covered; a trip total with unresolved items is labelled a known subtotal, with what is missing. | Spec |
| ChatGPT R09 | MAJOR | Accepted. The extra-cost allowance is one cumulative amount for the whole trip, not one per region or pass; approximate starting figures are labelled as references; "only listings here" becomes "only reported listings" when coverage is partial; a first world when the home world is unset. | Spec |
| ChatGPT R10 | MAJOR | Partly rejected (see "Checked"): the buyer's 5%, rounded down per stack, is confirmed in all 139 saved listings. Accepted: the spec names this as the buyer basis, says what the listing's `tax` field is (5% of the stack, rounded down), uses it only as a cross-check, and keeps the seller's city rate as the cautious income deduction. | Spec |
| ChatGPT R11 | MAJOR | Accepted. Every accepted size pinned; work per step bounded including the first pricing; a bounded large-stack search and a correct tie rule; tests above 2,000 units and with merged over-limit inputs. | Spec |
| ChatGPT R12 | MAJOR | Accepted. Start rate, in-flight limit and pauses shared across tabs; a request deadline; a long Retry-After honoured; late results never mark newer ones stale. | Spec |
| ChatGPT R13 | MAJOR | Accepted. Each alert observation is bound to the area, settings and round it was asked for, rechecked before it rings; re-arming only from complete fresh evidence for the same target; deadlines and late-result discard. | Spec |
| ChatGPT R14 | MAJOR | Accepted. The Tracker's old list maps to normal quality (it never held a quality), visible as such; the copy takes the larger amount against the live saved value inside its transaction. | Spec |
| ChatGPT R15 | MINOR | Accepted (with Mistral R2-1, R2-3, R2-4): the ledger, sections 8 to 11 and 15 updated to round six; the older pages' real behaviour in D32; found fields marked "found (B1)"; the reply cap named as D5. | Spec |
| ChatGPT R16 | MAJOR | Accepted. Dependencies and paths fixed; guards split from change-sensitive assertions with paired controls; the old-client base frozen after the module moves. | Spec |
| ChatGPT R17 | MAJOR | Accepted. Item phone search usable; the answer keeps its world and age legible; the settings sheet shows the plan's default mode and a home-world picker; Profit shows both sale bases and the sample; the phone Trip keeps its stop and hop counts on one line. | Look |
| ChatGPT R18 | MAJOR | Accepted. The examples are generated from one set of whole-stack purchases with the buyer's 5% included and a declared rounding; the optional stop shows what it replaces. | Look |
| ChatGPT R19 | MINOR | Accepted. Budget wording matches the spec; the maintenance example carries its data date; no clipped labels; reading text at house sizes; the sheet measured on its own; a live alert over the normal screen pictured. | Look |
| ChatGPT R20 | NOTE | Accepted. Listing numbers and request trace numbers removed from the saved replies; the test checks the allowed keys recursively; the redaction boundary written down. | Fixtures, test |
| Mistral R2-1 | MINOR | Accepted (with R15). | Spec |
| Mistral R2-2 | NOTE | Accepted: 257 px in the look spec. | Look spec |
| Mistral R2-3 | MINOR | Accepted (with R15). | Spec |
| Mistral R2-4 | NOTE | Accepted (with R15). | Spec |
| Mistral R2-5 | NOTE | Accepted: already disclosed; kept in D32's known limits. | Spec |

## What happens next

1. The spec is corrected (planning agent); the look, the examples and the saved replies are corrected (requester).
2. The owner decides whether to run a third outside review round (beyond the two rounds the request covered).
3. Building stays paused until the plan passes, then follows the owner's order: one-look rules, module moves, the Bourse
   last.
