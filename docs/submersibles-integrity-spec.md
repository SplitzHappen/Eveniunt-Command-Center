# Submersibles: saving and merging integrity (spec)

Branch `claude/ecstatic-planck-vtd6ml`, HEAD `287b095`. Written from a reading of the code; nothing was run. Closes
three review findings: (A) a free company removed on purpose can come back, (B) two submarines can be written into
one slot, (C) three or more submarines in one slot merge with no question.

## 1. Goal and constraints

- A company-and-slot never gains a second submarine through a write or a merge without the player being told; a
  company removed on purpose is never stored again by a page that still held it; nothing is deleted without the
  player's explicit choice.
- Offline-first, public, GitHub Pages. No game automation, no invented game data.
- No stored field or key is added, dropped or reinterpreted; the `m|` key format is unchanged. New data exists only
  in memory (form state, the conflict object of one sync).
- `save.js` is embedded in the Tracker, the Command Center and the Atelier: all three are rebuilt (`npm run build`).
- C65, C70, C120 and every existing unit test keep passing unchanged. Only C123's expectation changes (intended).

## 2. Decisions

- **D1. "Removed by the automatic fold" is one predicate, `CC.foldLoser`.** A removed company counts as folded away
  only if it was bare and, put back into the stored copy, the fold would remove it again (it has a character, and
  another company of that character is not bare or sorts before it). Anything else is a deliberate removal.
  Rejected: "another company of that character exists" (the starting idea): it also passes a bare company removed
  on purpose that would win the fold against a company created afterwards. Rejected: `F.isBare` at form opening
  (today): cannot tell the two apart.
- **D2. The same predicate is enforced in two places.** The page decides when it has been told (its stamp is
  current, so the store does not merge and cannot see the removal); `CC.writeSection` decides inside its merge when
  the page was not told. Rejected: store only (blind when the stamp is current); a stored marker (adds a key).
- **D3. `saveWizard` keeps its two paths**: bare at opening is synchronous (C70 pins one held write right after the
  click); otherwise reload, then write. Rejected: always reload first (breaks C70).
- **D4. A slot guard in `CC.writeSection` on every Submersibles write**, merged or not: refuse when a company-and-slot
  would hold two or more records and one of them is not already in that slot in the stored copy; message
  `That submarine slot changed elsewhere.` (existing). Rejected: refusing whenever two records share a slot: the
  stored copy can already hold two (a sync applied without asking keeps both on purpose, C71; older builds) and the
  page must stay writable. Rejected: silently dropping one.
- **D5. Fault B at Save, fault C's question and existing duplicates are OWNER O1, O2, O3.** The design below follows
  the recommended option of each; no dialog change is needed for them.
- **D6. Records already on both devices are not asked about by a sync** (as today for two, pinned by R3-03); the
  Board shows them (O3). Rejected: asking on every sync (repeats forever when the player declines).
- **D7. Two devices, a removed company: no change.** Read: removed on one side and changed on the other is asked
  (merge.js 54-67), its submarines in the same choice (89-119); removed and unchanged is taken. R2, R3-02, F-01, T9.

## 3. OWNER questions (not decided here; work items marked "after the owner's answer" follow the recommendation)

**O1. A company's setup form is open with an empty slot; meanwhile another tab or device saves a submarine into
that slot; then Save is pressed.** (W3)
1. Keep things as they are: a second submarine is stored in the slot and the Board shows only one. No work. Risk
   left: a hidden duplicate to sort out later. Sure (read in the code).
2. Use the submarine already saved and apply only what was typed (recommended): one submarine stays; a typed name,
   rank, parts or return time replaces the saved one, everything not typed stays as saved, and a line says so. Risk
   left: a typed value older than the one saved elsewhere still wins (the form already works this way for
   submarines it knew). Fairly sure; not built or tested yet.
3. Do not save that one submarine and say so: the rest of the form is saved, a line names the slot. Nothing saved
   elsewhere is touched. Cost: the typing for that slot is lost and done again.
4. Ask each time in a small window ("use the saved one" or "use what I typed"): most control. Cost: a new window,
   roughly a day more work, one more question in a rare case.

**O2. A sync finds three or more submarines in one slot.** (W2)
1. Keep things as they are: all are kept and nothing is asked. Risk left: hidden extras. Sure.
2. One question per slot: keep this device's submarine(s) or the other device's (recommended). The side not kept is
   removed with its logged voyages, as today for two. If the kept side has more than one, the Board then asks which
   one stays (O3). No new window. Risk left: two steps in the rare case. Fairly sure; not built yet.
3. A new question with one button per submarine, leaving exactly one at once. Cost: the Tracker's sync window must
   change (a button per record, a new kind of answer); more to test in the part that merges devices.

**O3. A save already holds two or more submarines in one slot.** (W3, and one sentence in W2)
1. Keep things as they are: the extras stay saved but hidden in the company view. Risk left: counts and alerts for
   a submarine that cannot be seen. Sure.
2. A notice on the Board lists them with "Keep this one" beside each; after a confirmation the others are removed
   and their logged voyages stay in the history, as Setup's "Remove" does today (recommended). Risk left: a voyage
   under way on a removed one is not logged (the confirmation says so). Fairly sure; not built yet.
3. The same notice, but the removed ones' logged voyages go too (as the sync question does). Cost: they leave the
   Log and Earnings for good.
4. The same notice, but their logged voyages move to the one kept. Risk left: wrong history if the records were
   really different submarines; it rewrites saved voyages.

## 4. Design

### 4.1 `tracker/src/core/save.js`

```js
// true when fc, stored in sec under fcId, would be removed by the automatic duplicate fold (FLEET.foldFcs): fc is
// bare in sec, has a character, and another company of that character in sec is not bare, or is bare and sorts
// before it (lower order || 0, then lower id by plain < comparison, as foldFcs does). Pure.
CC.foldLoser = function (sec, fcId, fc) { ... }   // -> boolean
```

Private `subBare(sec, id, f)`: no submarine of `sec` has `fcId === id`; no world; `unlockedSlots` absent or 1;
`discovered` absent or exactly `[1, 2]`. The inline `isBareBase(id)` becomes `subBare(b, id, (b.fcs || {})[id])`.

In `CC.writeSection`, for `name === 'submersibles'`:
1. In the merge branch, before the loop over `l.subs` (line 423): for every `fcId` in `b.fcs` that is absent from
   `stored.fcs` and present in `m.fcs` (this write would bring it back): unless
   `isBareBase(fcId) && CC.foldLoser(stored, fcId, b.fcs[fcId])`,
   `throw new Error('This free company was removed on another device or in another tab.')`. A fold loser is stored
   again, as today.
2. The loop at 423-436 is unchanged.
3. On every write, before `doc.modules[name] = sec` (line 439): private `slotAdded(sec, stored || {})` is true when
   some `fcId + '|' + slot` holds two or more ids in `sec` and at least one is not an id of that slot in `stored`;
   then `throw new Error('That submarine slot changed elsewhere.')`.

A throw writes nothing (as today). Callers read: `subs.js` `write()` (105-135) catches, shows the stored copy and
"Not saved on this device: … re-enter any unsaved edits"; `settings.js` `writeRaw` rejects into its `failed` line;
`recs.js` and `atelier.js` write other sections. Not checked: every seed in `check.js` (W1 escalates).

### 4.2 Setup form, `tracker/command-center/src/submersibles/subs.js`

- `startWizard` (661): keep `W.bareAtStart`; add `W.last` (a copy of `S.fcs[fcId]`, or null) and `W.bare`
  (= `W.bareAtStart`). In `reload()` (at line 150), while `S.fcs[W.fcId]` exists, refresh both
  (`W.bare = F.isBare(S, W.fcId)`).
- New `function wizGone() { return !!(W && W.fcId && !S.fcs[W.fcId] && !(W.bare && CC.foldLoser(S, W.fcId, W.last))); }`
  replaces the three `!W.bareAtStart && !S.fcs[W.fcId]` tests (`reload()` 150, `wizardHtml` 739, `writeWizard` 812).
  `GONE` text and `saveWizard` (804-809) unchanged.
- Result. Told, deliberate removal (bare or not): `GONE` at once, Save writes nothing. Told, fold: Save stores the
  company again (C65). Not told, not bare: the reload makes it "told". Not told, bare: the store decides (4.1
  step 1, or the existing loop when the company's own record is unchanged, C70) and a refusal shows "Not saved on
  this device".
- Fault B in `writeWizard` (O1 option 2). Before the loop at 823: `var taken = W.fcId ? subsOf(fcId) : {};`. In it:
  `var cur = !s.id && taken[j + 1] ? taken[j + 1] : null, id = s.id || (cur ? cur.id : F.newId('s'));` The existing
  "saved value unless typed here" lines then apply (`had` is true). For an adopted record the saved voyage is
  replaced only when `t.voyage` and `s.voyMode` is `'in'` or `'at'`. Add to `SH.note`, with the existing "removed"
  line: `Slot N already held “<saved name>”, saved in another tab or on another device while this form was open;
  what you typed here was applied to it.`
- Not told for B: a non-bare form reloads first and adopts; a bare-at-opening form is refused by the guard (D4).

### 4.3 Three or more in a slot, `tracker/src/core/merge.js` (O2 option 2)

Slot pass (135-148), for each slot with two or more indexed records, sorted by id:
1. `here` = in this slot in L and not in R; `there` = in R and not in L; `both` = in both.
2. `here` and `there` both empty: skip (D6).
3. `locals = here.length ? here : both`; `remotes = there.length ? there : both`; either empty: skip (one device
   alone holds them all; its Board asks).
4. Push one conflict with today's id (`'i|submersibles-slot|' + encodeURIComponent(slot)`): `local` / `remote` =
   each side's labels joined with `', '`; `integrity` keeps every field it has today, filled from `locals[0]` and
   `remotes[0]`, plus `locals` and `remotes` (`[{ key, value, name, rank }]`, values from L and from R) and `stays`
   (names of `both` when `here` and `there` are both non-empty, else `[]`).

One record on each side gives today's object plus the three new fields. Newly asked, on purpose: three or more
records; and one record on both devices with a second only on the other device (today only the mirror case asks).

`ET.applyMerge` (168-176): `keep` = the chosen side's list, `drop` = the other (fall back to the single-key fields
when the lists are absent); set every `keep` value, `dropSub` every `drop` id; no choice deletes nothing.
`ET.describeConflict` (255-261): one on each side and no `stays`: today's text, character for character. Otherwise
what = `Submersibles: slot N of “FC” holds K submarines across your devices, and a slot holds one; the side you keep
stays, the other side and its logged voyages are removed`, plus `; “x”, already on both devices, stays either way`
when `stays`, plus `; if more than one stays, the Submersibles Board asks which one to keep`; local / remote =
`keep this device’s “a”, rank 5 and “b”, rank 9` / `keep the other device’s …`.
`conflictDialog` is in `tracker/src/app/ui.js` 1125-1140 (not `tracker/src/ui.js`) and renders texts only: no
change. O2 option 3 would instead need `integrity.options`, a button per option there, a record key as the answer
in `applyMerge`, and the two "is right for all" buttons skipping such rows: a separate item with its own check.

### 4.4 Board notice (O3 option 2)

- `fleet.js`, pure: `F.slotClashes = function (sec)` -> `[{ fcId, slot, ids }]` for every existing company and slot
  with two or more records; `ids` in `Object.keys(sec.subs)` order (the first is the one `subsOf` shows); sorted by
  company order, then slot.
- `subs.js` `boardHtml` (379): after `strip(now) + hid`, in both sort modes and also for companies hidden from the
  Board, one `<div class="note bad" data-slot-clash="fcId|slot">` per clash: `Slot N of “FC” has K submarines saved,
  and a slot holds one. Choose the one that is right; the others are removed only when you confirm.` then a line per
  record (name, rank, status, return time) with `<button data-act="keepsub" data-sub="id">Keep this one</button>`.
  Existing classes only.
- Click switch (1685), `case 'keepsub'`: find the clash holding the id; `confirm('Keep “X” in slot N of “FC” and
  remove “Y”, “Z”? Their logged voyages stay in the history.')`, with ` A voyage under way on a removed one is not
  logged.` appended when one has a voyage; on yes delete the other records from `S.subs` (trips untouched), set a
  status line, `schedule()`. Never without the click and the confirmation.

### 4.5 Compatibility

Stored shape and keys unchanged. An older cached page can still store a duplicate or bring a company back; the new
copy deletes nothing it finds: the guard refuses only the writing page's own new record, and the Board offers the
choice. The conflict object stays in the page that built it, as far as read (`cloud.js` 201-221, `ui.js` 1191-1206).

## 5. Tests (each new one must fail on `287b095` unless marked "pin")

Unit, `tracker/tests/core.test.js`:
- INT-A1 `CC.foldLoser` equals `FLEET.foldFcs(sec with fc added).removed.includes(id)` for a fixed table and 500
  seeded random sections; false with no character and with no sibling.
- INT-A2 stale stamp; a company with a submarine removed in the stored copy, renamed locally: rejects
  `/removed on another device/`; the stored copy still has neither. INT-A3 the same for a bare company with no
  character. INT-A4 a bare company removed on purpose, then a later bare company of its character that it would
  beat: rejects.
- INT-A5 (pin) the fold: bare `fz` loses to `fa`; local renamed `fz` and added a submarine: resolves, `fz` stored.
- INT-B1 stale stamp, stored `s1` in (fa, 1), local adds `s2` in (fa, 1): rejects `/slot changed elsewhere/`, only
  `s1` stored. INT-B2 the same with a current stamp.
- INT-B3 (pin) stored copy already holds `s1`, `s2` in one slot (seeded with `CC.transact`): a preference change
  resolves and keeps both; a write that deletes `s2` resolves.
- INT-C1 three records (`a` here; `b`, `c` there; a logged voyage each): one slot conflict; no choice keeps three
  and every voyage; `local` leaves `a`; `remote` leaves `b`, `c` and drops `a` with its voyage; all three named.
- INT-C2 four records (`a`, `b` here; `c`, `d` there): one conflict; both answers; no choice keeps four.
- INT-C3 `a` on both devices, `b` added on the other: one conflict; each answer leaves one.
- INT-C4 (pin) three records on both devices: no conflict; two new records on this device only: no conflict.

`tracker/tests/submarines.test.js`: INT-D1 `slotClashes`: none; two and three in a slot; a submarine without its
company is not listed; order.

Browser, `tracker/command-center/check.js`:
- C123 (changed) a bare company removed on purpose. Told: `GONE` before Save, no Save button, nothing stored. Not
  told (no BroadcastChannel, as C120): Save, then "Not saved on this device" naming the removal, nothing stored.
- C124 fault B: form on a company whose slot 2 is unlocked and empty; another tab saves a submarine (rank 40, a
  voyage) into slot 2; a name is typed for slot 2; Save. Told and not told: one record in slot 2 with the saved id,
  the typed name, rank 40 and the voyage; the status line names the slot.
- C125 fault B, not told, bare at opening: another tab saves into slot 1; Save: status `/slot changed elsewhere/`,
  only the other tab's record stored.
- C126 existing duplicate (seeded with `CC.transact`, a logged voyage on the extra one): the Board lists both;
  nothing changes on load or when the confirmation is declined; accepting leaves the chosen one, the logged voyage
  still stored, the notice gone, no page error.
- C127 the Tracker, the Command Center and the Atelier each carry `CC.foldLoser` and refuse the INT-B1 replay.
- C65, C70, C71, C72, C119, C120 unchanged and green.

## 6. Work items

Each ends with `npm run build` (twice; the second run changes nothing) and the rebuilt copies committed. No merge.

- **W1. Store rules (Sonnet builder).** Files: `tracker/src/core/save.js`, `tracker/tests/core.test.js`. Steps:
  write INT-A1 to A5 and INT-B1 to B3, see the non-pin ones fail, implement 4.1. Accept: `npm run test:unit`. Must
  not change: stored shape, `CC.mergeModules`, `CC.mergeUnit`, `CC.foldSection`, the loop at 423-436, any existing
  test. Escalate if: an existing test or seed writes two records into one slot or brings a company back through
  `CC.writeSection`, or INT-A1 disagrees with `foldFcs` anywhere.
- **W2. Slot question for sets (Sonnet builder; after the owner's answer to O2).** Files:
  `tracker/src/core/merge.js`, `tracker/tests/core.test.js`. Steps: INT-C1 to C4 first, then 4.3. Accept:
  `npm run test:unit` with R2, R3-01 to R3-03, the R3 review test, F-01 and T1 to T10 unmodified. Must not change:
  the conflict id, the 1-against-1 texts, the free-company pass (79-119). Escalate if: an existing test needs an
  edit or compares the whole `integrity` object.
- **W3. Form and Board (Sonnet builder; after W1 and the owner's answers to O1 and O3).** Files:
  `tracker/command-center/src/submersibles/fleet.js`, `.../subs.js`, `tracker/tests/submarines.test.js`. Steps:
  INT-D1, then 4.2 and 4.4. Accept: `npm run test:unit`, `npm run test:browser`. Must not change: `saveWizard`, the
  `GONE` text, `subsOf`, `F.fleet`, `F.foldFcs`, `F.isBare`. Escalate if: C65 or C70 would need a change, or the
  notice needs a stylesheet change. (The form part of fault A, the `wizGone` bullets, needs no owner answer.)
- **W4. Browser checks (Sonnet builder; after W1 to W3).** File: `tracker/command-center/check.js` (and the evidence
  file the run rewrites). Steps: change C123; add C124 to C127 after it. Accept: `npm run check`, all green. Escalate
  if: an older check changes outcome, or a new check passes only with a longer wait than its neighbours use.
- **W5. Record (Haiku clerk; after W4).** File: `docs/STATE.md`: one entry under "Built, waiting for the owner's
  `ship`" naming this spec and C123 to C127. Accept: the entry is there, no personal data. Escalate if: that
  section's layout has changed.

## 7. Risks, and the first thing to verify

- **First: W1's new tests fail on `287b095` for the stated reason, and `npm run test:unit` stays green after 4.1.**
- Left open by design: a bare company removed on purpose still comes back if its form was open elsewhere, a company
  of the same character that beats it in the fold was added afterwards, and Save is pressed on that form. The stored
  copy then looks exactly like C65's fold; telling them apart needs a stored marker, which is ruled out here.
- Left as today: when the removed company's own record is unchanged, the existing loop moves a new submarine to
  another company of the same character (any, not only a fold winner).
- A refused write discards that page's unsaved edits (existing behaviour and message); the new rules refuse more
  often, each time where storing would have been wrong.
- Not examined: a stale Tracker window's own save (`storage.js` 98-114 merges with no choices and keeps its own
  value); it does not pass through `CC.writeSection`.
- The Board notice also shows in the short state after a sync applied without asking (C71) and before the Tracker
  asks; choosing there first is a valid explicit choice. W4 confirms C71 and C72 still pass.

## Owner decisions (2026-11-20)

- **O1: option 2.** At Save, a form slot with no record whose company and slot now hold a saved submarine uses the
  saved submarine: what the player typed for that slot replaces its values, everything not typed stays as saved, and
  a status line says so.
- **O2: option 2.** A sync that finds three or more submarines in one slot asks one question for that slot: keep
  this device's submarine(s) or the other device's. If the kept side still has more than one, the Board asks which
  one stays (O3).
- **O3: option 2.** A save that holds two or more submarines in one slot shows a notice on the Board with "Keep this
  one" beside each; after a confirmation the others are removed and their logged voyages stay in the history.
