# Submersibles: merging a free company changed in two places (spec)

Status: plan only, nothing built. Written from a reading of the sources named below; no test or build was run and the
HEAD (`f214f53` in the brief) was not checked (no shell in the planning session). Line numbers are as read on 2026-11-19.

## 1. Goal and constraints

A free company (`submersibles.fcs.<fcId>` = `{ name, world, charId, order, unlockedSlots, discovered }`) is one merge
unit. When both sides changed it, today one side's discoveries are lost: silently between two tabs
(`CC.mergeModules`, `save.js:203`, called by `CC.writeSection`, `save.js:354`), and after a question that does not mention
discoveries between two devices (`ET.threeWay`, `merge.js:35`). Goal: both merge sites apply one field-by-field rule, so
discoveries from both sides are kept, and a question that remains says what differs.

Constraints: offline-first public site on GitHub Pages; nothing automates the game or invents game data; saves stay
compatible (no new field, key or version; the `m|` key format and the unit depth stay); a cross-device merge deletes
nothing without the player's choice; `save.js` is embedded in the Tracker, the Command Center and the Atelier, so all
built copies are rebuilt and committed.

## 2. Decisions

D1. **`discovered` merges as a set, three-way** (OWNER-1 decides between this and plain union; the build differs by one
    line). Added on either side: kept. In the base and missing on a side: removed (that side unticked it). No base, or
    any of the three copies without the list: plain union, nothing removed. Output sorted ascending.
    Rejected: whole-unit as today (the reported loss); a stored per-sector tombstone or timestamp (a new field that
    `checkSubmersibles`, `save.js:112`, strips in every old copy).
D2. **Other fields merge three-way per field first** (changed on one side only: that value). Changed differently on both:
    `unlockedSlots` the higher, `order` the lower, both without a question; `name`, `world`, `charId` stay a clash (one
    question per free company; between two tabs this tab's value, as today). With no base, a value beats an empty one.
    Rejected: asking for slots (a count deletes nothing: a slot switched off keeps its submarine, `subs.js:761`);
    "this device wins" for `order` (the bare-duplicate fold breaks ties by `order`, `fleet.js:120`, so two devices must
    compute the same number). Whether slots only grow in the game was not verified from repository data and the rule does
    not rely on it: the return sheet only raises the count (`subs.js:1037`), Setup can lower it (`subs.js:756`).
D3. **One function, `CC.mergeUnit`, in `save.js`**, called by `CC.mergeModules` and by `ET.threeWay` (which already
    reaches into `CC` for `flatModules`). Rejected: a copy in `merge.js` (drift); doing it in `unflatModules` (too late:
    base and the other side are gone); changing `CC.UNIT_DEPTH` or the keys (old copies would read units as removed).
D4. **A clash keeps the existing conflict shape** `{ id, local, remote }`: both texts already carry the merged
    `discovered`, slots and order and differ only in the asked fields. `ET.applyMerge` needs no change. Rejected: a new
    conflict kind or extra property (every consumer of the list would need to learn it).
D5. **No stored format change.** Proof in section 6.
D6. **Submarines, logged voyages, preferences: no change** (section 7).

## 3. The function

```js
// save.js, beside CC.mergeModules. key: 'm|' + JSON path; b, l, r: the unit as JSON text, or undefined.
CC.mergeUnit = function (key, b, l, r) { ... }   // -> null | { local: string, remote: string, asks: string[] }
```

Returns `null` (caller keeps its generic rule) unless the path is exactly `["submersibles","fcs",<id>]` and `l` and `r`
both parse to plain objects. `b` absent or unparseable means "no base". `asks.length === 0` exactly when
`local === remote`. Pure, no I/O, symmetric: `mergeUnit(k, b, r, l)` is `{ local: u.remote, remote: u.local }`.

Steps (`blank(v)`: `undefined`, `null` or `''`; `same(x, y)`: both blank, or equal JSON text):

1. For `name`, `world`, `charId`, `order`, `unlockedSlots`, with `lv`, `rv`, `bv` the three values:
   a. `same(lv, rv)`: that value (both blank: `null` if either is `null`, else left out).
   b. else, with a base, `same(lv, bv)`: `rv`; `same(rv, bv)`: `lv`.
   c. else `order`: `Math.min(lv ?? 0, rv ?? 0)`; `unlockedSlots`: `Math.max(lv ?? 1, rv ?? 1)`.
   d. else (`name`, `world`, `charId`) with no base and exactly one side blank: the other side's value.
   e. else: the local result gets `lv`, the remote result gets `rv`, and the field name is pushed on `asks`.
2. `discovered`: if neither side holds an array, leave it out. Otherwise `L`, `R` = the sides as sets (a non-array
   side is empty); `Bs` = the base's list as a set only when base, local and remote all hold an array, else none.
   Keep `x` when `x` is in `L` or `R` and not (`Bs` has `x` and `x` is missing from `L` or from `R`). Sort ascending.
   (Under OWNER-1 "combine everything", `Bs` is always none: that is the one-line difference.)
3. Both results go through `CC.checkSubmersibles({ fcs: { x: obj } }).fcs.x` and `JSON.stringify`, so the text has the
   checker's field order and only valid values (the same form `unflatModules` produces).

Call sites (the only two; callers checked below):

- `CC.mergeModules` (`save.js:208`): after `v` is computed, `if (l !== undefined && r !== undefined && l !== r &&
  l !== b && r !== b) { const u = CC.mergeUnit(k, b, l, r); if (u) v = u.local; }`.
- `ET.threeWay` main loop (`merge.js`, directly before `conflicts.push` at line 56): for a key starting `m|` with `l`
  and `r` both defined and `CC.mergeUnit` present: `u = CC.mergeUnit(k, b, l, r)`; if `u`: `merged.set(k, u.local)`;
  if `u.local !== u.remote` push `{ id: k, local: u.local, remote: u.remote }`; `continue`.

`mergeUnit` is therefore reached only when both sides are present, differ, and neither equals the base. A unit removed
on one side, or changed on one side only, takes today's path unchanged.

`CC.describeUnit(id, local, remote, nameOf, integrity)` (signature unchanged, `save.js:215`): new branch for
`submersibles › fcs` when `local` and `remote` are both non-null and there is no `integrity`. It compares the two texts
itself, field by field, and lists what differs (labels: name, world, character, unlocked slots, position in the list,
discovered sectors). Proposed wording (OWNER-2):
- what: `Submersibles: free company “Alpha”: the name and world differ between your devices; its discovered sectors
  are already combined and stay the same whichever you choose` (the last clause only when `discovered` is equal in both).
- local: `this device: name “Alpha”, world Maduin`; remote: `the other device: name “Beta”, world Ravana`
  (character shown through `nameOf`; an empty value as `(none)`). If nothing listed differs, today's wording.

## 4. Callers and neighbours checked (read, not run)

- `CC.mergeModules`: one caller, `CC.writeSection` (`save.js:354`), one section at a time. Used for `submersibles` by
  `subs.js:108` and `settings.js:32`; the Atelier (`atelier.js:133`) passes only its own section, so an Atelier copy of
  `save.js` never merges free companies, it only re-checks them.
- `ET.threeWay`: `cloud.js:201` (sync; fewer conflicts, so fewer questions), `cloud.js:221` (after upload, no choices:
  today a discovery made during the upload wins whole and the next sync uploads a record without the other device's
  discoveries; fixed by the rule), `storage.js:111` (two Tracker windows), `storage.js:165` (no modules involved),
  `ui.js:1247`, `settings.js:321` and `settings.js:325` (`threeWay(p, p, p)` as a flattener: `l === r`, never reaches
  `mergeUnit`).
- `flatModules` / `unflatModules`: `merge.js:29`, `merge.js:238`, `mergeModules`. Untouched.
- Conflict list consumers: `ET.applyMerge` generic branch (`merge.js:168`) sets the chosen text; `ui.js:1204` shows
  `describeConflict`; the safety net (`merge.js:204`) reads `c.local`. All work on the merged texts as they are.
- Integrity pass (`merge.js:59-138`): a free-company conflict gets `integrity` only when a side is `null`
  (`merge.js:96`), which `mergeUnit` never produces; `fleetOf` and the slot check read `L`, `R` and submarine units,
  none of which change. Existence of a free company is never changed by `mergeUnit`.
- Cloud base in Settings (`settings.js:324-331`): for a conflict the base keeps the unit as at the start, so the next
  sync asks again. With an asked field the next merge recomputes the same `discovered` (the set rule gives the same
  result when applied again to its own output) and raises the same question. Without a conflict nothing special happens.
- Bare-duplicate fold (`CC.foldSection`, `F.foldFcs`, `isBareBase` at `save.js:364`): `[1, 2]` sorted is `[1, 2]`. A
  merged company is bare only when a side made it so itself (cleared the world, set one slot, unticked down to the two
  start sectors), which a one-sided change already does today; two sides that each added something never merge into a
  bare company. The repair block in `writeSection` tests existence and the base only: unaffected.

## 5. Files to change

`tracker/src/core/save.js` (`CC.mergeUnit`, the `mergeModules` line, the `describeUnit` branch),
`tracker/src/core/merge.js` (the call in `threeWay`), `tracker/tests/core.test.js`, `tracker/tests/submarines.test.js`,
`tracker/command-center/check.js`, every built copy `npm run build` rewrites (Tracker, Command Center, Atelier),
`docs/STATE.md` after ship. No change to `subs.js`, `settings.js`, `fleet.js`, `cloud.js`, `storage.js`, `ui.js`.

## 6. Compatibility: old and new copies meeting

Stored data is unchanged: the same six fields with the same types, which `checkSubmersibles` (`save.js:112-113`) in
every old copy already keeps; no new field or key exists for an old copy to strip. Old data reads as before.

Old rule on a company changed on both sides: two tabs keep this tab's whole record; two devices ask and keep the chosen
whole record. Against that, the new result holds: the same `name`, `world`, `charId` (this tab's, or the chosen one),
plus the other side's value where only that side changed the field; slots at least as high as either; `discovered`
containing everything either side holds except a sector one side unticked since the base (under "combine everything":
everything, no exception); `order` the lower of the two (list position only). So the only things the old rule could
have kept and the new one does not are an explicitly unticked sector and a list position.

- New copy merges, old copy receives: for the old copy the result is a one-sided change and is taken whole.
- Old copy merges, new copy receives: the result is exactly today's (question, whole record); the new copy takes it as
  a one-sided change. Same loss as today, not more.
- Old tab saves last on one device: today's result. New tab saves last: merged.
- One case is worse under the three-way rule: an old copy's answer is a whole record, so the sectors it lacks look
  unticked. If the updated device changed that company again before syncing, today asks again; the new rule removes
  those sectors without asking. Under "combine everything" they are kept. This is part of OWNER-1.

## 7. Anything else in the section

- `subs` units: no change. A loss scenario exists (renamed in Setup on one side, sent or returned on the other), but
  rank, experience and voyage are coupled and a field-by-field merge could produce a submarine neither device had; the
  slot integrity pass also reads these units. A grouped rule would be its own job (OWNER-3).
- `trips` units: no change. Created once under a unique id; `items` are corrected quantities, not a growing set.
- `settings › prefs` (one unit): no change. Two tabs changing different preferences lose one toggle, not player data.

## 8. Work items

**W0, Haiku clerk: inventory (read-only).** Files: `tracker/tests/*.test.js`, `tracker/command-center/check.js`.
Report: (1) any existing assertion that expects a free company present and different on both sides to be a conflict, or
that matches `the version on this device` for a free company; (2) the next free check id after `C116`; (3) the existing
check that drives the return sheet (`data-new-sector`) and its seed helper; (4) a built page where both `ET.threeWay` and
`CC` exist. Acceptance: four answers with file and line. Escalate if (1) finds any.

**W1, Sonnet builder: `CC.mergeUnit` and the two-tab site.** Files: `save.js`, `core.test.js`, built copies.
Steps: section 3 function and the `mergeModules` line. Tests (new, appended):
- T1 `mergeUnit` table: not a free-company key, or a side missing: `null`; base `[1,2]`, sides `[1,2,3]` and `[1,2,4]`:
  `[1,2,3,4]`, no asks; base `[1,2,3]`, sides `[1,2]` and `[1,2,3,4]`: `[1,2,4]`; no base, or base without the list:
  union; slots 2 and 3: 3; order: the lower; name changed on one side and world on the other: both applied, no asks;
  name changed differently: `asks` is `['name']`, each text keeps its own name and both carry the same merged list; no
  base and a world on one side only: kept, no asks; output equals the checker's text; symmetry; applying it again to its
  own output changes nothing.
- T2 two tabs through `CC.writeSection` with a stale stamp and base (pattern of `core.test.js:1273-1282`): one adds
  sector 3, the other sector 4 and a slot: stored `[1,2,3,4]`, slots raised, `merged === true`.
- T3 old copy: with `CC.mergeUnit` stubbed to return `null` (restored in `finally`), the same replay stores this tab's
  whole record: the old result, byte for byte.
Acceptance: `npm run build` then commit and run it again (exits 0, clean tree); `npm run test:unit` green with every
existing assertion unchanged. Escalate if an existing test must change, or if the checker's output order differs from
the unit text a page writes.

**W2, Sonnet builder: the cross-device site and the wording.** Files: `merge.js`, `save.js` (`describeUnit`),
`core.test.js`, built copies. Needs W1. Tests (pattern of `core.test.js:1245-1271`, `fakeGraph`):
- T4 two devices each add one discovery: every sync `done === true`, no conflicts, both hold both, modules equal.
- T5 one device unticks sector 3, the other adds 4: no question; both end `[1,2,4]` (`[1,2,3,4]` under "combine
  everything").
- T6 name changed differently, each device also adds a discovery: one conflict, its `local` and `remote` hold the same
  merged list; `describeConflict` matches `name differs` and `already combined`; finishing with either choice keeps the
  merged list and the chosen name; later syncs converge.
- T7 old meets new (old device = `mergeUnit` stubbed to `null` during its syncs): new merges first, old takes it whole;
  old merges first, the outcome equals a run with both devices old; the uploaded unit has only the six known fields.
- T8 end of a Settings sync (`threeWay(from, now, mine)`, pattern of `core.test.js:1915`): a discovery made during the
  sync and one from the cloud are both kept, no conflict.
- T9 a free company changed on one side and removed on the other still gives the `owner` integrity conflict with the
  untouched texts.
Acceptance: as W1. Escalate if any R2, R3 or F-01 test changes result, or the dialog cannot show the longer wording.

**W3, Sonnet builder: pins and the browser check.** Files: `submarines.test.js`, `check.js`, built copies. Needs W2.
- T10 (`submarines.test.js`): a merged company whose list is still `[1,2]` is still folded by `foldFcs`, one that
  gained a sector is not; a submarine, a logged voyage and `prefs` changed on both sides behave exactly as before.
- Browser check (next free id, expected `C117`): (a) real pages: tab 2 notes the stamp and base it has; tab 1 records a
  new sector on the return sheet; tab 2 then saves another sector and a slot with its stale stamp and base: the stored
  list holds both, tab 1 shows the new count without a reload, no page errors; (b) the same with `CC.mergeUnit` stubbed
  to `null` in tab 2: tab 2's record is stored whole (the old result) and nothing else changes; (c) on built pages:
  `typeof CC.mergeUnit === 'function'` in the Tracker, the Command Center and the Atelier, and an in-page
  `ET.threeWay` replay of T4 and T6 gives the same results as the unit tests.
Acceptance: `npm run build` (clean), `npm run test:unit`, `npm run test:browser`, `npm run check` all green.
Escalate if the return sheet cannot be driven with existing helpers, or (c) shows a built copy without the function.

**W4, Haiku clerk: record.** After the owner's `ship`: what shipped and the next step in `docs/STATE.md`.

## 9. What must not change

Every existing assertion in `core.test.js` and `submarines.test.js`; the `m|` key format and `CC.UNIT_DEPTH`; the six
free-company fields and what `checkSubmersibles` keeps; the conflict shape; `ET.applyMerge`; the integrity pass; the
fold; behaviour for every unit other than a free company present on both sides.

## 10. Risks, and the first thing to verify

- First: W0 item (1), then the existing unit suite after W1 with no test edited. I read `core.test.js:1228-1284` and
  `1776-2061` and found no assertion that a free company present on both sides must clash; the rest was only searched.
- The three-way rule trusts "in the base, missing on one side" as an untick. A form that saves a stale list would turn
  that into a false untick; the Setup form is being fixed separately (check `C116`). Land that fix first or together.
- The old-copy case in section 6. It ends once every device has loaded the new version.
- Not verified: how the Atelier build embeds `save.js` (taken from `CLAUDE.md`); that the guided setup saves through
  `saveWizard`; the unit text order produced by `ET.portable` (step 3 makes the result independent of it).

## 11. Owner questions

**OWNER-1. One device unticks a discovered sector; the other device changed the same free company before they synced.
What should the sync do?**
- A. Keep things as they are. The whole company is one item: between devices you are asked which version is right and
  the other device's discoveries are lost whichever you pick; between two tabs one tab silently replaces the other.
  Costs nothing; the reported loss stays. Sure: this is what the code does today (read, not run).
- B. Combine everything, never remove. Every sector ticked on either side is kept. An untick comes back if the other
  device changed that company before syncing (it carries over, as today, if the other device did not touch it).
  Improves: no discovery is ever lost in a sync, including during the changeover from the old version. Cost: a
  correction may have to be made twice, for example a whole sea ticked by mistake. Risk left: a sector shown as found
  that is not, so a suggested route may not be possible until you untick it again. Sure: high.
- C. Honour the untick (recommended). Additions from both sides are kept; a sector one side unticked since the last sync
  is removed on both; with no earlier common copy, everything is combined. Improves: discoveries are kept and
  corrections stick, the same way the Setup form already behaves on one device and the same way a sync behaves today
  when only one device changed the company. Cost: the removal reaches the other device without a question there. Risk
  left: while a device still runs the old version, the sectors missing from its answer count as unticked; today they
  are lost anyway except when the updated device changed that company again first (today asks again; this would remove
  them). A removed sector can be ticked again in Setup. Sure: medium to high; worked through on paper, not run.
- D. Honour the untick, but ask first on the device that still has the sector. The strictest reading of "never deletes
  without the player's choice". Cost: a new question to design, about twice the work, and two tabs cannot ask, so
  there everything would be combined. Risk left: more prompts. Sure: medium; not designed in detail here.

**OWNER-2. After this change, which differences on one free company should still be asked?**
- A. Keep things as they are: any two-sided change asks "which version is right?" with no detail (the discoveries
  would still be combined inside both versions if OWNER-1 is B, C or D). Cost: questions that need no answer.
- B. Ask only when the name, the world or the linked character was changed differently on both devices, in one
  question that names what differs and says the sectors are already combined (wording in section 3). Slots: the higher
  number is kept; position in the list: the lower (recommended). Cost: a slot count lowered on purpose on one device
  and raised on the other ends at the higher one and is corrected in Setup. Risk left: none to data. Sure: high.
- C. As B, but also ask about the slot count. Cost: one more question for a number that deletes nothing.

**OWNER-3. Should a later job give a submarine's own record the same treatment (a rename on one device, a send on the
other)?** Keep things as they are (recommended for now: still asked between devices, this tab wins between tabs), or
plan it as a separate job. Not needed to ship this one.

## 12. Owner decisions (2026-11-19)

- **OWNER-1: B, combine everything, never remove.** Where both sides changed the same free company, `discovered` is
  the union of both sides; the base is not used to remove anything (`Bs` is always none, section 3). An untick made on
  one side while the other side did not touch that company carries over as today (a one-sided change is taken whole).
  Tests T1 and T5 use the "combine everything" results: base `[1,2,3]`, sides `[1,2]` and `[1,2,3,4]` give
  `[1,2,3,4]`.
- **OWNER-2: B.** A question is asked only when the name, the world or the linked character was changed differently on
  both devices, and it names what differs and says the sectors are already combined. Slots: the higher number, no
  question. Position in the list: the lower, no question.
- **OWNER-3: keep things as they are.** A submarine's own record is not changed by this job.
