# In-house red team of `docs/bourse-sync-design.md` version 3 (2026-11-27)

A fresh Claude reviewer agent, read-only and in-house (not the planned outside review), reviewed version 3 at `8b14298`.

**Verdict.** Not ready for outside review: 2 major, 8 minor, no blocker. Most of version 3 holds up:
- E-2: in the Alt/Bob case the writes land on separate paths and the receipt names Alt's identity, so Bob gets nothing. Closed.
- E-3: a lost reservation reply is closed. Checked in local SQLite 3.53: reserve gives 1 change then 0, a retry returns
  the same reservation, consume gives 1 then 0, and a reserve after consume reports it used.
- E-4, E-5, E-6 and E-8: closed, apart from the release checks the design itself names.
- E-7: closed; craft plus purchase gives 47 with no question.
- E-1: closes the version 2 counterexample, with one gap (F-1).
- The code claims checked are accurate, and no source file has changed since `4dfe074`.

**F-1. MAJOR. After a trim, a stock count can be shown as certain when the design says it must ask** (S13, section 3
"Checkpoint").
- The problem: a stock group is built from its last typed total plus later changes, so it has no single writer. The
  typed total's id and the purchases it had seen live only in node bodies that the trim removes.
- Counterexample:
  - Own stock is 10, with no purchases. The phone, offline at E, buys 40 with credit (shows 50).
  - The PC types 50 (a typed total that saw no purchase), then Lists +1 (own 51), then 600 ticks, and trims at a
    point after all of that.
  - The phone returns with E in the index. S6 requires a question: 51 with the purchase included, or 91. But the kept
    frontier only says own 51, last changed by a node the phone does not know. Nothing shows that a typed total sits
    between E and the trim, so a natural build treats the change as commuting and shows 91 as certain.
  - The same happens with an offline −3 (49 or 52) or an offline Undo.
- Fix: for each stock group the frontier keeps the last typed-total id, the hash of the purchases it saw, and the ids of
  changes since. Add this case to T32 and T13.

**F-2. MAJOR. Cloud sync eventually stops for good, and the owner has not been asked** (S13 last paragraph; section 8
"Limits"; section 7 says "no new owner choice").
- The problem: the proof never shrinks. Starting a new history is allowed only on file creation or a damaged-copy
  overwrite, so at the hard limit sync pauses with no designed way back.
- The estimate (not measured): from the design's own figures (1.5 MiB a year of ids at 100 edits a day, a 1.5 MiB
  snapshot budget, a limit of 4,128,768 bytes), a heavy player stops at about 1.5 years, and sooner with deletion
  records. Today's sync has no such limit.
- Fix (a design matter): for example, record each device's last acknowledged trim in the cloud file and drop index ids
  that every known device has passed, with unknown devices falling back to the labelled comparison; or add an explicit
  "start a fresh history" action. Put the time limit to the owner in plain words.

**F-3. MINOR. The one automatic read of the old cloud file can be skipped** (S9). Either way below, no device reads
the old file, against round twelve's "read once, by the first device to update", and the data then needs manual file
recovery.
- (a) A reserves. B is refused as "spent" while v2 is still absent, and under "a known-spent device can use its own data
  in a create-only recovery" it creates v2 first. A's create then fails, and A gets no read.
- (b) A reserves, then loses its storage or its epoch changes before it creates, which leaves the reservation dead for
  good.
- Fix: the reserve reply says when another device holds an unused reservation, and a spent device waits a bounded time,
  with a visible notice, before creating. Add the race to T28.

**F-4. MINOR. The design does not say what happens to the first v2 file when the claim service cannot answer** (S9).
- The cases: a missing binding, a rewound database, a drive id outside 1 to 16 hex characters, or the helper down.
- The conflict: "an uncertain store response holds initial creation" against "disabled migration issues zero grants".
  Read as "hold", an outage or an unusual id format blocks every player's first v2 sync. Read as "go on", the read is
  silently lost.
- Fix: state one rule (for example, hold up to N days with a notice, then create with seed=manual), and test it in T42.

**F-5. MINOR. A device adopting a new trim never checks that the prior records survive.**
- The problem: S10 checks the pin for active and tip ids only, not that the old covered, deletions and absorbed sets
  are all kept. The device's cleanup then deletes its own copies, so a faulty or older trimming build that dropped
  deletion records would be accepted, and deleted items could later come back unlabelled.
- Fix: require each of those sets to contain the previous one before adopting. Add a case to T32 or T41.

**F-6. MINOR. T32's numbers cannot produce the trim it describes.**
- The problem: about 302 PC changes after E cannot put the trim after E and after the deletions while keeping at least
  512 nodes after it. A builder will trim before E or leave the deletions in the kept suffix, either of which skips the
  mechanism under test.
- Fix: put the deletions between E and the trim, add at least 600 ticks after it, and check that L and X appear in the
  trim's deletion records.

**F-7. MINOR. T28 can pass without ever reading the old file.** "Logical legacy GET count ≤1" passes a build that
never reads. Fix: require exactly one GET on the success path.

**F-8. MINOR. T08 does not require B's offline Alt edits to survive.** A build that drops the rename, the five ticks,
the exclusion, the level and stock 20 still passes. Fix: after approval, restored Alt shows each of them.

**F-9. MINOR. A character added on two devices ends up split** (S4).
- The problem: after the move to v2, adding the same character offline on two devices, or re-adding one, gives two
  identities. Pairing exists only on first link, so one device's ticks are left on an identity with no slot
  (recoverable, but hidden).
- Fix: offer the S4 pairing on any slot clash with equal real names.

**F-10. MINOR. The table checks only lengths** (S9 SQL).
- The problem: 64 "é" characters and "Z"×32 were accepted locally.
- Fix: add a hex-only check, for example `NOT GLOB '*[^0-9a-f]*'`.
- Also: the implementation map says to "extend" `tracker/tests/bourse-versions.test.js`, which does not exist yet; the
  spec lists it as new.

**Not verified:** live D1 change counts, whether D1 allows the `sqlite_schema` query, Microsoft drive-id formats, and the
dashboard menu names.
