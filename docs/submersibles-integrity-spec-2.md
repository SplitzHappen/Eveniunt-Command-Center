# Submersibles: one rule set for stale writes and moved submarines (spec 2)

Status: built (commits `1e483f9`, `2e2835c`); the owner's decisions are at the end. Written 2026-11-20 from
the sources, the two earlier specs and the reviewer's scripts and outputs (`tabs.js`, `sync.js`, `swap.js`,
`tabs-min.js`, `form.js`, `form2.js`; kept outside the repository). Line numbers are as read.

## 1. Goal, constraints, one fact
- **Goal.** Close four reproduced faults (a swap loses a submarine at sync; an orphan submarine; a removed submarine
  comes back; an open Setup form undoes a move) by stating what holds after every Submersibles write and sync, and
  keep it true with a permanent randomized model test instead of one more special case.
- **Constraints.** Offline-first public site on GitHub Pages; nothing automates the game or invents game data; no
  stored field or key added, dropped or reinterpreted; `m|` keys and the conflict shape stay; a sync deletes nothing
  without the player's explicit choice; `save.js` is in the Tracker, the Command Center and the Atelier: all rebuilt.
- **Fact (read, not run).** No screen changes a saved submarine's `slot`; only `save.js:482` (the fold move) changes
  its `fcId` (searched `tracker/src`, `tracker/command-center/src`). So faults 1 and 4 need a save changed outside
  the screens or a later "move" feature (the reviewer wrote sections directly); faults 2 and 3 need only two tabs.

## 2. Invariants
After every successful `CC.writeSection('submersibles', …)`; *stored* = the saved section before it, *base* and *sent*
= the page's base and the section it sends:
- **I1 Company exists.** Every submarine's company is in the section, unless that submarine already pointed at that
  same missing company in *stored*.
- **I2 Nothing comes back.** A company, submarine or logged voyage in *base* and not in *stored* is not in the
  result; as today, except a company bare in *base* that the clean-up would remove again (`CC.foldLoser`).
- **I3 One per slot.** No company-and-slot holds two or more submarines unless all were already in that slot in
  *stored* (today's `slotAdded`).
- **I4 A slot the page rearranged is stored as the page showed it.** For every company-and-slot whose set of
  submarines differs between *base* and *sent*, the merged section holds exactly the *sent* set (tested before I5).
- **I5 Fold move (today's).** A new or changed submarine sent under a company the clean-up removed goes to the
  company that beat it (`CC.foldWinner`), same slot number, if free; otherwise the write is refused.
- **I6 Nothing else changes.** A unit the page did not change is stored as *stored* has it; one it changed, as sent
  (a free company through `CC.mergeUnit`). Already true of `CC.mergeModules`; the model test pins it.
- **All or nothing.** A write that would break I1 to I5 is refused whole: nothing is stored, the page shows the
  saved copy and "Not saved on this device: <reason> …" (`subs.js` 119-134).
- **Not an invariant:** "every logged voyage's submarine exists". Setup's Remove and the Board's "Keep this one" keep
  logged voyages in the history by the owner's decision (2026-11-20); the Log shows "removed sub" (`subs.js:435`).
- **After every sync** (`ET.threeWay`, `ET.applyMerge`): **S1** a submarine both devices hold is never removed by a
  slot answer unless it sits in that same slot on both (the existing duplicate choice, INT-C3); **S2** a record
  missing afterwards is one of the explicit removals of MD4 (section 7); **S3** devices settle.

## 3. Decisions (rejected alternatives in the same item)
- **D1. Refuse, never repair, except I5.** Rejected: removing the orphan with its company (deletes a submarine the
  player never saw); keeping the company silently; storing the write without the offending unit (half an action).
- **D2. Every rule is "no new violation"**: none refuses because of what is already stored. Rejected: strict
  invariants (an older save, an old cached page or a sync result would make the page unwritable; INT-B3).
- **D3. The rules live in `CC.writeSection` only.** Rejected: `CC.mergeModules` (T10 pins it); the page (blind when
  not told). **D4. I2 covers submarines and logged voyages** (fault 3); the fold removes only companies.
- **D5. I4 is new, not in the brief.** Found on paper, not run: two submarines share a slot; tab A confirms "Keep
  this one" for the first, stale tab B for the second; both removals are applied and both are gone. I1 to I3 miss it.
- **D6. The same submarine changed in two tabs: OWNER-1.** The later save wins (decided 2026-11-19) until answered.
- **D7. The slot question leaves out a submarine both devices hold in different places** and names it as staying; a
  duplicate left over goes to the Board's "Keep this one" (OWNER-2 B). Rejected: sending it back to its slot on the
  kept device (two devices answering "this device" can move it back and forth without end; needs a new field and
  new wording); merging the slot inside its record (OWNER-2 C).
- **D8. The Setup form writes a known submarine at its saved-now place** (fault 4): the K1 rule it already follows,
  and the form has no control that moves a submarine. Rejected: refusing the Save (throws the typing away).
- **D9. A refused write's recovery cancels a write scheduled during its re-read.** Rejected: letting it run (it
  stores the saved copy again, clears the "Not saved" line and drops the edit without a word).
- **D10. The Tracker's save and the Settings sync end stay outside these rules** (section 4): refusing them loses ticks.
- **D11. The model test states its invariants itself**; its only shared oracle is `FLEET.foldFcs` (fold exception).

## 4. A: the store rules (`tracker/src/core/save.js`)
New private pure helper beside `slotAdded` (428): `function slotSets(sec)` -> `{ 'fcId|slot': [subId, …] }`, each list
sorted. In `CC.writeSection` (443-497) for `name === 'submersibles'`, with `b` base, `l` the checked section sent,
`r` = `stored`, `m` the merge result (the names of the block at 461). A1 to A5 run in the stale branch only (460-484):
- **A1** (466-469, unchanged) a company in `b`, absent from `r`, present in `m`: refused unless a fold loser.
- **A2** (new, I2) for `kind` of `subs`, `trips`, every id in `b[kind]`, absent from `r[kind]`, present in `m[kind]`:
  throw `This submarine was removed on another device or in another tab.` (`trips`: `This logged voyage was …`).
- **A3** (new, I4) `B`, `L`, `M` = `slotSets` of `b`, `l`, `m`; for every key of `B` or `L`, `t(x) = (x[key] ||
  []).join()`: if `t(B) !== t(L) && t(L) !== t(M)` throw `That submarine slot changed elsewhere.` (existing text).
- **A4** (470-483, unchanged) the fold move.
- **A5** (only if OWNER-1 is "refuse") for every id in `b.subs`, with `bv`, `lv`, `rv` its record in `b`, `l`, `r`
  (`lv` absent = removed here): if `rv` exists and no two of the three are equal as JSON text, throw
  `This submarine changed in another tab or on another device.`
- **A6** (new, I1; every write, directly before line 488) for every submarine of `sec` (id `id`, company `f`) with
  no `sec.fcs[f]`: allowed when `r.subs[id]` has the same `fcId` and `r.fcs[f]` is missing too; else throw, when
  `r.fcs[f]` exists, `This free company has a submarine that was saved in another tab or on another device, so
  nothing was removed.`, otherwise the existing `The free company changed while its submarine was being saved.`
- **A7** (488, unchanged) `slotAdded`.
- **Replays.** Fault 2 (`tabs-min.js` ORPHAN) stops at A6, fault 3 (BACK) at A2, "Keep this one" in two tabs at A3,
  a logged voyage archived in one tab and edited in a stale one at A2. The texts at 474 and 479 are pinned nowhere.
- **Callers read.** `subs.js` `write()` (105-135): its catch takes any message, re-reads, shows the saved copy and
  the "Not saved" line; `said` is used only on success; one gap, section 6. `settings.js` `writeRaw` (30-36) rejects
  into its `failed` line; `setFcNow` (221-234) only renames or adds a company, so only A6 can meet it. `recs.js` and
  the Atelier write other sections. `CC.foldSection` bypasses the rules but removes only companies without submarines.
- **What stays unguarded.** (1) The Tracker's save (`storage.js` 245-287: `ET.saveMerge`, then the whole save through
  `CC.transact`) and the end of a Settings sync (`settings.js` 316-334, same path). Read: a window that did not
  change the section takes the stored units (`merge.js:54`), so a plain Tracker save undoes nothing (MT9). When a
  sync result and a Submersibles tab change one record within the same seconds, this path keeps both sides, as a
  sync applied without asking does: it can store two submarines in one slot or bring back a record the tab removed;
  it never deletes or orphans (`applyMerge`'s safety net); the Board and the next sync's question repair it. (1b) A save from an older build that already holds an orphan submarine can have a plain Tracker save bring back the company another tab removed, through its unanswered question (found by the model test's MT9 from a start with an orphan; pinned by SI-8; with no orphan stored MT9 holds). (2) An
  old cached page writes by the old rules. (3) Preferences or one logged voyage changed in two tabs: the later wins.

## 5. B: the slot question (`tracker/src/core/merge.js`, slot pass 125-158)
Lines 140-142 become, with `on(map, x)` = `map.get(x.key) !== undefined`: `here` = in this slot on this device and
not on the other device at all; `there` = the mirror; `both` = in this slot on both (unchanged); new `moved` = on
both devices, in this slot on one only. `stays` (155) = `(here.length && there.length ? both : []).concat(moved)` as
names. Nothing else changes, and without a `moved` record the result is today's: `ET.applyMerge` and
`ET.describeConflict` are untouched (a non-empty `stays` already selects the text "“X”, already on both devices,
stays either way"). Proof on paper (base: `s1` in slot 1, `s2` in slot 2, a logged voyage each; A is this device):

| Case | Asked | Each answer, and none |
| --- | --- | --- |
| A swaps; B changes `s1` (rank, name) | `s1`'s own entry | "This device" or none: A's layout. "Other": `s1` back in slot 1 beside `s2`; the Board lists both. |
| A swaps; B changes nothing | nothing | B takes the swap. |
| A moves `s1` to empty slot 3; B changes `s1` | `s1`'s own entry | Slot 3, or slot 1 with B's change. |
| A moves `s1` to slot 3; B adds `n` there | nothing | Both in slot 3 on both devices; the Board asks. |
| A removes `s2`, moves `s1` to slot 2; B changes `s2` | `s2`'s own entry | Removed as A chose, or back beside `s1` (Board). Today "other" removes `s1`. |
| Slot 3: `p` new on A, `n` new on B, `s1` moved in | `p` or `n`; `s1` named as staying | The one not kept is on one device only and goes with its voyages (today's rule). |

In every row `s1`, `s2` and their voyages remain unless their own entry's removal is chosen. S1 holds because a slot
answer removes only entries of `locals` or `remotes`, now `here`, `there` (on one device) or `both` (same slot on
both). S3: no answer gains a new effect, the pass only asks less and removes less, and a `moved` record raises no
question on a device without changes; `sync.js` found today's rules settling (40,000 sequences); MD8 re-proves it.

## 6. C: the Setup form and the recovery (`tracker/command-center/src/submersibles/subs.js`)
- **`writeWizard` (831-867).** At 849, after `prev` and `had`: `var at = s.id && had ? prev : null;`; in `rec` (853)
  `fcId: at ? at.fcId : fcId, slot: at ? at.slot : j + 1`. When `at` is not `(fcId, j + 1)`, push onto a new list
  `moved`, shown with `adopted` and `cleared` at 866 (wording: OWNER-3). So a submarine moved elsewhere is written
  at its saved place with the typed fields (`form.js` S1, `form2.js` S6); a new one still goes to slot `j + 1`;
  adoption is unchanged. A slot the player switched off: line 845 returns first, the record stays and shows Locked
  (`fleet.js` 71-77). A saved place that holds another record too: both were already there, so A7 allows it.
- **`write()` recovery (125-130).** After the re-read, before `setSection`: `clearTimeout(SH.timer); SH.timer = null;
  SH.note = ''; SH.unticked = {};`. An edit made during the re-read goes with the rejected ones and the "Not saved …
  re-enter any unsaved edits" line stays. C70's later edit comes after the recovery and is unaffected.
- **The form sequences the reviewer did not reach.** Covered by existing code, check only: a slot switched off while
  a submarine appeared there (kept, Locked); adoption when the slot already holds two (`subsOf` gives the first, A7
  allows a stored duplicate); a new-company form racing another tab (new ids; its company has a submarine and is
  never folded); Save pressed twice (`if (W)` at 828, `W = null` at 863). Need work: Save during a refused-write
  recovery (above); "Keep this one" during another tab's change (A3; a voyage sent elsewhere on it is OWNER-1).

## 7. D: the model test (`tracker/tests/subs-model.test.js`, added to `npm run test:unit`)
- **Harness.** `node:test`, one `test()` per invariant; loads `save`, `model`, `codec`, `merge`, `storage`, `fleet.js`
  as `core.test.js` does; the store reset as `intReset` (`core.test.js:2313`); the reviewer's generator. Seeds 1, 2,
  3, 1,000 sequences each per model, 12 steps (tabs) or 10 then settling (devices); `SUBS_MODEL_N`, `SUBS_MODEL_SEED`
  override; under 20 seconds. A sequence is an array of steps `{ actor, kind, n: [four numbers] }` drawn up front; a
  step picks `sortedIds[n[i] % length]` in the actor's view, is a no-op when its precondition fails, names new
  records after its index. Shrinker: delete single steps while the same invariant fails. A failure prints the
  invariant, seed, sequence number and the remaining steps resolved.
- **Tabs model** (real `CC.writeSection`, `CC.foldSection`, `ET.saveMerge`). Start: one to three companies with
  submarines and a logged voyage; in some sequences two submarines in one slot and an orphan, seeded straight into
  the store as `intSeed` does (older saves hold them). Three tabs `{ rev, base }`, stale until they reload or write;
  the fold; one Tracker window. Steps: reload; fold; a Tracker save that changes nothing in the section; and on a
  copy of the tab's base: add, rename or remove a company (with the submarines the tab sees); change its slots or
  character; tick or untick a sector; add a submarine to a free slot; rename or re-rank one; send; return (adds a
  logged voyage); remove one; keep one of two in a slot; move to a free slot; swap two; edit or remove a logged
  voyage; change a preference. A refused tab takes the saved copy, as the page does.
- **MT0** a refused write leaves the store byte-identical; its text is today's or one of section 4's. **MT1** the
  store passes `CC.checkDoc`, unchanged by a second check. **MT2** (I1) no new orphan. **MT3** (I3) no new duplicate.
- **MT4** (I2) nothing in the writing tab's base and absent from the store before the step is in it afterwards,
  except a company `FLEET.foldFcs` would remove again from the store with it put back.
- **MT5** no company, submarine, logged voyage or sector disappears unless explicit: the company the step removed and
  its submarines the tab saw; what the step itself removed or unticked; a company in a fold's `removed` list.
- **MT6** (I4, intent) after a successful write the step's effect is stored: the submarine or logged voyage as sent;
  each company field the step changed as sent (sectors and slot count may be higher); every slot the step rearranged
  holds exactly what the tab showed; a submarine under a folded company sits alone in that slot of the winner.
- **MT7** (I6) every record the step did not target is unchanged; a targeted submarine another tab changed since the
  base (its voyage included) is allowed while `SAME_SUB = 'later-save-wins'` (OWNER-1), a violation under `'refuse'`.
  **MT8** a fold removes exactly `FLEET.foldFcs(before).removed`. **MT9** a plain Tracker save leaves the section as is.
- **Devices model** (real `ET.threeWay`, `ET.applyMerge`; two or three devices and a cloud copy, as `sync.js`).
  Steps: the same edits on a device's section (moves and swaps included), a fold, and a sync with an answer drawn
  per question (this device, the other, none). `L`, `R`, `B` = device, cloud and base sections, `M` the result.
- **MD1** `M` passes `CC.checkDoc`. **MD2** no orphan that `L` or `R` did not already hold. **MD6** a submarine has
  the company it has on `L` or `R`. **MD7** no sector of `L` or `R` is lost unless it was in `B` (as `sync.js`).
- **MD3** a slot with two or more in `M` was asked about in this sync, or holds them all on `L`, or all on `R`, or
  contains a submarine both devices hold in different places (section 5).
- **MD4** (S1, S2; the reviewer's lesson) a record of `L` or `R` missing from `M` is: (a) in `B`, missing on one
  side, byte-equal to `B` on the other; (b) its own question answered for the side without it, or unanswered with
  this device the side without it; (c) on the side not kept of an answered slot question **and absent from the kept
  side or in that same slot there** (being named in a question is not enough); (d) linked to a free-company question
  answered for the removal; (e) a logged voyage of a submarine removed by (c) or (d). Anything else is a violation.
- **MD5** a record in `B`, missing on one side and present in `M`, had a question in this sync: its own, its
  company's, or for a logged voyage the kept company's fleet (`merge.js` 212-221; `sync.js` flagged that once,
  wrongly). **MD8** (S3) all devices then sync answering "this device": within six rounds nothing is asked, all equal.
- **Expected at the current code** (prediction, not run): MT2 fails (fault 2), MT4 (fault 3 and a logged voyage),
  MT6 (keep-one in two tabs), MD4 (fault 1); the rest passes, as the reviewer's runs did for the parts they share.
- **Named tests** (`tracker/tests/core.test.js`, appended; patterns of INT-A2 and `r3`). **SI-1** fault 1
  (`swap.js`): no slot question, one question (`s1`'s own), every combination of answers and none keeps both
  submarines and both logged voyages; plus rows 4 to 6 of section 5, row 6 matching `already on both devices, stays
  either way`. **SI-2** fault 2 rejects `/has a submarine that was saved in another tab/`, store unchanged. **SI-3**
  fault 3 rejects `/This submarine was removed/`; a logged voyage removed in one tab and edited in a stale one
  rejects `/This logged voyage was removed/`. **SI-4** two in one slot (`intSeed`), A removes the second, stale B
  the first: rejects `/slot changed elsewhere/`, the first still stored. **SI-5** (pin) a stored orphan (seeded)
  stays writable. **SI-6** (pin) `ET.saveMerge`, stale stamp, unchanged section: returns the stored section.
  **SI-7** (OWNER-1 "refuse" only) `tabs-min.js` VOYAGE rejects `/This submarine changed/`.
- **Browser checks** (`tracker/command-center/check.js`, next free ids after C133; no page error in any). **C134**
  fault 4: `form.js` S1 and `form2.js` S6, told and not told: places stay as saved elsewhere, the typed name is
  applied, the status line names the move. **C135** slot 2 switched off in the form while another tab saves a
  submarine into it: stored, count 1, shown Locked. **C136** adoption into a slot holding two (seeded): typed name
  on the first, both stored, notice shown. **C137** a new-company form and another tab adding a company for the same
  character, Save clicked twice: one company from the form, every submarine has its company. **C138** a refused
  write whose re-read is held (wrap `CC.read`, as C69 wraps `CC.foldSection`), a sort click during the hold: the
  "Not saved" line stays, the sort is not stored, a later sort saves. **C139** two tabs on a seeded duplicate, the
  second not told, each confirms "Keep this one" for a different one: the second shows "Not saved … That submarine
  slot changed elsewhere.", one stored. **C140** the three built apps refuse the SI-2 and SI-3 replays (as C127).

## 8. Compatibility and pins
Stored data is unchanged: every new rule only refuses, the sync change only asks less and removes less; no field,
key, version or conflict property is added (`stays` exists since the first integrity spec). Old meets new: an old
tab writes by the old rules; a new tab never refuses because of what it stored (D2) and deletes nothing it finds; an
old device asks the faulty slot question until it updates. The only thing an old rule stored that a new one does not
is the refused page's own unsaved edit, and the page says so. Pins, on paper: C65, C70, C119 to C127, C133, T1 to
T10, INT-*, G1 to G4, R2, R3-*, F-01 pass unchanged: none has a submarine both devices hold in different places or a
stale write that brings a record back or rearranges a slot another page changed, except INT-B1, C70 and C125, which
get the same text. T10 pins `CC.mergeModules`, untouched also under OWNER-1 "refuse". Not verified: `check.js` seeds.

## 9. Work items
Each ends with `npm run build` twice (the second changes nothing) and the rebuilt copies committed; no merge. An
invariant is never weakened to get a green run: a failure outside "Expected" in section 7 is escalated.
- **W1. Model test, seen failing (Sonnet builder).** Files: `tracker/tests/subs-model.test.js` (new), `package.json`
  (`test:unit` runs it after `subs-fixes.test.js`). Steps: section 7's two models, `SAME_SUB = 'later-save-wins'`.
  Accept: `cd tracker && node tests/subs-model.test.js` fails in under 20 seconds on exactly MT2, MT4, MT6 and MD4,
  each with a shrunk trace of at most four steps, pasted in the report. Must not change: any source or existing
  test. Escalate if: another invariant fails, one of the four passes, or `storage.js` will not load.
- **W2. Store rules (Sonnet builder; after W1).** Files: `tracker/src/core/save.js`, `tracker/tests/core.test.js`.
  Steps: SI-2 to SI-6, see SI-2 to SI-4 fail, then A2, A3, A6. Accept: `npm run test:unit` with MD4 the only
  failure. Must not change: `CC.mergeModules`, `CC.mergeUnit`, `CC.foldSection`, A1, A4, A7, any existing test.
  Escalate if: an existing test or seed stores an orphan or rearranges a slot through `CC.writeSection`.
- **W3. Slot question (Sonnet builder; after W1 and the answer to OWNER-2).** Files: `tracker/src/core/merge.js`,
  `tracker/tests/core.test.js`. Steps: SI-1, then section 5. Accept: `npm run test:unit` green with R2, R3-*, F-01,
  INT-C1 to C4 and G4 unmodified. Must not change: `ET.applyMerge`, `ET.describeConflict`, the conflict id, the
  free-company pass (79-119). Escalate if: an existing test needs an edit, or MD8 fails.
- **W4. Form and recovery (Sonnet builder; after W2).** File: `tracker/command-center/src/submersibles/subs.js`.
  Steps: section 6. Accept: `npm run test:unit`, `npm run test:browser` and
  `CHECK_ONLY=C65,C70,C116,C120,C121,C123,C124,C125 npm run check`. Must not change: `saveWizard`, `wizGone`,
  adoption, the texts at 850 and 865. Escalate if: one of those checks changes outcome.
- **W5. Browser checks (Sonnet builder; after W2 to W4).** File: `tracker/command-center/check.js` (and the evidence
  file the run rewrites). Steps: C134 to C140. Accept: `npm run check` green. Escalate if: an id is taken, an older
  check changes outcome, or a new check needs a longer wait than its neighbours.
- **W6. Only if OWNER-1 is "refuse" (Sonnet builder; after W2).** Files: `save.js`, `core.test.js`, the model test.
  Steps: SI-7, A5, `SAME_SUB = 'refuse'`. Accept: `npm run test:unit`, `npm run check`. Escalate if: an existing
  test or check expects the later save to win for a submarine.
- **W7. Record (Haiku clerk; after W5).** File: `docs/STATE.md`: an entry under "Built, waiting for the owner's
  `ship`" (this spec, the model test, C134 to C140) and, under "Known limits", the unguarded points of section 4
  and the fact of section 1. Accept: present, no personal data. Escalate if: the layout changed.

## 10. Risks, and the first thing to verify
- **First: W1's run**: the four expected failures with their traces, and nothing else failing. Two of them (keep-one
  behind MT6, the logged voyage behind MT4) are my reading, not a replay.
- The rules refuse more often; each refusal discards that page's unsaved edit with a message (a "send all" with one
  submarine removed elsewhere is refused whole). A seed or test may store an orphan through `CC.writeSection`.
- Section 5 leaves two submarines in one slot in rare cases, and the Board can settle that only by removing one,
  because no screen moves a submarine. The Tracker's path is pinned for the common case only. The model can be wrong
  where the code is right: the builder stops and escalates; only section 7's exceptions hold.

## 11. Owner questions (not decided here)
### OWNER-1. One submarine is changed in two tabs on one device before either tab has seen the other's change
Example: one tab sends it on a voyage; a second tab that was asleep renames it, or removes it with "Keep this one".
- A. Keep things as they are (your decision of 2026-11-19): the tab that saves last wins without a word; the other
  tab's change (here the voyage) is lost. Costs nothing. Risk left: that silent loss, rarely. Sure: reproduced.
- B. Refuse the second save and say why (recommended): the second tab shows what is saved and a "Not saved" line;
  the player repeats that one action. Improves: nothing about a submarine is lost silently. Cost: about half a day;
  one more reason a save can be refused. Risk left: none to saved data. Sure: fairly; on paper, not built.
- C. Combine the two changes when they touch different parts of the submarine (name; rank, parts and voyage; slot),
  without a question; the last save still wins on the same part. Cost: about a day and its own plan; you chose on
  2026-11-19 not to combine a submarine's record. Risk left: a submarine saved as neither tab showed it. Sure: medium.
### OWNER-2. A sync finds a submarine that both devices have, in a different slot on each
As far as I could read, no screen changes a submarine's slot today: this needs a save changed outside the screens.
- A. Keep things as they are: the sync asks "slot N holds a different submarine on each device", and either answer
  removes one submarine and its logged voyages although both devices have both. Costs nothing. Risk left: that
  loss, in a case today's screens do not produce. Sure: reproduced.
- B. Leave such a submarine out of that question (recommended): it is asked only about submarines that exist on one
  device and names the other as staying. If two then share a slot, the Board's "Keep this one" notice lists them and
  nothing is removed until you confirm there. Cost: about half a day. Risk left: two submarines can share a slot
  until you choose, and the Board can settle it only by removing one. Sure: high on paper; not built.
- C. As B, and when one device moved a submarine while the other changed its name, rank or voyage, keep the move in
  both versions, so fewer duplicates remain. Cost: about a day more, and a new rule inside the submarine's own
  record, which you chose on 2026-11-19 to leave alone. Risk left: as B, less often. Sure: medium.
### OWNER-3. The wording of the new lines
Four follow "Not saved on this device: ", the last is the Setup form's: "This submarine was removed on another
device or in another tab." / "This logged voyage was removed on another device or in another tab." / "This free
company has a submarine that was saved in another tab or on another device, so nothing was removed." / (OWNER-1 B
only) "This submarine changed in another tab or on another device." / "“X” is now in slot N, where another tab or
device put it while this form was open; it stays there, and what you typed here was applied to it."
- A. Keep to the lines that exist today: every new refusal says "That submarine slot changed elsewhere." or "This
  free company was removed …", and the form adds no line. Costs nothing. Risk left: a message that does not fit.
- B. Use the lines above (recommended). Cost: none beyond the work planned. Risk left: none known. Sure.
- C. Your own wording for any of them: send the text and it is used as written.

## Owner decisions (2026-11-20)

- **OWNER-1: option B.** A second save of a submarine that another tab changed since this page's copy is refused
  whole, and the page shows what is saved and a "Not saved" line; the player repeats that one action. W6 is built.
- **OWNER-2: option B.** A submarine both devices hold, in a different slot on each, is left out of the slot question
  and named as staying; a leftover duplicate is settled on the Board with "Keep this one". W3 is built.
- **OWNER-3: option B** (the orchestrator's choice under the owner's standing instruction to fix weak spots; the
  owner may still send other wording). The proposed lines are used.
