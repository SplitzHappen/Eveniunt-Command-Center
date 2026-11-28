# Bourse plan: adjudication of the two outside reviews (round one)

Written 2026-11-25 by the requester (Claude) after both reviews returned through the assignment bus. Read from the
repository, not from chat: the results are on branches `assignments/ASG-20261125-bourse-plan-review-chatgpt-001` (final
head `090be21`, results commit `1357039`) and `assignments/ASG-20261125-bourse-plan-review-mistral-001` (final head
`93122d0`, results commit `cd2ac22`) of the private Continuity repository; both reviewed pull request 10 at `0df8781`.
The trusted completion verifier from Continuity's `main` (`d8525db`) passes both assignments; its only failures are older
assignments whose history is outside the shallow checkout used.

**Verdicts.** ChatGPT (it reports itself as Codex, GPT-6 family): **FAIL**, 2 blockers, 14 major, 1 minor, 1 note.
Mistral (`mistral-large-4-0`): **PASS**, 4 minor, 4 notes. The two are not in conflict on the facts: Mistral's minor
findings are a subset of ChatGPT's, and ChatGPT's added findings come with concrete counterexamples, several of which
were checked against the code here (see "Checked"). **Ruling: the plan fails this round; building stays paused; the
plan and the look are corrected and reviewed again.**

**Checked by the requester against the code.**
- Finding 02: in `tracker/src/core/merge.js` a unit removed on one side and changed on the other becomes a conflict whose
  provisional value is this device's side (lines 98 to 100), and `ET.applyMerge` without a choice takes this device's
  side (line 278), so a merge applied without asking deletes the edit when this device is the removing side. The merges
  applied after an upload and at the end of a sync pass no choices (line 243 comment); `ET.saveMerge` in
  `tracker/src/core/storage.js` (line 112) also applies one with no choices. Confirmed.
- Finding 04: `docs/bourse-spec.md` line 277 still makes the buyer's tax conditional, although `docs/bourse-research.md`
  section 4 records that both sides pay. Confirmed.
- Finding 08: the spec never names where the trip starts, so "fewest hops" has no anchor; the mock-up starts on Primal
  and returns to the home data center (two hops where starting at home gives one). Confirmed.
- Finding 15: `docs/bourse/tools/shoot.mjs` counts rows inside the whole viewport without subtracting the fixed bottom
  bar, the seal bar and the status line. Confirmed (the requester's own measurement flaw).

## Rulings

Severity after adjudication. "Spec" means the fix goes into `docs/bourse-spec.md`; "look" into the look spec, the mock-ups
and the picture tools.

| # | Reviewer's severity | Ruling | Where the fix goes |
| --- | --- | --- | --- |
| ChatGPT 01 | MAJOR | Accepted, MAJOR. One binding ledger of decisions (later rounds replacing earlier ones), dependency order (rules pull request, then module moves, then the Bourse), the downloaded file closed as round three answered, which character's world is home (precedence), "Copy name" placement and acceptance, the history summary (the approved Item screen shows the middle of the window; the earlier "this week against last week" idea is recorded as not taken). | Spec |
| ChatGPT 02 | BLOCKER | Accepted, BLOCKER. A mixed-version contract before the save shape is final: either older builds are made unable to write a save that holds the new section (fail closed), or removals are encoded so an older build's merge cannot turn a removal into a silent loss; tests in both orientations with no choice, through the real local and cloud paths. Area keys use the data-center names (no spaces). The choice between failing closed and accepting a transition window is put to the owner. | Spec; owner question |
| ChatGPT 03 | MAJOR | Accepted. Explicit outcomes (usable, confirmed empty, unknown, failed), validation of every reply field, last good values kept as stale after a failure, quality slots for display and subtotals, legacy quality unknown; tests for a capped HQ-only slice and a malformed success. | Spec |
| ChatGPT 04 | MAJOR | Accepted. The buyer's 5% is applied exactly once to market purchases before comparing with merchants; the seller's city rate to proceeds; whole-purchase rounding; before-tax or unknown figures never ranked after-tax; tests for both total encodings, the merchant crossover and rounding ties. | Spec |
| ChatGPT 05 | MAJOR | Accepted. Quantity and sample assumptions shown at rank, recursive unpriced cost defined, intermediate yields and rounding, zero-cost return (with Mistral F1), both sale bases side by side; a thin-data fixture. | Spec |
| ChatGPT 06 | MAJOR | Accepted. World identity, quality and time kept per sale and listing; one selected-world filter before every statistic; region-only figures labelled; unknown ages never count as fresh for alerts. | Spec |
| ChatGPT 07 | MAJOR | Accepted. The starting split prices each item over whole listings across all worlds (not a single-world shortcut); the large-quantity path is exact or labelled approximate with a conservative reference (with Mistral F6); tests for the cheap split against full coverage and the 2,001-unit overshoot. | Spec |
| ChatGPT 08 | MAJOR | Accepted. One comparison baseline and tie rule, the trip starts at the home world (home data center first unless the owner's savings rule says otherwise, counted from there), sole-supply regions, unknown and capped coverage told apart; tests at the threshold edge in every mode. | Spec; look (Trip example) |
| ChatGPT 09 | MAJOR | Accepted as MAJOR. A budget of candidate evaluations and input size, a deterministic fallback with labels, a phone-class timing run on the worst supported sizes. | Spec |
| ChatGPT 10 | BLOCKER | Accepted, BLOCKER. A purchase has its own identity and records what it credited; a fall in need is never read as a purchase; the mark and the Lists stock credit are one checked write with an idempotent retry and a conditional Undo; tests for a fault between the two, a changed list selection, stale tabs, the stock cap and an unrelated edit before Undo. | Spec |
| ChatGPT 11 | MAJOR | Accepted. The one-time copy checks the origin and key, handles duplicate and unmapped entries, makes the copy and its receipt one step, reports copied and skipped counts and keeps the source; tests for a crash, two tabs, malformed entries and a late-available origin. | Spec |
| ChatGPT 12 | MAJOR | Accepted. Attempts reserved and charged across pages of the device, a persisted back-off honoured by every page, bounds on reply size and parse time, caches keyed by service and place and merged per item; tests in parallel, forced refresh, partial region retry, storage refusal, oversized reply. Mistral F8 (Refresh lifts a failure pause) is kept but never lifts a rate-limit pause. | Spec |
| ChatGPT 13 | MAJOR | Accepted. One shared lease (browser locks where present; otherwise automatic alerts are suspended rather than raced), rechecks at load, send and display, late outcomes discarded, re-arming only from a fresh above-target result for the same item and quality. | Spec |
| ChatGPT 14 | MAJOR | Accepted. Guards separated from change-sensitive assertions with a positive control for every negative check; large items split by contract; new and existing paths stated; the Lists store dependency named. | Spec |
| ChatGPT 15 | MAJOR | Accepted. Rows measured against the area left visible by the fixed bars and the alert; the required counts met or the shortfall recorded; opened rows, the longest names and large text measured. | Look; spec (C206) |
| ChatGPT 16 | MAJOR | Accepted. Phone switches reachable (quality, ranking); a data-center selector in Bourse settings (the seven, each a box); one threshold and default per written rule; the Trip example's total excludes what is bought and labels the optional region; the Watch legend only where its marks are drawn. | Look |
| ChatGPT 17 | MINOR | Accepted. Notes regenerated for look v3; the alert shows Close and the age; no reading text under the house sizes; budget and interval wording matching the spec. | Look |
| ChatGPT 18 | NOTE | Accepted. The maintenance data's date and the route caveat shown; planning summaries point to the five rounds. | Spec |
| Mistral F1 | MINOR | Accepted (with ChatGPT 05): zero-cost return shows "no cost", never a computed figure. | Spec |
| Mistral F2 | MINOR | Accepted: one stored and shown history window, 7 days, 30 when the site has them, consistent everywhere. | Spec, look spec |
| Mistral F3 | MINOR | Accepted (with ChatGPT 01): closed questions marked closed; no stale look-approval wait. | Spec |
| Mistral F4 | MINOR | Accepted: alert interval default 30 minutes in both documents. | Spec, look spec, settings drawing |
| Mistral F5 | NOTE | Accepted (with ChatGPT 17). | Look |
| Mistral F6 | NOTE | Accepted, raised to MAJOR with ChatGPT 07. | Spec |
| Mistral F7 | NOTE | Accepted, raised to BLOCKER with ChatGPT 02. | Spec |
| Mistral F8 | NOTE | Accepted (with ChatGPT 12). | Spec |

No finding is rejected.

## What happens next

1. The spec is corrected (planning agent) and the look and its measurements are corrected (requester), with this table as
   the brief.
2. The owner is asked one question: how to protect saves against older cached copies of the apps (finding 02).
3. A second review round goes to both reviewers through the assignment bus, limited to the corrections.
4. Building stays paused until that round passes, and then follows the owner's order: the one-look rules pull request,
   the module moves, the Bourse last.
