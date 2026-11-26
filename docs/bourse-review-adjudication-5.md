# Bourse plan: adjudication of the two outside reviews (round five)

Written 2026-11-26 by the requester (Claude), from the private Continuity repository.

| Reviewer | Branch | Final head | Results commit | Package commit |
| --- | --- | --- | --- | --- |
| ChatGPT | `assignments/ASG-20261126-bourse-plan-review-chatgpt-005` | `6c2f7e5` | `46967de` | `426ed96` |
| Mistral | `assignments/ASG-20261126-bourse-plan-review-mistral-005` | `4248359` | `885e0d4` | `fc992e2` |

Both reviewed pull request 10 at `c66b46d`. Both packages are byte-identical to what was dispatched.

## Verdicts and ruling

- **ChatGPT** (Codex, GPT-6 family): **FAIL**, with 2 blockers, 8 major findings and 2 minor ones. It names 10 of its 15 round-four findings closed and 5 partly open.
- **Mistral** (`mistral-large-4-0`): **PASS**, with 7 notes. Every note is a limit the spec already states.

**Ruling:** the plan fails round five, and the Bourse stays paused. A sixth round, or a change of scope, is the owner's decision.

## Checked by the requester

- **R5-02: an answer is not bound to its question.** Confirmed in the spec text. D70(5) stores an answer as `{ ans: 'x' | 'y', at }`. Nothing in it names the two alternatives it chose between, so a late answer can land on a newer question with different contents.
- **R5-03: a third device's purchase.** Follows from D70(3) to (5) as written. A question offers only the two alternatives it was raised with, and "leave this device's pair alone" does not add a third device's distinct pair to it. LI7 freezes typed counts, ticks and Undo, but not Lists' own Bought, Made, hand-in and Undo.
- **R5-11: stale text in section 8.** Confirmed. It still says new code "always writes 2" with one cloud file, and B27 still names BV-8 with its old expected result.
- **Mistral's notes** match limits the spec states. None contradicts a ChatGPT finding.

## How the reviews have moved

| Round | Blockers | Major | Blockers in the optional Lists credit setting |
| --- | --- | --- | --- |
| One | 2 | 14 | 1 |
| Two | 1 | 16 | 1 |
| Three | 3 | 11 | 1 |
| Four | 4 | 9 | 1 |
| Five | 2 | 8 | **2 of 2** |

- **The credit setting.** In round five, five of the ten serious findings sit in the credit setting and its held-pair protocol (R5-02, R5-03, R5-04, R5-05, R5-08). A sixth touches it in part (R5-01).
- **Everything else** has fewer findings each round, and they are narrower: R5-06 migration replay, R5-07 "cheapest seen", R5-09 importing a version-2 backup on a browser limited to version 1, R5-12 the first trip identity.

## Rulings

Every finding is accepted, at the reviewer's severity.

| # | Severity | Where the fix goes |
| --- | --- | --- |
| R5-01 Keep rotates the epoch; stale edits after Keep are refused | MAJOR | D65, D70(8), B30 |
| R5-02 Content-bound question identity; the answer bound to it | BLOCKER | D70, B26 (credit setting) |
| R5-03 A third distinct pair becomes a new alternative; every Lists change to the frozen stock is refused | BLOCKER | D70, LI7, B21, B26 (credit setting) |
| R5-04 The hold reaches the cloud, or is shown as local only | MAJOR | D70, B26 (credit setting) |
| R5-05 Invalid alternatives are quarantined, never offered | MAJOR | D70, BY2 step 0, B3, B26 (credit setting) |
| R5-06 A shared migration checkpoint, so old-file entries are not replayed | MAJOR | D67, B27 |
| R5-07 "Cheapest seen" unless a selection contract or a complete slice is proven | MAJOR | D49, D69, B5, B20 |
| R5-08 The off build refuses or keeps opaque the credited pairs it cannot merge | MAJOR | C216, B26 (credit setting) |
| R5-09 A version-2 import needs a guarded version-2 write first | MAJOR | D64, B3, B30 |
| R5-10 Sample and seller rate readable beside the Profit figure on both widths | MINOR | Look |
| R5-11 Stale section 8 text and BV-8 replaced | MINOR | Spec |
| R5-12 A trip identity is allocated with the first own-item write | MAJOR | D66, 6.7, B10, B13 |
| Mistral R5-1 to R5-7 | NOTE | Records only |

## What happens next

The owner decided (`docs/bourse-questions.md`, tenth round): keep the Lists setting in this plan; fix all twelve findings; a sixth outside round with both reviewers. Building stays paused until the plan passes.

## In-house red team before round six (2026-11-26)

At the owner's prompt, a fresh reviewer agent with no context (Opus, read-only, same family, so not independent) read
the round-five head `ecf457e` and the code before the sixth round was filed. It found 1 blocker, 7 major and 7 minor
faults that neither outside reviewer had raised. The requester checked the code facts.

| # | Severity | Finding | Checked |
| --- | --- | --- | --- |
| RT-1 | BLOCKER | "Merged with no base" is not safe: `merge.js` lines 87 and 88 take an entry held on one side only without a question, so removals made elsewhere come back. Every sync uploads, so 200 uploads (D63's line) is ordinary use, and the next sync after that silently revives removals. | Confirmed in `merge.js` and `cloud.js` |
| RT-2 | MAJOR | D72: after a decline, the settled entries are published and taken as base but not applied locally (`ui.js` 1214, `settings.js` 308 return early), so another device's removal comes back at the next sync. | Follows from the code read |
| RT-3 | MAJOR | Same-device merge: "leave this device's pair alone" keeps a stale Tracker tab's pair, because the Tracker listens on `eveniunt-tracker` while shared writes announce on `eveniunt-command-center`. | Channels confirmed (`storage.js` 235, `save.js` 677) |
| RT-4 | MAJOR | D76: a device that moves later uses an old-file base that is not the version-2 copy's base, so its additions read as removals elsewhere. | Follows from D76 as written |
| RT-5 | MAJOR | D76 takes Lists counts entry by entry, outside BY2: 10 plus a 40 credit against a typed 12 should give 52, not a choice of 12 or 50. | Follows from D76 as written |
| RT-6 | MAJOR | A Lists count of 0 has no stored entry (`lists/store.js` 301), so BY2 and the checker must read a missing entry as 0, and BY2 must decide before LY0. | Confirmed in `store.js` |
| RT-7 | MAJOR | D71: an answer removes the rejected records without a mark, so a device or backup that still holds one brings it back. | Follows from D71 and BY2 step 1 |
| RT-8 | MAJOR | D64(b): a browser limited to version 1 is not told what to do with the version-2 cloud copy, and D78's check then refuses its saves. | Follows from D64 and D78 |
| RT-9 to RT-15 | MINOR | D73's raw entry is altered by `clean()` (store it as a JSON string); stale section 8 text against D71 and D73; `why` inside the held entry breaks equal discoveries; the transfer code's only version is its prefix (`codec.js` 7: needs `EVT3-`); IndexedDB falls back per call, not per browser; D75's epoch must be checked before `cloudFinish` uploads; D8's "due again" waits an hour. | `codec.js` prefix confirmed |

**Ruling:** all accepted. They go to the planning agent with the round-five corrections, and a second fresh red team
runs on the result before the sixth round is filed. From now on a fresh in-house red team runs before every outside
round.

## Second in-house red team (2026-11-26)

A second fresh reviewer agent (same family) read `ea81d9d`. It found no blocker, 7 major and 7 minor faults. The
requester checked the code facts.

| # | Severity | Finding | Checked |
| --- | --- | --- | --- |
| RT2-1 | MAJOR | With no characters, Settings syncs a placeholder with no `modules` (`settings.js` 294); `ET.threeWay`'s `fill` (`merge.js` 38 to 40) then reads the cloud's sections as this device's, and the placeholder counts as untouched. Unsynced Lists, Atelier and Bourse changes can be replaced. This is probably a fault in today's app too: proposed to the owner as a separate task. The plan's careful merge must see the stored sections. | Mechanism confirmed in the code; the final write not run |
| RT2-2 | MAJOR | An answer's rejection marks survive a later, different answer, and a backup or another device can then remove the record the later answer kept. A rejection mark must name its question and be superseded. | Follows from D70 (6), D71 (3) and (4) |
| RT2-3 | MAJOR | The careful merge takes one-sided purchase records unasked (BY2 with no base), so a loaded older backup's dropped record comes back. | Follows from D80 (2) |
| RT2-4 | MAJOR | "Same root, higher count: descends" is false after the owner's overwrite. An overwrite must start a new root. | Follows from D80 (3) |
| RT2-5 | MAJOR | "Leave them out" would delete the entries on every device. Say so, or keep them in the cloud and out of the base. | Follows from D80 (2) |
| RT2-6 | MAJOR | Today's `sync.drive` stores `{ fileId, at, base }` with no `eTag` (`cloud.js` 194, 222, 229), so D76's "recorded tag equals `old.tag`" is never true for a real device. Use the entry hashes instead. | Confirmed |
| RT2-7 | MAJOR | Low storage: the guard doubles writes and the price cache has no limit, so migration fails, and D83 turns off cloud sync for every module. Clear the price cache on a space failure and cap it; a browser held at version 1 keeps syncing the old file. | Follows from D5, D64, D83 |
| RT2-8 to RT2-14 | MINOR | The IndexedDB home marker is written too late; schema and BS-11 contradict D71 and D73; D72 against D80 order; "as today" is wrong about today's prompts (`ui.js` 1208, 1213); `raw` is cut at 20,000 characters; LI7 refuses all of "Made"; BY2 omits `coll`. | `ui.js` prompts confirmed |

**Ruling:** all accepted. The planning agent fixes them; a third red team, limited to the new edits, runs before the sixth round is filed.

## Third in-house red team (2026-11-26), on the changes since the second

A third fresh reviewer agent (same family) read only the changes from `ea81d9d` to `101afc0`. It found 4 major and 5 minor faults, all in the newest edits:
- **"Not now" revives entries at the next sync:** a base is recorded without the undecided entries.
- **D84's chain of superseded answers can break:** an old rejection mark becomes live again.
- **A browser held at version 1 syncs one way:** it shows "Synced" while getting nothing from updated devices.
- **"A side without sections is an error" removes a shipped safeguard:** the one in `merge.js` 36 to 40, which `ET.catchUpMerge` relies on.

The minor faults are BK-37 undefined; `coll` with no base; deleting the price database also resets the request gates; two "as today" claims that are wrong (today's cloud sync has no untouched path: `ET.untouched` is used only by the catch-up, `storage.js` 164); and the overwrite does not say it keeps D76's checkpoint. The requester confirmed the `ET.untouched` fact in the code.

**Pattern:** three in-house red teams in a row found new major faults, each mostly in the edits made for the one before. The owner is asked how to go on before more edits are made.

## Fourth in-house red team (2026-11-26), on the changes `101afc0` to `feefdbf`

A fourth fresh reviewer agent (same family) found 3 major and 6 minor faults, down from 4 major.

| # | Severity | Finding | Checked |
| --- | --- | --- | --- |
| RT4-1 | MAJOR | An overwrite carries the overwriting device's possibly older checkpoint, so an entry removed after the old file was folded in comes back. A reader whose checkpoint differs from the copy's must fold the old file by the careful merge. | Follows from D88 (1) and D76 |
| RT4-2 | MAJOR | The re-chosen purchase id is the 24-character hash; the checker accepts 8 to 16. Use the first 12 characters, as `merge.js`'s LY6 `newId` does. | Confirmed (spec line 520; `merge.js` 52) |
| RT4-3 | MAJOR | The undecided keys are lost inside the same sync: `cloud.js` 221 merges this device's own copies again, and 194, 222 and 229 rebuild `sync.drive` whole without `open`; Settings' `done()` (321) does the same. | Confirmed in `cloud.js` |
| RT4-4 to RT4-9 | MINOR | A stale "untouched device" sentence in BY2 step 1; the old undo mark must be written with the rename; two answers to different questions meeting have no rule; a new device is offered "remove from every device"; Settings' automatic sync has no rule for showing the question; BG-9 and BV-32 lack positive controls. | — |

**Ruling:** all accepted. The planning agent fixes them; a fifth check follows (owner, eleventh round).

## Fifth in-house red team (2026-11-26), on the changes `feefdbf` to `f819271`

A fifth fresh reviewer agent (same family) found 3 major and 4 minor faults. Two of the major ones come from the
fourth round's fix (a copy that is not known ignores its checkpoint), which was too strict.

| # | Severity | Finding | Checked |
| --- | --- | --- | --- |
| RT5-1 | MAJOR | A device that moves later never has a record of the version-2 file, so "only when the copy is known" is never true: every later mover falls to the careful merge, and "keep them" can revive removals. BV-27 now contradicts D88 (1). Trust the checkpoint by its presence, not by "known". | Follows from D63, D67, D88 (1) |
| RT5-2 | MAJOR | A new device, or one after a loaded backup, ignores a valid checkpoint and is offered every entry removed since the move, to "take". Same fix. | Follows from D88 (1) |
| RT5-3 | MAJOR | The fresh checkpoint written after a careful fold marks undecided old-file entries as taken in, so they are later dropped everywhere. Leave undecided old-file entries out of a fresh checkpoint, and out of D76's comparison. | Follows from D76, D88 (1) |
| RT5-4 to RT5-7 | MINOR | `storage.js` 112 copies the tab's own `sync` over the stored one, so `open` is lost (add it to rule (c)); BV-32's `catchUpMerge` run passes anyway; Settings syncs at 351 and 352 (not 347), and 351 is the likely first careful merge; "a device with nothing" ignores what `ET.untouched` counts, and BV-34 has no fault run. | `storage.js` 112 and `settings.js` 351 to 352 confirmed |

**Ruling:** all accepted. A sixth check follows the fix (owner, eleventh round).

## Sixth in-house red team (2026-11-26), on the changes `f819271` to `9cc9c52`

A sixth fresh reviewer agent (same family) found 3 major and 3 minor faults. The count did not fall: 8, 7, 4, 3, 3, 3.
The reviewer confirmed the changed text's code claims.

| # | Severity | Finding |
| --- | --- | --- |
| RT6-1 | MAJOR | The `ask` keys are left out of the comparison but stay in the old-file base that is then used, so an older device's removal is revived (or its addition dropped) without a question. |
| RT6-2 | MAJOR | A key that leaves `ask` because both sides agree gets no mark, so after a later removal it is taken again from the old file. |
| RT6-3 | MAJOR | The `storage.js` 112 fix covers one path only: `ET.saveMerge` never receives the stored sync record (`codec.js` 26 drops it), the tab's own record is not refreshed after a merged save (`ui.js` 1255), and the next unmerged save writes the stale record (`storage.js` 35, 107). |
| RT6-4 to RT6-6 | MINOR | "The later `at`" depends on the wall clock; "kept whole" drops `fc` and `backupAt`; ordinary uploads must carry the checkpoint. |

**Pattern:** two of the three major faults are inside the old-file checkpoint mechanism that the last two rounds built
(D76, D88). The owner is asked how to go on.

## Seventh in-house red team (2026-11-26), on the simplified move (`9cc9c52` to `078c30b`)

A seventh fresh reviewer agent (same family) found 1 blocker, 1 major and 4 minor faults. The count fell to 2 serious
faults (from 3), and both are narrow.

| # | Severity | Finding | Checked |
| --- | --- | --- | --- |
| RT7-1 | BLOCKER | The new `seq` rule undoes "forget the base". `adoptLoaded` (`ui.js` 1017) and `ET.goBack` (`storage.js` 336) write `base: null` without raising `seq`, so on a tie the stored record, base included, wins. Loading last month's backup (250 ticks against a base of 300) then uploads the 50 as removals at the next ordinary sync, and `ET.mergeLoss` asks nothing because the removals come from this side. Fix: every writer that drops or replaces `drive` writes the stored `seq` + 1, read inside the transaction. | Confirmed (`ui.js` 1017, `storage.js` 336) |
| RT7-2 | MAJOR | An older device's changes after the move are stranded if its save is cleared before it updates: new code with an empty save never reads the old file, and no button reaches it. Today, signing in again restores them. Fix: a manual "bring in the older cloud file" action in Settings, by the careful merge. | Follows from D76 (2) |
| RT7-3 to RT7-6 | MINOR | D76 (1) reads the old file again when the newer file is gone (state the exception, and label those questions); a stale tab's own cloud sync takes base and `open` from memory (`cloud.js` 198), so read them from the stored save at sync start; two writers from the same `seq` tie; BV-39's control passes at `<base>`, BV-37 lacks an "already exists" run, and BV-31 lacks a base-drop writer. | — |
