# Bourse plan: the save-and-sync design by ChatGPT (2026-11-27)

The source is assignment `ASG-20261127-bourse-sync-design-chatgpt-001` of the private Continuity repository: final head
`28f5e94`, results commit `ee90f0f`, package `564acc8`, which is byte-identical to what was dispatched. Its
`results/SYNC_DESIGN.md` (413 lines) is copied unchanged as `docs/bourse-sync-design.md`. The writer gives Codex,
GPT-6 family.

## What the design is

The design replaces the plan's save-and-sync rules with a **history of edits**. Every save carries a small graph of
transactions: each names the edition it edited, and a removal writes an explicit deletion record. Two devices then
merge by following that history, so a device can always tell "removed there" from "added here". This removes the
plan's careful merge, held questions, undo and rejection marks, re-derived ids, per-key undecided lists and the
old-file checkpoint (its section 6 maps D70 to D88 away). Other changes:

- Stock is the player's own part plus immutable receipts.
- A disputed group is held whole, and both alternatives are kept until the player answers.
- Writes are commands checked against the stored edition.
- The cloud file is replaced only conditionally.
- The one-time read of the old cloud file is guarded by a record kept by the sign-in helper.

It brings 35 acceptance tests (T01 to T35) and two owner choices.

## Checked by the requester

- The design's code claims that were spot-checked hold:
  - the cleaner's limits (`save.js` 30 to 38);
  - the unanswered clash defaulting to this device (`merge.js` 279);
  - the one-sided default (`merge.js` 87 to 88);
  - the old drive fields (`cloud.js` 194, 222, 229);
  - the helper's place (`cloud.js` 2 to 6).
- **Not in the design:** the sign-in helper stores data in Cloudflare KV (`tracker/helper/wrangler.toml`), which is not
  transactional. The design's "atomic unique insert" for the one-time read needs a different store (for example
  Cloudflare D1 or a Durable Object), and that is a change to the owner's own hosted service.
- **Scope:** the design changes how every module saves and syncs, not only the Bourse: Tracker, Lists, Atelier,
  Submersibles and Settings become commands with a portable history. It is a larger piece of work than the Bourse
  itself.

## In-house red team of the design (2026-11-27)

A fresh reviewer agent (Claude: a different model family from the writer, but an in-house check, not the planned
outside review) read the design and the code.

**Verdict.** The design is sound in principle: with one seed it handles a delete followed by a re-add, a revert to the
original value, three or more branches and repeated deliveries correctly, and it closes the "lost base revives
deletions" class. It is not simpler than the plan it replaces: it removes held questions, the undone maps, sequence
winners, the ancestor window and the checkpoint, but adds hashing, graph checks, scopes, consent records, file
generations, a new helper store, and a checked command for every module's write. No blocker; 6 major and 6 minor
faults, all at the edges.

| # | Severity | Finding | Checked |
| --- | --- | --- | --- |
| D-1 | MAJOR | Joining two seeds leaves equal values as two concurrent writes, so an edit made before the bridge arrives reads as concurrent with it ("Keep" revives an untick). This hits every migration. A bridge must supersede all in-scope writes of its parents. | Follows from S1, S2 and section 3 |
| D-2 | MAJOR | Character slots are reused (`model.js` 128 to 130), so a removed character's ticks and name can land on a new character in the same slot without a question. Each slot needs a fresh incarnation, and the placeholder rule must never apply against a branch that deleted the character. | Slot reuse confirmed |
| D-3 | MAJOR | A typed count on one device meeting a new purchase on another adds them unasked (50 typed + 40 credit = 90). An own-part write concurrent with a receipt change must open the stock preview. | Follows from S6 |
| D-4 | MAJOR | History growth: about 130 bytes per edit node (estimate, not measured) fills the 4 MiB cloud ceiling in under a year at 100 actions a day, then sync stops until a manual rollover. Define the transaction size and trim the history all devices already share. | Ceiling confirmed (`cloud.js` 142) |
| D-5 | MAJOR | Every edit rewrites the whole history twice (main and guard) inside a synchronous storage step, and the node digest needs asynchronous WebCrypto. Store nodes as immutable records written once; compute the digest before the transaction. | Follows from S5, S11 and `save.js` 416 to 425 |
| D-6 | MAJOR | The legacy-read grant store does not exist: the helper has only KV, which is eventually consistent and has no compare-and-set, and it keeps no drive identity. Name a D1 or Durable Object store (cost), or accept a KV put-if-absent and rely on the create-only rule. | KV confirmed (`wrangler.toml` 13) |
| D-7 to D-12 | MINOR | Imports detach the whole save instead of their own scope; module rules need one base and use wall-clock order; answers bound to all tips can be starved; the legacy "difference aid" can never apply; the 256 MiB decode limit (today `cloud.js` 168 stops at 64 MiB); tests missing for D-1 to D-3, and T01 tests a calendar. | `cloud.js` 168 confirmed |

## Next

The owner adopted the design (fourteenth round): ChatGPT revises it for D-1 to D-12 (assignment
`ASG-20261127-bourse-sync-design-chatgpt-002`); browsers without room save locally only; the one-time read is guarded
by a record in a free Cloudflare D1 database on the sign-in helper. Then an in-house check, the merge into the plan,
and an outside review.

## Version 2 of the design (2026-11-27)

Source: assignment `ASG-20261127-bourse-sync-design-chatgpt-002` (final head `1e78633`, results commit `6c23a57`,
package `56909a1`, byte-identical to what was dispatched). The complete revision (422 lines) replaces
`docs/bourse-sync-design.md`. Its section 5 has a row for each finding D-1 to D-12.

It removes five mechanisms of version 1:
- the all-tips answer lock;
- the whole-document detach for a partial import;
- the unprovable old-file comparison base;
- the duplicated graph in each save;
- the manual-only rollover (history is now trimmed once settled).

It specifies the D1 record: one table, one conditional insert, the drive identity read from Microsoft's app-folder
call, and owner setup steps. It raises no new owner choice. ChatGPT tested the table and insert in a local SQLite
database only. A fresh in-house check of version 2 follows.

## In-house check of version 2 (2026-11-27)

A fresh reviewer agent found 2 major and 7 minor faults, down from 6 major (full report in
`docs/bourse/sync-design-redteam-2.md`). Seven of the twelve version-1 findings are closed with no new fault.

The two major faults:
- **E-1:** the automatic history trimming puts every device behind a cut into a full comparison, without the deletion
  records.
- **E-2:** character data owned by modules is still keyed by slot.

The code claims and the D1 statements checked hold, in local SQLite. Live D1 is unverified.

**Ruling:** all accepted. Under the owner's fourteenth round (ChatGPT revises), they go to ChatGPT as
`ASG-20261127-bourse-sync-design-chatgpt-003`.

## Version 3 of the design (2026-11-27)

The source is assignment `ASG-20261127-bourse-sync-design-chatgpt-003` (final head `1a26968`, results commit `8518eec`,
package `d75b45e`), byte-identical to what was dispatched. The complete revision (367 lines, 97,423 bytes, down from
106,946) replaces `docs/bourse-sync-design.md`, and its section 5 has a row for each of E-1 to E-9. The main changes:
- Trims keep an ancestor index, an unchanged suffix and typed deletion records (E-1).
- Every owner-bound key and receipt carries a character incarnation (E-2).
- The D1 claim is split into a reserve and a one-way consume (E-3).
- Personal drive ids are canonicalized (E-4).

The listed simplifications:
- one history owns the incarnation links;
- the separate identity table is gone;
- a trim keeps its generation;
- one queue serves pending writes;
- safe character matches are confirmed as one batch.

No new owner choice. A fresh in-house check of version 3 follows.
