# In-house red team of `docs/bourse-sync-design.md` version 2 (2026-11-27)

A fresh Claude reviewer agent, read-only and in-house (not the planned outside review), reviewed version 2 at `03eb382`. It ran nothing.

**Verdict.** Not ready for outside review: 2 major, 7 minor, no blocker.

- **Closed, with no new fault found:**
  - D-1: two roots;
  - D-3: an own-stock change concurrent with a credit change now asks, 50 or 90;
  - D-5: digests prepared before the transaction;
  - D-7: replacement scope limited;
  - D-8, D-9, D-10 and D-11.
- **Open again or still unclear:** the new automatic history trimming brings back D-4's "detach every device" at every cut, and the incarnation fix (D-2) is unclear for data owned by modules.
- **Not simpler:** the file grew from 92 KB to 107 KB, and it adds settled cuts, a page store, equivalence contraction and D1.

The code claims checked are accurate: `merge.js` 87 to 88 and 279; `cloud.js` 168, 194, 222 and 229; `codec.js` 98; `save.js` 22 to 26 and 416 to 425; `store.js` 301; `settings.js` 294; `worker.js` 27 to 77; `wrangler.toml` 13 to 15.

**E-1. MAJOR. Every cut puts devices behind it into a full comparison, and deleted entries come back unlabelled** (S13; S2; section 3 "Checkpoint").
- The problem:
  - Only a device sitting exactly on the closing tip carries forward. A device on an older ancestor cannot prove it, because the checkpoint keeps only the closing digest.
  - The checkpoint is an "exact checked projection", so it keeps no tombstones; only cancelled receipts survive.
- Counterexample:
  1. The phone syncs at edition E.
  2. On the PC the player deletes finished List L, unticks X and adds 300 ticks.
  3. The PC's sync crosses 3 MiB and cuts automatically.
  4. The phone reads a new generation and gets a detached comparison: 300 cloud-only ticks, plus L and X shown as "only on this device", with nothing saying they were deleted.
  5. Choosing Keep revives them.

  Two-device players reach this routinely (about every 87 days at 100 actions a day). A cutter's own edit that races the publish is also handled as a pre-cut device.
- Fix:
  - Cut at an older settled node and keep a recent suffix with its original ids; section 3 already allows parents covered by a checkpoint.
  - Keep tombstones in the checkpoint as path plus superseded write ids, so an old device can prove its copy is the deleted one and get the normal removal confirmation.

**E-2. MAJOR. Character data owned by modules is still keyed by slot** (S4; S6; section 3).
- The problem:
  - S4 and S6 say slot-bound values refer to an incarnation, but the path families `["own",owner,item,quality]` and `["module",name,group,unit]` carry no incarnation.
  - `identities.links/archived` has no path family and no merge rule.
  - The immutable purchase body `{o,i,q,n,of,cr,ls,t,at}` names its owner only as `c1..c8/u/x`.
- Counterexample:
  1. Alt (c3) has receipt R crediting 40.
  2. The PC removes Alt and creates Bob in c3.
  3. Offline, the phone sets Alt's Lists stock for item 5057 to 20.
  4. When they meet, the phone's write lands on the same path as Bob's stock: either an ordinary stock conflict, or an edit-versus-archive conflict where Keep gives the count to Bob.
  5. R's credit is still owned by `c3`, so Bob shows 40 he never bought, even on the PC alone.

  A builder cannot tell which reading is meant, and T08 and T39 cannot pass under the slot-keyed reading.
- Fix: put the incarnation (or `u`/`x`) in every owner-bound path and in the receipt body, and use slots only when materializing. Alternatively, make link rows history paths `["link",…]` with tombstones, checked in each write's parent view.

**E-3. MINOR. One lost claim reply loses the only automatic legacy read** (S9: "Zero changes returns spent, even for the same generation").
- Counterexample: the phone's claim insert commits, but the reply drops on mobile. Its retry gets `spent`, and no device ever reads the old file automatically.
- Fix: after the conditional insert, compare the stored `generation` with the request. The random 128-bit generation is known only to that attempt, so an equal value means a retry of the same attempt: return `granted` again until staging. The insert still decides the winner.

**E-4. MINOR. Drive-id normalization** (S9 hashes the "exact case-sensitive drive ID").
- The problem: third-party clients have reported (not verified here) that personal-OneDrive drive ids come back with different letter case or a missing leading zero.
  - A change between the helper's read and the client's read would hold creation for good.
  - A change between two claims would make a second row and a second legacy read.
- Fix: normalize before hashing (lowercase; pad personal ids to 16), or add a casing check across calls to the T28 gate.

**E-5. MINOR. An edit that fails both automatic retries has no defined fate** (S5: "Limit automatic contention retries to two").
- The problem: under contention between the sync finalizer, Tracker and Command Center, a disjoint tick that fails twice has nowhere specified to go. Today's `CC.transact` (`save.js` 416) never drops an edit.
- Fix: keep the intent queued and retry when the competing writer commits. Never discard it.

**E-6. MINOR. No rule for when old pages and nodes are cleaned up** (section 3; S13).
- The problem: "Never rewrite an old page." Each edit copies leaf and ancestor pages in both the main and guard namespaces (roughly 20 to 35 KB, an estimate), and the only cleanup mentioned is after a checkpoint. About 8,700 edits between cuts could leave a few hundred MB of garbage; quota then fails, and S12 frees only the price cache.
- Fix: run reachability cleanup after commits, and add a storage-growth limit to T38.

**E-7. MINOR. Lists ± and craft actions ask whenever a credit changes at the same time** (S6).
- The problem: they are turned into absolute own-part writes. Crafting with an ingredient on the phone while the PC records a credited purchase of it raises a question, though the two changes commute.
- Fix: record a relative change for ± and craft; only typed absolute counts get the concurrent-receipt question.

**E-8. MINOR. Every multi-device player must map each character slot by hand on first link** (S4).
- The problem: each device's migration gives its own random incarnations, and same-number slots are never equated. Two devices with 8 characters already synced through the v1 file get 8 identity questions, and their equal ticks stay on separate paths until those are answered.
- Fix: propose same-number slots with matching names as one batch for a single confirmation.

**E-9. MINOR. Tests.**
- T32 states no required result for "a copy holding a pre-cut deleted item", and has no case for a device sitting on an ancestor of the closing tip.
- T39 only says "diff …", which cannot fail.
- T38's "named fixture" and phone are not named.
- Fix: add explicit observations (for T32: labelled as deleted elsewhere, and Keep needs consent), and name the device and fixture.

**D1 and owner setup.** The reviewer ran the CREATE and the INSERT … ON CONFLICT DO NOTHING in local SQLite 3.53:
- the changes were 1, then 0;
- the CHECK rejects a 63-character key;
- the `sqlite_schema` check query works.

Not verified on live D1: that `run()` reports `meta.changes` the same way, and that D1 permits the `sqlite_schema` query. The owner's steps match the repository's `wrangler.toml` and look followable.
