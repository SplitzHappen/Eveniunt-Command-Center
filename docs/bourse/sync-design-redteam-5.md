# In-house red team of `docs/bourse-sync-design.md` version 5 (2026-11-28)

A fresh Claude reviewer agent, read-only and in-house (not the outside review), reviewed version 5 at `f1446bb`.

**Verdict.** No blocker, 2 major and 5 minor faults, each a local edit to the text.
- G-3 to G-6 are closed. The stock numbers in S6, S13, T13 and T32 now agree, and no receipt is dropped as a side
  effect of choosing a copy.
- G-6 was checked in local SQLite 3.53.1: a blob bind is refused (also after a text row exists), a trailing zero byte
  and uppercase hex are refused, a takeover after expiry works, a stale consume changes 0 rows, and a seal during a live
  lease changes 0 rows.
- G-2 holds in its main case. Removals still go through the receiving confirmation, and reverted writes, queued work
  and replacements count as local work.
- G-1 is only partly closed. An own-upload ack cannot claim a point the device never installed, but the receipt still
  freezes in an ordinary state (H-1), and registration still affects classification and retention (H-2).
- The cited code lines are accurate.

**H-1. MAJOR. The G-1 problem returns whenever the editing device has an open question** (S10, S13, T44).
- The rule: the receipt advances only when "the exact verified active edition is installed … with no unresolved older
  work", and S13 keeps the old acknowledgement "while unresolved or queued work still needs older proof".
- Under S3, an unanswered group keeps each device's own value, so the PC's local active edition differs from the cloud's
  for as long as the question is open.
- Counterexample:
  1. The PC has the T12 overflow question open (T15 keeps it "through three syncs"), or a "Needs review" item.
  2. For 50 days the PC keeps editing and uploading, and the phone only reads.
  3. The PC's receipt and ack stay at P0. The pruning minimum is stuck, so the log fills and is cut by the size cap
     alone (the option the owner did not choose in round fifteen), and every write uploads the full log.
  4. When the cap cut passes P0, the PC is "behind" although it syncs daily. Every group it wrote since P0 counts as
     local work, so the shortcut fails, and each of those groups that the phone also changed is prompted one by one.

  The same freeze happens if "exact" is read literally and the player edits during the sync round trip.
- Fix:
  - define "installed" as: the verified edition equals the local active edition, or is an ancestor of it, outside open
    groups whose alternatives are durably held as tips or proposals;
  - let unresolved work that is held as proposals or detached proposals stop only the ack for those groups, not the
    receipt;
  - add an open-question case to T44.

**H-2. MAJOR. A lost first registration loses the log for that device and makes it "unknown"** (S13).
- The rules:
  - registration happens only after activation, by a separate write;
  - dropping counts only registered entries;
  - ordinary reconciliation requires "a registered device", and "no usable receipt or registration" means unknown,
    which contradicts "behind has one definition".
- Counterexample:
  1. A new phone finishes its first comparison and installs P50. The registration write fails (a 412 retry, then the
     tab is closed, which is common on phones).
  2. The PC uploads and acks its own upload. The minimum over registered entries is now the PC's head, so the floor
     goes to the head.
  3. The phone adds 20 ticks and syncs. Its receipt is below the floor, and it is unregistered, so it is unknown.
  4. It gets 20 separate "Only on this device — it may have been deleted elsewhere" prompts, with no bulk keep. Today
     these merge automatically.
- Fix:
  - remove "registered" from the reconciliation rule;
  - carry the first registration in the conditional write that publishes activation;
  - for a reader with no content write, register before activation with a pruning-only pin at the compared point,
    which does not count as an ack for classification;
  - re-register on the next contact while the receipt is still retained.

**H-3. MINOR. Ack writes have no "skip if nothing new" rule, so two devices can bounce ack writes back and forth.**
- The text: "Once installed, issue the separate S13 acknowledgement", and "A matching already-local edition still
  requires the guarded receipt commit".
- Counterexample: the PC's ack write changes the file tag. The phone reads it, finds the same point, runs the finalizer
  and acks. The PC sees the new tag and does the same. Each round re-uploads the whole body (up to 4 MiB).
- Even without a loop, every edit costs three full uploads.
- Fix: write an ack only when the registry entry is below the newly installed point. Ack-only and trim-only writes
  never trigger an ack. Add a pending ack to the device's next content write where possible.

**H-4. MINOR. What declining the removals in the one labelled update does is ambiguous** (S13, T32).
- The text says "A decline preserves the affected groups" and also "Apply compatible changes atomically".
- If the additions are applied while the receipt stays put, they become writes made after the receipt's point. On the
  next sync those groups count as local work, and the G-2 prompts come back for any later cloud change to them.
- Fix: either a declined removal applies nothing (today's behaviour: "keep this device unchanged and not sync now"), or
  the rest is installed as cloud state and the declined groups are recorded as local keeps, so the receipt advances.

**H-5. MINOR. T13's trimmed run does not test the reset anchors.**
- The phone's credit and the PC's +1 come after C and descend from the reset, so the result is 91 whether or not the
  anchors exist.
- A device inside the log never needs the anchors, because any operation concurrent with the reset belongs to a device
  behind the floor. The design also says the digest never proves inclusion. Only "mutated floor fails validation"
  would catch dropped anchors.
- Fix: state that anchors are labelling evidence only, and assert in T32's third run the label that depends on them.
  Otherwise, stop claiming that T13 covers them.

**H-6. MINOR. The lease is called "renewable", but no statement renews it.**
- Checked in SQLite: a reserve with the same generation changes 0 rows, both while the lease is live and after it
  expires.
- Counterexample: a first create that uploads a large save on a slow phone takes more than 120 s. A waiter rechecks the
  name, finds it still absent, and takes over. A's file then lands, and the automatic read is forfeited. T28 treats
  that outcome as correct.
- Fix: add `UPDATE … SET expires=unixepoch()+120 WHERE drive_key=?1 AND generation=?2 AND state=0 AND
  expires>unixepoch()` and use it during long creates. Otherwise, delete "renewable" and state a ceiling for create
  time.

**H-7. MINOR. New test gaps.**
- T32's mixed run has no negative case for a backup load or guard restore (with epoch rotation) between the installed
  point and the return, or for a local edit in another module the group depends on.
- T44 has no open-question case (H-1) and no lost-registration case (H-2).
- T42's positive column never shows the unsupported-format manual create succeeding.
- The rest hold:
  - T28 and T42's blob binds have real positive controls and would fail without their mechanism;
  - T44's "active pair advances the minimum" would fail without own-upload acks;
  - T32's clean run would fail without the shortcut.

**Not tested:** live D1 and OneDrive.
