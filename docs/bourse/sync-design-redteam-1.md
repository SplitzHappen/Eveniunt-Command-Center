# In-house red team of `docs/bourse-sync-design.md` (2026-11-27)

A fresh Claude reviewer agent, read-only, which ran nothing, reviewed the design at `f20a93c`. Claude is a different
model family from the design's writer. This is an in-house check, not the planned outside review. The requester
confirmed the code facts marked "confirmed" in `docs/bourse-review-adjudication-6.md`.

**Overall.**
- **Sound in principle.** A last-writer register per path, kept over a causal graph of edits with explicit deletion
  records, is a known-good basis. For a history that starts from one seed it gives the right answer for a delete
  followed by a re-add, a revert to the original value, three or more branches and repeated deliveries. It closes the
  "lost base revives deletions" class.
- **Where the faults sit.** At the edges: histories with several seeds, character slots whose ids are reused, the
  meeting of own stock and receipts, and cost.
- **Not simpler than the plan it replaces.** It removes held questions, the undone maps, sequence winners, the ancestor
  window and the checkpoint. It adds canonical hashing, graph validation, scopes, consent records, source bundles,
  file generations, the guard copy, a new helper store and provider proofs, and it turns every module's write into a
  checked command.

**D-1. MAJOR. Joining two seeds leaves equal values contested** (S1/S2; section 3 "Merge evaluation").
- The problem: a reviewed bridge writes only the values decided as different, so a value equal in both seeds stays as
  two concurrent writes.
- Counterexample: A's seed and B's seed both hold tick X, and B links and writes bridge M. A, not yet synced, unticks X.
  When they meet, A's deletion descends from A's own seed write but not from B's, so S2 shows "removal concurrent with
  an edit", and answering Keep revives X. Every edit A makes before it receives M is affected, so every migration hits
  this.
- Fix: a bridge supersedes all in-scope writes of its parents, so equal values count as written by M. Add a T06 case
  with two roots.

**D-2. MAJOR. Removing a character and reusing its slot** (S2/S4; `tracker/src/core/model.js` 126-143;
`tracker/src/core/merge.js` 83-86, 341).
- The problem: character ids are slots c1 to c8, and the lowest free one is reused.
- Counterexample: the PC removes "Alt" (c3), then raises the character count back to 3, which creates a new c3 called
  "Character 3". Meanwhile the offline phone ticks 5 new items for Alt and renames it "Alt2". When they merge, the kept
  placeholder rule picks "Alt2" unasked, and the 5 ticks, on paths the PC never wrote, land as new. The new character
  ends up with the removed one's name and 5 of its ticks, and nobody was asked.
- Without the re-add, the ticks are left with no character, and today's `applyMerge` recreates it under the name "c3".
  S4 says no orphan may appear but gives no character rule, and T08 leaves characters out.
- Fix: a write under a character's ticks, exclusions or levels, made concurrently with the deletion of that character,
  is a conflict that names the character. Give each re-created slot a fresh incarnation in its paths. Never apply the
  placeholder rule against a branch that deleted the character.

**D-3. MAJOR. A typed count meeting a new purchase is counted twice and shown as certain** (S6).
- Counterexample: own stock is 10. The PC buys 40 with credit (receipt R, total 50); the phone has not synced. The
  player reads 50 in the game and types 50 on the phone, so own becomes 50 − 0 = 50. On sync, own has only one writer
  and R is active, so the total is 90, and no question is asked, because "competing own amounts" needs two own writes.
- Fix: an own-part write on one branch, plus a receipt added or cancelled on a concurrent branch in the same group,
  opens the stock preview (50 or 90). T11 to T13 never combine these two.

**D-4. MAJOR. History growth against the 4 MiB cloud ceiling** (S1/S13; `tracker/src/core/cloud.js` 142).
- The estimate (not measured): each node carries about 160 random hex characters (its id, its parent, its nonce),
  which compress poorly, so a node takes about 130 bytes once compressed and encoded. That fits about 20,000 to
  30,000 transactions, which at about 100 actions a day is under a year.
- After that, sync stops until a manual rollover. The rollover needs one resolved edition, starts a new file
  generation and detaches every other device into a full comparison.
- Fix: define the transaction size (one per debounce or command); trim automatically the causally stable prefix once
  every known tip contains it; add a growth test with realistic player volumes.

**D-5. MAJOR. Every edit rewrites the whole history twice, inside a synchronous storage step** (S5/S11; section 3;
`tracker/src/core/save.js` 416-425).
- The problem: history lives in `main`, and the guard is a second full copy. `CC.transact`'s callback is synchronous,
  and S5 requires replaying and committing inside that one transaction. So each tap writes the full history twice on
  the main thread.
- The node digest also has to be computed in there, but WebCrypto's digest is asynchronous, and waiting on it lets the
  transaction commit early. T34 measures replay only, not this write path.
- Fix: store nodes as immutable per-id records written once; keep the snapshot and pointers in `main`; let the guard
  cover the snapshot and pointers; compute the digest before the transaction against the expected parent, and retry
  if the active edition changed.

**D-6. MAJOR. The legacy-read grant store does not exist and cannot be built as written** (S9; implementation map;
`tracker/helper/wrangler.toml` 13-15; `tracker/helper/worker.js` 35, 60-61).
- The problem: the helper has only KV storage, which is eventually consistent and has no compare-and-set. By S9's own
  rule ("strongly consistent store required"), no grant can ever be issued on today's helper.
- "Derive drive identity from the authenticated session" cannot be built as it stands either: the helper keeps no
  account or drive id and throws away the ID token, so it would need a new Graph call or a stored account id.
- S8's create-only election already allows at most one legacy reader per file creation, so strict atomicity matters
  only for a delete-then-recreate.
- **Owner decision (fourteenth round):** use a free Cloudflare D1 database on the helper for this record. Specify the
  table, the atomic insert, how the drive identity is obtained, and the setup steps the owner performs.

**D-7. MINOR. Imports and restores detach the whole save** (S12; section 3).
- Counterexample: B deletes list L and syncs. Unsynced A then imports a Tracker-only backup. A's next sync is a full
  detached comparison, so L appears as "only on this device" with no sign B deleted it, and a group Keep revives it.
- Fix: detach only the imported scope, and carry the current ancestry forward for paths outside it.

**D-8. MINOR. Module rules assume one base and wall-clock times** (S4; `tracker/src/core/merge.js` 51-73;
`tracker/src/core/save.js` 257).
- The problem: the Submersibles field-by-field merge (`CC.mergeUnit`) needs a base, and criss-cross merges have
  several common ancestors. The duplicate-id re-key rule picks the "later" list by its creation time, which
  contradicts section 3's "ordering never depends on device time".
- Fix: say which base to use (for example a recursive merge of the common ancestors), and replace the time-based
  re-key with a choice ordered by digest.

**D-9. MINOR. An answer is bound to all tips, so it can be starved** (S3).
- The problem: any new tip, even an unrelated one from a busy second device, forces a fresh preview.
- Fix: bind the answer to the writes and dependencies of the disputed paths only.

**D-10. MINOR. The legacy "difference aid" can never apply** (S9).
- The problem: the old receipt has no account binding, so its provenance can never be proved. Every difference in
  the old file, including removals the first device made after its last sync, therefore needs explicit confirmation,
  and a bulk "take cloud" revives them.
- Fix: specify how provenance is proved, or delete the clause and state the cost.

**D-11. MINOR. 256 MiB decode limits** (section 3).
- The problem: today's cloud read stops at 64 MiB (`tracker/src/core/cloud.js` 168), and parsing up to 256 MiB of
  JSON on a phone, even in a worker, will run out of memory.
- Fix: keep 64 MiB, or stream.

**D-12. MINOR. Tests.**
- T01 tests a release calendar, which is a process step, not code.
- T28 cannot show store atomicity against a fake helper.
- No test covers D-1 to D-3: T06 uses a single root, T08 leaves out characters, and T11 to T13 never pair an own
  write with a concurrent receipt.
- The positive controls checked are real, and the T11 to T13 arithmetic is correct.

The design's citations of today's code checked are accurate. One slip: the 64 MiB cloud limit is at `cloud.js` 168,
not 138-148.
