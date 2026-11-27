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

## Next

A fresh in-house red team reads the design and the code. Then the owner decides on the design's two choices and its
scope, the design is merged into the plan, and an outside review follows.
