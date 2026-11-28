# In-house red team of `docs/bourse-sync-design.md` version 4 (2026-11-28)

A fresh Claude reviewer agent, read-only and in-house (not the outside review), reviewed version 4 at `3ce259b`.

**Verdict.** No blocker, 2 major and 4 minor faults; not yet ready for outside review. Each needs only a local fix.

**What holds up:**
- F-1 is closed by the design's structure. A device at or after the floor has every later node, including the typed
  reset; a device behind the floor gets the comparison.
- F-2 is closed: the log cannot stop sync, and no way was found for a trim to change tracked data.
- F-3 is closed for both earlier counterexamples. F-4 is closed except for one case (G-5).
- F-5 is closed: the overlap digests and the graph-against-saved-data check catch a dropped tombstone.
- F-6 to F-10 are closed, with one caveat on F-10 (G-6).
- Acknowledgements: a wrong, lost or raced ack only changes how much log is kept. Automatic merging needs the device's
  own receipt at a kept point, so no path was found where a device that missed a deletion is treated as having seen
  it. This holds only if "behind" is judged by that receipt (G-1).
- Code claims checked are accurate.
- D1 SQL, run in local SQLite 3.53.1:
  - reserve gives 1 change, then 0;
  - a retry with the same generation returns the same row, and another generation sees "held";
  - seal is refused while the lease is live;
  - consume works once;
  - seal and reserve on a spent row change nothing;
  - text that is not lowercase hex is rejected.

**G-1. MAJOR. The device doing most of the editing never acknowledges, and "behind" has two definitions** (S13).
- Counterexample: the PC does all the editing and the phone only reads. S13 says "Confirming an upload … does not
  advance" an ack, and the PC never installs a newer point from anyone else.
  - So the PC's ack stays at its registration point P0. The minimum ack never moves, nothing is dropped by acks, and
    the log fills to 1 MiB.
  - The first cap cut passes P0. One sentence then makes the PC "behind even though registered", so it gets "Compare
    and ask" against its own head; another, which judges by its receipt at the head, would merge automatically. A
    builder cannot satisfy both.
  - The PC is also the "least-recently advanced" entry, so at 64 devices it is evicted first.
  - Once any sleeping device's ack is below the floor and still counts in the minimum, ack-based dropping stops for
    good. In practice this is "the cap alone", which the owner did not choose in round fifteen, and every sync and
    every ack write uploads the full log.
- Fix:
  - a device acknowledges its own content commit once the stable read-back is installed as its active edition (S10);
  - "behind" is defined only by the device's verified local receipt against the floor;
  - any entry whose ack is below the floor is left out of the minimum;
  - add a one-editor, one-reader case to T44.

**G-2. MAJOR. A device with no local changes still faces item-by-item review** (S2, S13).
- Counterexample: the laptop syncs at point P100 and then sits unused for 50 days. Meanwhile the PC and phone add 900
  ticks, untick 5 and change 3 levels (about 4,500 edits), so the floor passes P100. The laptop has no local edits
  after P100.
  - It gets 900 entries reading "Only in the cloud — it may have been deleted on this device", and each needs its own
    choice ("No bulk Keep/Take"). A misclicked rejection deletes that tick everywhere.
  - Today's sync merges this automatically from its stored base (`cloud.js` three-way merge with `sync.drive.base`).
- Fix: the laptop's own kept history proves it wrote nothing on those paths since its verified point. For such paths,
  treat cloud differences as cloud-side changes and offer one labelled bulk accept. Keep removals under the normal
  receiving confirmation, and ask individually only on paths this device wrote. Add this to T32.

**G-3. MINOR. T13's trimmed case and the S13 stock examples cannot be built as written.**
- T13 does not say where the floor is. If the floor is at or before the phone's point, the cut is irrelevant and the
  reset anchors kept for F-1 are never exercised. T32's reset also sits after E, so no test fails if the anchors are
  dropped.
- If the floor is past the phone's point, the whole-copy comparison shows 50 (the phone: own 10 plus the receipt)
  against 51 (the cloud, no receipt) plus a one-sided receipt.
  - "51 with the purchase included" (own 11 plus the receipt) cannot be reached from either copy.
  - Choosing the cloud copy drops a purchase record.
- Fix:
  - place the floor in T13;
  - add a test with a reset before the floor and concurrent receipt and relative changes after it;
  - for groups behind the floor, offer "included / separate" totals labelled uncertain, never a receipt dropped as a
    side effect of choosing a copy.

**G-4. MINOR. Whether other devices may write into a `pending` file is undefined** (S9).
- Counterexample: A reserves at t0 and creates v2 at t0+100 s. B, waiting as "held", checks the name at t0+120 s,
  finds v2, joins its own save and uploads. At t0+125 s A finds the file "used" and cannot consume.
- Result: no device reads the old file, against round twelve, and the data needs manual recovery.
- Fix: while the D1 row is a live or unexpired reservation, treat a pending file as held; or allow the matching
  generation to consume after re-reading the current tag. Add the case to T28.

**G-5. MINOR. An unsupported drive-id format blocks the first v2 file for that player.**
- The problem: claims fail closed, and manual create is allowed only after a helper-wide shutdown of automatic reads.
  The format is a property of the drive, so no device of that drive can ever claim, and an explicit manual create
  (`seed: manual`) therefore cannot cause a second read.
- Fix: allow the explicit manual create for a deterministic unsupported format; keep holding for a transient missing
  identity. Add this to T42.

**G-6. MINOR. The D1 key can be stored twice under different types.**
- The problem: verified locally, binding the same 64 hex characters once as text and once as a blob gives two rows
  for one drive, so two reservations and two grants are possible.
- Fix: add `typeof(drive_key)='text'` and `typeof(generation)='text'` to the CHECKs, and include a blob bind in T42.

**Tests.** T08, T28, T34, T42, T43 and T44 each have a real positive control and would fail without their mechanism.
Two gaps: T13 and T32 do not cover the reset anchors (G-3), and T28 lacks the case where the lease expires while a
create is in flight.

**Not verified:** live D1 (including `unixepoch()` and the `sqlite_schema` query), Microsoft drive-id formats, the
dashboard menu names, and the 250-bytes-per-edit estimate.
