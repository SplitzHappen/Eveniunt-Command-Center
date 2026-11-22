# Independent code review — Lists module change (PR #4, head `ad41b59`)

Reviewer: Mistral (outside the model family that wrote the change). Assignment ASG-20261122-lists-code-review-mistral-001.
Candidate: `git diff 31cb0ba..ad41b59` (80 files, ~11,700 added lines). Base is the published `main` at `31cb0ba`.

**Verdict: publish after fixes.** No blocker was found: no path deletes a list, a wanted item or a stock count without the player's
answer, the save stays compatible with older builds, and the Submersibles price behaviour is unchanged. One MAJOR finding (a
player-facing view the spec promises is missing) should be fixed before publishing; it is small.

---

## Findings

### 1. MAJOR — wanted items without their list are invisible: the promised "Restored list" view is not implemented

- **File:** `tracker/command-center/src/lists/lists.js:738` (`renderHome`), with `tracker/command-center/src/lists/store.js:288` (`stateOf`)
- **Problem:** The spec (`docs/lists-spec.md:217`) and the known-limits record (`docs/STATE.md:217`) say a wanted item left without
  its list — possible only through a sync with a device still on the old build, or a hand-edited save — "never dropped" and "shows
  under 'Restored list', where the player renames or removes it". The save side is done (the checker keeps such an entry, new ones
  are refused, syncs never delete it), but the page has no such view: `renderHome` iterates only `sc.lists`, `targetsOf` only returns
  targets under an existing list header, and `stateOf` skips targets whose header is missing. A search for "Restored" in
  `tracker/command-center/src/` finds nothing. The unit test that covers this (`core.test.js` LY-8, line 3321) asserts only that
  the *save* keeps the entry, not that the page shows it.
- **Consequence for a player:** after a sync with a still-old device (the documented known limit) and then updating, an entry can
  sit in the save with no list. The player cannot see it, rename it, move it or remove it from the page; the list looks empty and
  they may add the item again, ending with a duplicate hidden entry. Nothing is deleted — the data stays in the save and comes
  back if the list header returns — so this is hidden data, not lost data.
- **Proposed fix:** render targets whose list header is missing as a "Restored list" card on "Your lists" (name it, allow remove,
  and allow moving the entry to an existing list or re-creating the list), as the spec describes; add a browser check pinning it.
- **Evidence:** `grep -rn "Restored" tracker/command-center/src/` → no hits; `lists.js:738` `renderHome` iterates `Object.keys(lists)`
  only; `lists.js:315` `targetsOf(sc, listId)` filters by `listId + '.'` prefix; `store.js:288` `stateOf` includes a target only `if
  (l && ownerOf(l) === owner)`; `docs/lists-spec.md:217` and `docs/STATE.md:217` promise the display; `core.test.js:3321` (LY-8)
  asserts save-level keeping only.

### 2. NOTE — collectable stock is shared between an item's collectable lines in recipe order, not list order as the spec text says

- **File:** `tracker/command-center/src/lists/engine.js` (`L.plan`, the `lns.sort` by `PART_RANK` then recipe), admitted in the file's own header comment
- **Problem:** spec section 5 says collectable stock is "shared between coll lines in list order"; the engine gives it in recipe
  order instead (chosen so reordering lists never moves any figure).
- **Consequence:** only the *shares* between two collectable lines of one item can differ from the spec's wording; the line totals
  — the figures the "never rises" rules protect — are identical either way, and shares are display-only. No player-visible wrong
  total.
- **Proposed fix:** none required; if the spec text is wanted exactly, give it in list order (this can move a share when lists are
  reordered, which is why the builder chose recipe order).
- **Evidence:** engine.js header comment lists the choice; spec `docs/lists-spec.md` section 5 "coll lines: … in list order";
  model test part A asserts the totals rules and passes.

---

## What I checked and found sound

**Save and sync safety (the two owner rules).** I read `save.js` and `merge.js` in full and then ran the real code in Node
(`vm` contexts loading `model/codec/save/merge/storage.js`), including the *shipped old build* pulled with `git show 31cb0ba:...`:

- An older build keeps `modules.lists` **byte for byte** through `checkDoc` and through another module's `writeSection`
  (probed: true). The new checker always returns the whole frame, is idempotent, has no size limit, and every key the section can
  hold passes the generic key rules; the section holds no arrays, so the generic cleaner's array cut can never apply.
- All three apps (Tracker, Command Center, Atelier) embed the same new `save.js` — verified in the built copies
  (`tracker/site`, `tracker/dist`, `crafting/atelier/site`, `crafting/atelier/dist`, `command-center/site/save.js` all contain
  `checkLists`), and the site copies match the sources byte for byte.
- Stale writes, probed through the real `CC.writeSection`: a stale page editing a list/item removed elsewhere is refused whole
  with the right message and the store stays unchanged; a stale removal of a unit another tab changed is refused; a conditional
  (undo) write is refused when its unit changed since and succeeds when it matches; with the stored section hand-deleted, a stale
  page is merged against an empty frame and never writes its old copy back whole.
- Sync, probed through the real `ET.threeWay`/`ET.applyMerge`: removed-against-changed units (wanted item, way, stock count, list
  header) in both orientations stay until the removing side is explicitly answered; the whole-list question appears once, names the
  list, and says what each answer does; unanswered keeps everything and asks again next sync; answering the removing side deletes
  exactly the list and its items; the same id made on two devices with different creation times is kept as two records under a
  deterministic new id on both devices (settles), and equal times stay one record.
- Free-company and slot rules are untouched (the diff adds a branch; `CC.mergeUnit`, `CC.mergeModules` and the gate for other
  sections are unchanged), pinned by the unchanged R/SI/INT tests, which pass.

**Prices.** `earn.js`'s rules moved to `prices.js` faithfully: same two storage keys, same query text, same reply reading for
Submersibles (its reader never signals "no price", so a missing price still stores 0 exactly as before — `earn.test.js` runs
unedited and passes, `subs.js` is untouched). Lists gets its own two keys and query; the two services do not touch each other's
records (`prices.test.js` passes). The 15-minute automatic-attempt limit lives in device storage, so reloads and second tabs honour
it; the page guards concurrent fetches and keeps one follow-up, and the automatic attempt only runs while the market section is
open — no request loop is possible.

**Engine and edits, probed on the shipped fixture and real data:** gil merchant first at every level (the merchant material is
bought and its own materials are not planned; the other-currency material that also has a recipe is crafted); multi-yield spare
(4 wanted of a yield-3 item → 2 crafts, 6 made, spare 2, not given to any need); the fixed trade offer with every currency charged
(3 wanted of "2 for 3 Y + 50 gil" → 2 trades, 6 Y, 100 gil, 12 of Y's material — the spec's own example); gil offer chosen as
cheapest for the whole shortfall with the stated tie-breaks (4 bolts → four singles at 100 = 400 gil, that seller named; a
high-quality need takes the high-quality offer); loops cut at the lowest item id (self-loop, two crafts, two trades, craft+trade all
plan-ending, shown under Other with a note; a merchant part of a cut item would still be bought); recording a craft takes only the
stock the plan gave that craft plus unpromised stock, never another line's stock, and names the materials it could not take; "Bought
it" adds exactly the typed units; a step hand-in removes only the handed-in items' own stock; removing a wanted item never raises
any total (checked on a two-list multi-yield case). Undo restores the section byte for byte, works through the real save write,
and is refused without touching the store when another tab changed the same unit. The permanent model test (parts A/B/C over the
real save and sync code) passes.

**Page safety.** Every text from data or the player (item, list, step, character, seller, price, notes, undo labels) goes through
the escaping helper before entering the HTML; the only link built from data is the Atelier link with a numeric recipe id. The two
crafted links (`#from=`, `#recipe=`) are matched against strict patterns, only open a screen, are removed from the address bar, and
write nothing to the save (the Atelier's hash handler calls no persist). Timers are bounded: a 15-second interval only rewrites
window countdown text; price fetches are gated as above. The Tracker's link sits in its own row outside the fold button, both
handlers return early for it, and it shows only inside the Command Center on open crafting-log groups with unticked entries.

**Tests and checks.** The only edits to existing tests are the recorded ones: the stand-in module renamed `lists`→`notes` in two
places in `core.test.js` and five lines in `submarines.test.js` (assertions unchanged), the module/card counts in `check.js`
(3→4 cards, switcher list, tabs), plus new checks C145–C166 and evidence block L2. `earn.test.js` and `subs.js` are untouched. I
found no test that cannot fail (the new tests assert concrete values, messages and byte equality). The data file itself checks out:
no recipe loops in the shipped 13,892 recipes, closure holds (every result, ingredient, trade item and currency is in `items`),
gil offers sort first, the stamp is 24 characters, the built `lists/data.js` is 474 KB packed (budget 1.5 MB), and every crafting-log
recipe id is in the recipes.

**What I ran, plainly.** I ran the unit suites directly with Node (no `npm ci` was needed — the unit tests are plain scripts and
`node_modules` only holds the browser-test package): `core.test.js`, `submarines.test.js` (144 pass), `earn.test.js` (16),
`prices.test.js` (6), `lists-data` (10), `lists-engine` (43), `lists-model` (45), `lists-store` (15), `lists-store-order` (1),
`lists-look` (8) — all pass, 0 fail. I also ran my own probe scripts against the real save/merge/engine/store code as described
above. I did **not** run `npm run test:browser`, the Atelier browser tests, or the full `npm run check` (they need Playwright's
Chromium, which is not installed here), and I did not run `npm run build`; the built copies were verified by byte comparison instead.

---

## The choice for the owner (every real option, including keeping things as they are)

The one finding is the missing "Restored list" view. Your real options:

1. **Keep things as they are and publish now.** What happens: the module ships as reviewed; all lists, items and stock counts are
   safe and manageable. In the rare case where a sync with a device still on the old version leaves an entry without its list
   (or a save was hand-edited), that entry stays safely in the save but is invisible and cannot be renamed or removed from the page
   until its list comes back. What it improves: players get the planner now. What it costs: nothing. Risk left: a player in that
   rare case sees an empty list and may add the item again, ending with a duplicate hidden entry; no data is lost. What you give
   up: the view the design promised for exactly this case. How sure I am: certain that nothing is deleted; fairly sure the
   invisible-entry case is rare (it needs an old-version sync or a hand edit).
2. **Fix first, then publish (recommended).** What happens: as option 1, plus a small page addition — entries without a list show
   as a "Restored list" card where the player can rename, move or remove them, with a test pinning it. What it improves: matches the
   design and the known-limits note, and closes the only gap this review found. What it costs: a small page change and a test —
   hours, not days (exact cost unknown). Risk left: very small; the change is additive. What you give up: a little time before
   publishing. How sure I am: high.
3. **Publish now and fix in a follow-up patch.** Same as option 1 today; the fix ships later. What it costs: nothing now, a small
   patch later. Risk left: the same as option 1 for the weeks until the patch ships. What you give up: the same as option 1, for a
   while. How sure I am: high.

**Recommendation: option 2.** One plain reason: the only gap found is a promised player-facing view for a rare but real
cross-device case, and it is cheap to add before anything is published.

Technical: assignment `ASG-20261122-lists-code-review-mistral-001`; PR #4 head `ad41b595b2eac9ec36d3e8dc58baabf36b4ecde2`, base `31cb0ba3a104eeb4c29809a4585421a7fa99e8b4`; finding 1: `tracker/command-center/src/lists/lists.js:738`, `tracker/command-center/src/lists/store.js:288`, `docs/lists-spec.md:217`, `docs/STATE.md:217`, `tracker/tests/core.test.js:3321`; finding 2: `tracker/command-center/src/lists/engine.js` header + `L.plan`.
