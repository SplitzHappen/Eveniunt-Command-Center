# Bourse save-and-sync design: adjudication of the outside review (2026-11-28)

Sources, from the private Continuity repository; both reviewed `docs/bourse-sync-design.md` version 5 at `64b1822`:

| Reviewer | Branch | Final head | Results commit | Package commit |
| --- | --- | --- | --- | --- |
| ChatGPT, fresh chat | `assignments/ASG-20261128-bourse-sync-design-review-chatgpt-001` | `3faba59` | `005f5a2` | `ff6b39d` |
| Mistral | `assignments/ASG-20261128-bourse-sync-design-review-mistral-001` | `373185a` | `6998b7a` | `1c2471d` |

Both packages are byte-identical to what was dispatched.

## Verdicts

- **ChatGPT** (Codex, GPT-6 family, the design author's family as the owner chose): **FAIL**.
  - "The causal-history approach is sound in principle", and a single builder can implement it in stages.
  - It confirms H-1, H-2, H-3, H-4 and H-6, and partly confirms H-5 and H-7. On H-5 it rejects limiting the anchors to
    display only.
  - It adds 9 new findings, 5 of them major (N-2 to N-5 and N-9), and no blocker.
- **Mistral** (`mistral-large-4-0`): **PASS**.
  - The approach is sound and implementable. It confirms H-1 to H-7 with their fixes.
  - It adds 2 new findings: M-1, a note that the consume statement ignores expiry, and M-2, a minor finding that a
    registry eviction gives the H-2 failure.

## Checked by the requester

- **N-5 confirmed.** The save carries a per-device `moved` record (`save.js` 6, 10, 212, 216), and the Atelier uses
  `moved.atelier` to tell shared from old local data (`atelier.js` 135). The design's version-2 shape does not carry it.
- **N-3's premise confirmed.** Today's readers stop at 64 MiB once expanded (`codec.js` 98, `cloud.js` 168), while the
  design bounds only the compressed wire size. The 70 MB expansion figure comes from the reviewer's synthetic probe and
  is not a measurement of the design's encoding.
- The other new findings follow from the design text as cited.

## Rulings

All findings are accepted, at the reviewers' severity. The owner's sixteenth round settles what happens next: ChatGPT
makes **one final revision** covering everything confirmed, and the result goes into the plan.

| # | Reviewer | Severity | Finding | Fix direction |
| --- | --- | --- | --- | --- |
| H-1 to H-7 | in-house; confirmed by both | 2 major, 5 minor | `docs/bourse/sync-design-redteam-5.md` | As the reviewers refine them. H-1: a guarded cloud base plus a durable overlay. H-2: carry the first registration in the publish write. H-4: a decline applies nothing. H-5: anchors stay part of the projection and validation. H-6: a fixed 120-second window, or a real renewal with a total deadline. |
| N-1 | ChatGPT | MINOR | Ordinary Lists Undo needs a replay boundary | Keep today's page-scoped Undo cards; key reversals by the original command |
| N-2 | ChatGPT | MAJOR | A cloud history cut does not bound the live local graph | A local checkpoint moves main, guard and roots forward; collection reclaims accepted ancestors |
| N-3 | ChatGPT | MAJOR | A writable cloud envelope can be unreadable (expanded size above 64 MiB) | Apply the reader's expanded, structure and wire limits before publishing; round-trip in tests |
| N-4 | ChatGPT | MAJOR | A terminal legacy seed can strand the only imported copy | Publish the legacy proposal and the imported marker in one conditional write |
| N-5 | ChatGPT | MAJOR | The existing per-device `moved` records have no version-2 carrier | Keep the whole `moved` record as guarded per-device metadata |
| N-6 | ChatGPT | MINOR | A fresh device cannot detect a cloud rollback | Split T35; state the recovery limit |
| N-7 | ChatGPT | MINOR | Receipt source hashes cannot be re-keyed | Forward canonicalization; otherwise "To check" |
| N-8 | ChatGPT | MINOR | No owner procedure for a D1 restore | Add a shutdown step to the owner setup |
| N-9 | ChatGPT | MAJOR | A stale tab can apply the wrong Lists credit setting | Bind the shown mode to the command; recheck it at commit |
| M-1 | Mistral | NOTE | Consume ignores expiry | One sentence in S9 (with H-6) |
| M-2 | Mistral | MINOR | Registry eviction gives the H-2 failure | Fold into H-2 |

ChatGPT's section 5 table of sharper test assertions is accepted as part of the revision.

## Next

The final revision is `ASG-20261128-bourse-sync-design-chatgpt-006`. After it, the requester verifies each fix is in
the text, which is a fix check, not a new red-team round. The design is then merged into the plan.

## Fix check of version 6 and merge (2026-11-28)

The source is assignment `ASG-20261128-bourse-sync-design-chatgpt-006` (final head `25d99cd`, results commit `d580dc3`,
package `0f96596`), byte-identical to what was dispatched. Version 6 (473 lines) has one row for each of H-1 to H-7,
N-1 to N-9, M-1 and M-2, each naming the design change and the test that must fail without it.

The requester checked that the fixes appear in the text itself:
- N-5: the whole `moved` record is carried in guarded per-device roots.
- N-3: the reader's 64 MiB expanded limit is enforced before publishing.
- N-8: the helper shutdown is in the owner setup and tested in T42.
- N-9: the displayed credit mode is bound to the command.
- H-4: Cancel applies nothing.
- H-6 and M-1: a fixed 120-second window.
- N-4: the proposal and the imported marker go in one conditional write.
- N-1 and N-2: page-visit Undo and local checkpoints.
- The new tests T45 to T47 exist.

This was a fix check, not a new review round.

Version 6 replaces `docs/bourse-sync-design.md` and is merged into the plan: `docs/bourse-spec.md` gains a binding-ledger
line and section 20, the replaced decisions are marked superseded or removed, and banners are added on sections 6.7,
6.8, 8, 10 and 11.
