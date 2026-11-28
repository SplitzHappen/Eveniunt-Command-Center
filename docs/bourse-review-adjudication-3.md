# Bourse plan: adjudication of the two outside reviews (round three)

Written 2026-11-26 by the requester (Claude). Source: the private Continuity repository.

| Reviewer | Branch | Final head | Results commit | Package commit |
| --- | --- | --- | --- | --- |
| ChatGPT | `assignments/ASG-20261126-bourse-plan-review-chatgpt-003` | `179eec1` | `1171b55` | `902d91b` |
| Mistral | `assignments/ASG-20261126-bourse-plan-review-mistral-003` | `58d0c78` | `b3c18ab` | `3952dee` |

Both reviewers read pull request 10 at `6734ea5`. Their package files are byte-identical to what was dispatched.

## Verdicts and ruling

- **ChatGPT** (Codex, GPT-6 family): **FAIL**, with 3 blockers, 11 major findings and 2 minor ones. It also corrected its own round-two tax example: the small listing is 3 at 12 (total 36, tax 1), not a 35-gil one.
- **Mistral** (`mistral-large-4-0`): **PASS**, with 3 notes.

Two of Mistral's supporting claims are wrong when checked against the code (see "Where the reviewers disagree"). ChatGPT's first blocker is confirmed in the code and affects every module, not only the Bourse.

**Ruling:** the plan fails round three, and the Bourse stays paused. The owner already chose a third round beyond the two rounds the request covered. Whether a fourth round runs after the corrections is the owner's decision.

## Checked by the requester

**ChatGPT F01: the old Tracker's "Erase everything" wipes a version-2 save.** Confirmed.

- In `tracker/src/core/storage.js`, `ET.clearState` (lines 292 to 305) catches the error `CC.checkDoc` raises for a newer save. It replaces that save with `CC.emptyDoc()` and writes it back.
- Any older Tracker page that sees a version-2 save would therefore erase every module's section if the player chose "Erase everything" (`ui.js` line 1011).
- Its confirmation text even promises that the Atelier's macros stay kept.
- It is the only path that does this. Lists, Submersibles, the Atelier, Settings and the ordinary Tracker save all refuse to write over a newer save (`lists.js` 300, `subs.js` 74 to 77, `atelier.js` 129 to 133, `settings.js` 26 and 59, `save.js` 571).
- B0's report ("no old write path overwrites") missed it.

**ChatGPT F05: a backup or transfer code replaces sections; it does not merge them.** Confirmed.

- `adoptLoaded` (`ui.js` 1016 to 1022) overlays each section the file carries.
- A file holding Lists but no Bourse section therefore replaces the Lists count and keeps this device's purchase records. The spec's sentence that "a backup or code merged in" runs through the merge rule is wrong.
- Settings rebuilds the merge base from a flat map (`settings.js` 316 to 334), without the purchase records.

**ChatGPT F03: the owner's overwrite of a damaged cloud copy.** Confirmed in the spec text.

- D48 has `ET.cloudOverwrite` fetch a fresh `eTag` after the player confirms (`ui.js` 1182 to 1184 asks first).
- If another device repairs the copy while the question is open, that fresh tag authorizes replacing a copy the player never saw.

**ChatGPT F02: the credit rule's limits.** Confirmed by arithmetic.

- At the 999,999 cap, two valid credits of 9 from 999,990 merge to 1,000,008. Clamping that to 999,999 makes the next merge read 9 fewer units of the player's own stock.
- A typed count below the credit, merged against an Undo, gives a negative result. The spec keeps "this device's count" with no durable record of the open question.
- The cap case needs a count within a few units of 999,999, so it is unrealistic in play. The negative case is ordinary.

**ChatGPT F08: honouring the price site's own waiting time (`Retry-After`).** Fact found.

- One request from this session (2026-11-26) returned `access-control-allow-origin: *` and no `Access-Control-Expose-Headers`.
- A browser page therefore cannot read `Retry-After` on the price site's replies. The plan must not promise to honour it; it needs its own backoff, with the header read only if it is ever exposed.

## Where the reviewers disagree

| Point | Mistral | Checked |
| --- | --- | --- |
| Older pages and a version-2 save | "B0 verified no older copy writes or uploads over a v2 save" | Wrong: `ET.clearState` does (F01). B0 read the save paths and missed the erase path. |
| A backup or code reaches the merge rule | Cites `storage.js` 165 to 169 | Wrong: those lines are the one-time catch-up from the pre-move save. Backups go through `adoptLoaded`, which replaces (F05). |
| `Retry-After` honoured with no ceiling | Polite, no change needed (R3-2) | Superseded: a browser cannot read the header (F08). |
| OneDrive's "fail if it exists" | NOTE, gated before shipping (R3-1) | Agreed in substance with ChatGPT F04; the hardening (read the copy again after a create and merge it) is accepted. |

As in rounds one and two, ChatGPT's findings carry concrete counterexamples that hold up when checked against the code. Mistral's verdict rested partly on the two wrong claims above.

## Rulings

The reviewers' severities are kept. Every BLOCKER and MAJOR finding must be fixed in the plan before building, whatever its label.

| # | Severity | Ruling | Where the fix goes |
| --- | --- | --- | --- |
| ChatGPT F01 | BLOCKER | Accepted (confirmed). A small fix to the live app first: "Erase everything" refuses a save it cannot read or that is newer, as every other writer already does. The save version rises only after that fix has shipped. New builds also keep a guard copy and detect a blank older-version save replacing a version-2 one, and offer to restore it. B24 and B28 test the erase path, the backup and code paths, and every other old writer. | Spec, plus a small live-app fix |
| ChatGPT F02 | BLOCKER | Accepted. The merge never stores a count that breaks "count = own part + credits": over the cap or under 0, the whole pair stays as it was and is asked, and the question survives a reload. Tests cover repeated syncs and Undo at both limits. | Spec (D46, BY2, B26) |
| ChatGPT F03 | BLOCKER | Accepted. The overwrite carries the identity and `eTag` of the copy the player was shown. A missing or changed tag stops the overwrite and asks again from a fresh read. Tested with a second device repairing the copy while the question is open. | Spec (D48, B27) |
| ChatGPT F04 | MAJOR | Accepted. After a create the copy is read again and merged if it differs (with Mistral R3-1). A same-version replacement, a missing checkpoint and a restored checkpoint are tested. Without a verified create-only route, the unsafe write is refused. | Spec (D48, B27) |
| ChatGPT F05 | MAJOR | Accepted (confirmed). The Lists counts and the purchase records move together as one unit on restore, merge and base rebuild. An unexplained missing record is asked, never taken as an Undo. LI6 checks the stock even after the last credit is gone. | Spec (D46, LI6, B26) |
| ChatGPT F06 | MAJOR | Accepted. Replay protection outlasts the retry window. Fallback storage either serializes ticks or refuses them visibly, keeping every saved amount. | Spec (D34, D47, B21, B23) |
| ChatGPT F07 | MAJOR | Accepted. Each trip has its own identity, not a shared number. Marks are bound to their need records, and conflicting settlements are asked. | Spec (D14, D47) |
| ChatGPT F08 | MAJOR | Accepted, plus the fact above. One dispatch decision checks the shared pause, expiry and order immediately before sending. Without real coordination across tabs, price requests stop. The plan uses its own backoff, never an unreadable header. | Spec (D4, D56, B18) |
| ChatGPT F09 | MAJOR | Accepted. A 10-listing slice is an observation, partial or unavailable. The asking price, the buyer's cost and the seller's proceeds are kept apart. | Spec (D49, D36, B5, B20) |
| ChatGPT F10 | MAJOR | Accepted. The 300-stack cap keeps coverage or says it is restricted. Every step's work is bounded, including preparation. | Spec (D55, B16, B25) |
| ChatGPT F11 | MAJOR | Accepted. An alert is rechecked against every saved input, including the age limits. Expiry applies when a request is queued, sent and published. A change of area clears or keeps an observation by an explicit rule. | Spec (D57, B15) |
| ChatGPT F12 | MAJOR | Accepted. Item's request budget covers its home read. The off-switch path proves disabled behaviour with positive controls. Every new write path is named. | Spec (section 10) |
| ChatGPT F13 | MAJOR | Accepted. Profit shows the second profit figure with a real seven-day sample. The phone Trip line counts region hops. The home-world picker says where the place came from without naming a character (D41). | Look |
| ChatGPT F14 | MAJOR | Accepted. A required single-source foreign stop counts in the total, or the total is labelled a subtotal. Every states-page amount comes from the tax helper. | Look, plus the spec's trip rule |
| ChatGPT F15 | MINOR | Accepted. The phone Watch and Profit facts no longer clip. The sheet's measures cover what they claim. | Look |
| ChatGPT F16 | MINOR | Accepted. The 36-gil row is cited; 35 is kept only as a named made-up case; counts and rounds are updated. | Spec, fixtures README |
| Mistral R3-1 | NOTE | Accepted (with F04). | Spec |
| Mistral R3-2 | NOTE | Superseded by F08. | Spec |
| Mistral R3-3 | NOTE | Accepted; it stays true after the fix. | Spec |

## What happens next

1. The owner answered (`docs/bourse-questions.md`, eighth round): keep building the Lists setting's rule; fold the
   "Erase everything" fix into the Bourse work as its first step; a fourth outside round with both reviewers.
2. The spec is corrected by the planning agent. The look and the examples are corrected by the requester.
3. The fix to "Erase everything" is the Bourse work's first step, shipped well before the save version rises.
4. Building stays paused until the plan passes. Then it follows the owner's order: the one-look rules, the module moves, and the Bourse last.
