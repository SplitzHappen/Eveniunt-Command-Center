# Independent review: `docs/lists-spec.md` (Lists crafting planner, PR #4 candidate)

Reviewer: Mistral (outside the model family that wrote the spec). Assignment ASG-20261122-lists-spec-review-mistral-001, branch `assignments/ASG-20261122-lists-spec-review-mistral-001`. Review by reading only: the spec (696 lines), `docs/lists-research.md`, `CLAUDE.md`, `docs/STATE.md`, and the code the spec relies on (`tracker/src/core/save.js`, `merge.js`, `storage.js`, `model.js`, `codec.js`, `cloud.js`, `tracker/command-center/src/submersibles/earn.js`, the `EARN.*` calls in `subs.js`, `crafting/atelier/src/atelier.js`, `tracker/src/app/ui.js`, `tracker/command-center/check.js`, `.github/workflows/checks.yml`, `tracker/data/SOURCES.md`). Worked examples below were done on paper; no code was run or changed.

**Verdict: ready after fixes.** The architecture is sound and I verified its load-bearing claims against the real code (old builds really do keep an unknown `modules.lists` section, the merge really works in the units the spec assumes, and no existing path can delete a list without the player's choice). The five MAJOR findings are all places where the spec text, taken literally, is wrong or undefined in a way a builder would implement incorrectly or a test would catch late; each has a one-paragraph fix. Nothing needs redesign. Answer Q4 before W3 (the save layout) — see the last section.

---

## Findings (most severe first)

### 1. MAJOR — §3/§4/§6: the data stamp cannot fit the 60-character cap on the saved `data` field
- **Spec section:** §3 table (`stamp`), §4 save shape, §6 patch-change rule.
- **Problem:** §3 defines the stamp as "game version, sheet commit, Teamcraft commit", pinned as in `tracker/data/SOURCES.md`. SOURCES.md pins **full 40-character hashes** (`tracker/data/SOURCES.md:4`, e.g. `44948e4cda5846eab0baa9872122a888fcc4f1b1`). A stamp built from those is roughly 6 + 40 + 40 + separators ≈ 86 characters, but §4 caps the saved field: "`data` the data stamp, up to 60" (`docs/lists-spec.md:135`), and the planned `CC.checkLists` keeps only known fields of the right type within the stated limits. If the tool emits a full-hash stamp, the checker silently drops `data`, and §6's rule "A save whose stamp this page does not know … shows no notice" (`docs/lists-spec.md:321`) then applies to every list — the entire patch-change notice would never fire, silently.
- **Consequence:** the §6 feature ("Game data changed since this list was last checked") is dead on arrival, with no error anywhere; players would never be told a patch changed their recipes, which is research fault §4's whole point.
- **Proposed fix:** define the stamp format to fit 60 characters (game version + short hashes, e.g. first 8–10 of each commit, as §3 already writes them short in prose) and add an LD/LS test that a real stamp produced by `lists-data.py` round-trips through `CC.checkLists` byte-for-byte and is ≤ 60 chars.
- **Evidence:** `docs/lists-spec.md:95` (stamp definition), `:135` (`data` ≤ 60), `:315-321` (patch rule; unknown stamp → no notice); `tracker/data/SOURCES.md:4` (full 40-char pin).

### 2. MAJOR — §5 E18(c): "changing the way back gives the earlier plan again" is literally false after a purchase or recorded craft
- **Spec section:** §5 invariants, E18.
- **Problem:** E18(a) explicitly allows "recording it with `LISTS.bought`" to raise the bought item's own stock. If the player then changes the way back by hand, the stock is still higher, so the plan is *not* the earlier plan (it is lower — nothing is lost, but it is different). The model test "asserts E1 to E18" over "random sequences of way changes, crafts recorded, items bought" (`docs/lists-spec.md:304-305`), so W2 will hit exactly this as an escalation.
- **Consequence:** either the model test fails on legitimate sequences and W2 escalates, or a builder quietly weakens E18(c) to get green — which the spec forbids ("An invariant is never weakened to get a green run").
- **Proposed fix:** qualify E18(c): "Changing the way back, with the stock counts as they were, gives the earlier plan again; after a purchase or a recorded craft, the plan is never worse than before the change." State that undo (D16) is the path that restores the exact earlier plan including stock.
- **Evidence:** `docs/lists-spec.md:292-297` (E18(a) "the bought item's own, which only rises"; (c) "gives the earlier plan again"), `:304-305` (Part A sequence and assertion).

### 3. MAJOR — §4 LY1: the trigger phrase "kept-changed" is undefined, and under the narrow reading LY3 breaks
- **Spec section:** §4 sync, LY1/LY3.
- **Problem:** LY1 fires when "A list header removed on one side while the other side changed it, or changed, added or kept-changed any of its wanted items" (`docs/lists-spec.md:178`). "kept-changed" is not defined anywhere. In the real merge, a unit unchanged on one side and removed on the other is taken silently with **no conflict** (`tracker/src/core/merge.js:54-55`, conflict only at `:66`). So a header-only removal on one side (an old build's unit merge, or a hand edit) with the other side's wanted items unchanged: under the narrow reading of LY1 (only "changed/added") no list question fires, the header is dropped, the targets stay — and LY3 ("After a sync no wanted item lacks its list unless one side already held it so", `docs/lists-spec.md:182`) is violated by a new-build sync.
- **Consequence:** list entries silently lose their list in a sync — the exact failure the brief warns about — with the page showing them only as "Restored list".
- **Proposed fix:** define the trigger explicitly: the list question fires whenever a list header is absent from one side's copy while the other side's copy still holds that header or any of that list's wanted items, changed or not — i.e. whenever the merge would orphan units. (New-build-to-new-build flows never produce this, because D7 removes a list with everything in it; the clause exists for old-build partial removals.)
- **Evidence:** `docs/lists-spec.md:178-182`; `tracker/src/core/merge.js:54-66`.

### 4. MAJOR — §5: only trade loops are cut; a recipe (craft) cycle has no rule and can loop the engine
- **Spec section:** §5 settlement order and E14; §3 tool stop rules.
- **Problem:** Settlement is "each exactly once, after every item that can need it (a trade loop is cut, E14)" (`docs/lists-spec.md:232-233`), and E14 says "a trade loop is cut, the item is listed under `other` and a note says why" (`:283`). Nothing cuts a cycle made of recipes (X's recipe needs Y, Y's recipe needs X) or a mixed craft/trade cycle, and no rule says which side of a loop is moved to `other`. The data tool's stop rules (§3) check missing items, yields, trade ratios and counts — not acyclicity. The model test's random data includes "a trade loop in some" but no craft loop (`:304`).
- **Consequence:** on a cyclic recipe graph the engine has no valid settlement order and can spin forever (a hung page), or a builder invents an untested cut. Real game data is acyclic today, but nothing in the repo proves it stays so, and the tool is the natural place to stop on it.
- **Proposed fix:** extend E14 to every cycle, craft or trade: cut at a deterministic point (e.g. the item whose way is the trade, else the lexicographically smallest item id in the cycle), list it under `other` with a note, and say the other side keeps its normal way. Additionally make `lists-data.py` stop, writing nothing, if the recipe graph has a cycle.
- **Evidence:** `docs/lists-spec.md:232-233`, `:283`, `:108-115` (tool stop rules, no cycle check), `:304` (model test loops).

### 5. MAJOR — §4: the LI stale-write rules sit behind `if (stored && rev !== known.rev)`; a vanished lists section lets a stale page resurrect removed lists unquestioned
- **Spec section:** §4 stale writes (LI1–LI3) and Compatibility.
- **Problem:** In the real `CC.writeSection`, the merge and all refusal rules run only inside `if (stored && rev !== (known && known.rev))` (`tracker/src/core/save.js:460`). If `modules.lists` is **absent** from the stored save (all its units removed by an answered sync on another device, or a hand-emptied save) while the page's base still holds lists, `stored` is falsy, the whole branch is skipped, and the page's section is written wholesale — every removed list comes back with no question and no LI1 check.
- **Consequence:** a sync deletion is undone by a stale tab, contradicting D6/LI1 ("Nothing comes back") and CLAUDE.md's merge rule.
- **Proposed fix:** make `CC.checkLists` always emit `v` and all six groups even when empty — exactly what `checkSubmersibles` does (`tracker/src/core/save.js:108-119`) — so the section never disappears once present and the LI branch always runs when it matters; add an LS test for the fully-emptied-section case (stale page writes after the section vanished: refused or merged, never wholesale resurrection).
- **Evidence:** `tracker/src/core/save.js:460` (gate), `:108-119` (always-emitting checker pattern), `docs/lists-spec.md:154-157` (compatibility claim), `:164-172` (LI1–LI3).

### 6. MINOR — §4: the "entry without its list" sentence contradicts LI2 as written
- **Spec section:** §4 save notes vs §4 stale writes.
- **Problem:** §4 says an entry without its list is "never dropped, never a reason to refuse a write" (`docs/lists-spec.md:159-160`), while LI2 refuses a write whose result contains a wanted item whose list header is missing, unless stored already held it that way (`:164-166`). The two are compatible only under a careful reading (orphans already stored stay writable; new orphans are refused), and a builder could read the blanket sentence as forbidding the LI2 refusal.
- **Consequence:** inconsistent checker/write behavior between W3's two clauses; a hand-edited orphan could become unwritable or a new orphan writable, depending on reading.
- **Proposed fix:** reword the §4 sentence to "never dropped; a write that would create a *new* orphan is refused (LI2); an orphan already in the stored copy stays writable and shows under 'Restored list'".
- **Evidence:** `docs/lists-spec.md:159-160` vs `:164-166`.

### 7. MINOR — §5: precedence when one wanted item carries several of `make` / `coll` / `hq` is unstated
- **Spec section:** §5 "How totals are made" (parts 1–4); E6/E7; model test.
- **Problem:** "Each item has up to four parts" and part 4 is "every other need" (`:233-241`), which implies a priority, but nothing says what happens for one wanted item flagged both `coll` and `hq`, or `make` and `coll`. The model test generates "wanted items with `hq`, `coll` and `make`" (`:304`), so the generator can produce the combination while the rule is undefined; E6 ("`hq`, `coll` and `make` stay on the wanted item", `:266`) confirms they can coexist.
- **Consequence:** two builders (or the model test and the engine) can disagree; totals for such an item differ by implementation.
- **Proposed fix:** one line: parts are assigned by precedence `make` > `coll` > `hq` > `normal` (a wanted item is counted in exactly one part), or state explicitly that flags combine and how.
- **Evidence:** `docs/lists-spec.md:233-241`, `:266`, `:268`, `:304`.

### 8. MINOR — §5/§3: "the cheapest gil offer" is undefined and can pick the wrong seller
- **Spec section:** §5 "Getting a shortfall" (vendor rule); §3 `trades` table.
- **Problem:** "`vendor` = trades of shortfall ÷ what one trade gives, rounded up, **at the cheapest gil offer**" (`docs/lists-spec.md:244`); §3 sorts "gil offers first and cheapest first" (`:97`). Cheapest per unit, per purchase, or per total for the needed amount can disagree. Worked example: offers "1 item for 100 gil" and "3 items for 280 gil", shortfall 4. Unit-cheapest picks the 3-for-280 offer → total 560 gil; total-cheapest picks four singles → 400 gil.
- **Consequence:** `gil.vendor` and the named seller on the row depend on an undefined comparison; two implementations differ, and the shown "Sold by …" may not be the best buy.
- **Proposed fix:** define it as lowest total cost for the shortfall — min over gil offers of ceil(shortfall ÷ gives) × price — with a deterministic tie-break (lowest unit price, then lowest npc id), and name that offer's seller on the row.
- **Evidence:** `docs/lists-spec.md:244`, `:96-97`.

### 9. MINOR — §6/D9: "moved unchanged from earn.js lines 138–205 and 220–237" cannot be literal at two spots
- **Spec section:** §6 shared price service.
- **Problem:** the line ranges are accurate and I verified them, but `E.settle` reads the reply field `x.averagePrice || x.currentAveragePrice` (`earn.js:197`) and `E.fetchPrices` hard-codes the query `?listings=0&entries=20` (`earn.js:229`). The shared `PRICE.create({ cacheKey, triedKey, query, read, tradable })` parameterizes exactly those two things (Lists needs `?listings=1&entries=20` and a `read` that returns cheapest listing etc.), so those two lines must change; "unchanged" can only mean the rules and limits. `subs.js` really does use only price functions that keep their `EARN.*` names after the move (verified: `cached`, `oldest`, `triedLoad`, `triedSave`, `mayTry`, `needed`, `fetchPrices`, `tradable` at `subs.js:981,982,1320-1323,1470-1474`), so "subs.js is not edited" holds.
- **Consequence:** if a builder treats "unchanged" as byte-identical, C113/C117/C123 break; if they over-edit, `earn.test.js` breaks. Low risk, but the spec should say "the rules move unchanged; the query and the reply-field extraction become `create()` parameters".
- **Proposed fix:** one sentence in §6 naming the two parameterization points.
- **Evidence:** `earn.js:187-205` (settle, field read at `:197`), `earn.js:222-237` (fetchPrices, query at `:229`); `subs.js:1470-1474`; `docs/lists-spec.md` §6.

### 10. MINOR — §5/§7: what "Finished" does to stock is unspecified, and no invariant covers `finish`
- **Spec section:** §5 `LISTS.finish`; §7 wording rules.
- **Problem:** `LISTS.finish(have, target) -> have // a finished wanted item leaves the stock` (`:210`) and "A step's 'Finished' takes its wanted items out of the stock" (`:420`), while the row's "Finished" just "asks nothing and can be undone" (`:420`). It is never said whether the row-level Finished also removes stock, how much (qty? all?), or in which quality (`nq`/`hq`/`coll`). No E-invariant covers finish (Part A exercises crafts recorded and items bought, not finishes).
- **Consequence:** the done/finish/stock interaction is the one state change with no invariant; wrong totals after finishing a step are possible and untestable as written (cf. research fault #2971).
- **Proposed fix:** state in §5: row "Finished" sets `done` only (stock untouched — the item is still in the inventory); step "Finished" sets `done` on its wanted items and removes up to `qty` of each from stock in the part's quality (never below 0), and add an invariant: finishing never raises any total and is undone by restoring the removed counts.
- **Evidence:** `docs/lists-spec.md:210`, `:420`, `:304-305`.

### 11. MINOR — §7: which quality's way the "Get it by" select sets is unstated
- **Spec section:** §7 screens; §4 way shape; §5 way rule.
- **Problem:** one stored way per item (`ways.<owner>.<itemId> = { by, recipe, hq }`, `docs/lists-spec.md:141`), but "an item has one way for normal needs and one for high-quality needs" (`:222-224`) and the select "lists only the ways the item really has" (`:386-388`) — the ways an item has differ by quality, and the row may be an hq need or a normal need.
- **Consequence:** a builder could grey out or mis-set the select on an hq row of an item whose stored `by` has no hq.
- **Proposed fix:** one line: the select lists the ways the item has **in the row's quality**; choosing one sets the single stored way, and the other quality then uses the same `by` if that source has that quality, else falls back to the owner's order (the §5 way rule already does this).
- **Evidence:** `docs/lists-spec.md:134` (way shape), `:222-224`, `:384-388`.

### 12. MINOR — §4: `CC.checkLists` should always emit all seven top-level keys
- **Spec section:** §4 checker description; W3 LS-3/C145.
- **Problem:** the checker "keeps every entry whose fields are valid" but the spec never says it always emits `v`, `lists`, `targets`, `ways`, `owners`, `have`, `prefs` when empty. Byte-identical round trips (LS-3, C145) and the section-never-vanishes property (finding 5) both need it.
- **Consequence:** if an empty section checks to `{}`, `modules.lists` can vanish from the store and finding 5's hole opens; if key order differs, "byte for byte" tests flake.
- **Proposed fix:** mirror `checkSubmersibles` (`save.js:108-119`), which always returns its four groups: `checkLists` always returns `{ v: 1, lists: {}, targets: {}, ways: {}, owners: {}, have: {}, prefs: {} }` with entries filled in.
- **Evidence:** `tracker/src/core/save.js:108-119`; `docs/lists-spec.md:148-157`, `:478`.

### 13. NOTE — §3: the 1.5 MB data budget is unmeasured
- **Spec section:** §3 size budget; §9 risks; §12.
- **Problem:** "Size budget (not measured): `site/lists/data.js` at most 1.5 MB" (`docs/lists-spec.md:115`) — the spec itself says not measured, and §12 lists it as not verified. The scope (recipes + ingredients + currencies + gather + trades + log for all items in any recipe) plausibly approaches the budget.
- **Consequence:** if W1's first run exceeds it, the build stops by design and trimming becomes an owner decision mid-build.
- **Proposed fix:** none needed in the spec; keep the §9 risk, and have W1 report plain vs packed size on the first run so the decision, if needed, is made early with numbers.
- **Evidence:** `docs/lists-spec.md:115`, §9, §12.

### 14. NOTE — §5 E7/E17 vs the owner's merchant-first rule: collectables are crafted even if a gil merchant sells them
- **Spec section:** §5 E7/E17; §2 D14; §11 new requirement 1.
- **Problem:** the owner's rule is "an item a merchant sells for gil is bought before anything is crafted or gathered, at every level"; the spec implements this as the default order (D14, `docs/lists-spec.md:64`) but E17 says "only the `make` and `coll` parts are crafts regardless" (`:287-288`) and E7 says a collectable is "met only by collectable stock or a craft" (`:268`). If the pinned data gives any collectable a pure-gil offer, the plan will craft it instead of buying it.
- **Consequence:** a literal reading of the owner rule is not met for such items; in practice vendor-sold collectables are rare/nonexistent, so this is likely theoretical.
- **Proposed fix:** confirm with the requesting model that the `coll` exception is intended (research fault #2896 is the reason it exists); if any collectable has a gil offer in the pinned `shops.json`, either accept it or let the row offer "buy it" like any other.
- **Evidence:** `docs/lists-spec.md:64`, `:268`, `:287-288`.

### 15. NOTE — W12: the new link needs an explicit guard before the fold branch in the Tracker's click handler
- **Spec section:** §8 W12 / TL-3.
- **Problem (verified, planned):** the group row's first cell carries `data-fold` (`tracker/src/app/ui.js:481`), and the click handler folds on any click inside it (`ui.js:752-753`) after the `data-gc` branch (`ui.js:728`). A "Make a list from what is missing" link placed in that cell will fold the group when clicked unless the handler returns early for it first. TL-3 already requires the behavior, and W12's file list includes `ui.js`, so this is a note to the builder, not a spec change.
- **Evidence:** `tracker/src/app/ui.js:475-482`, `:728`, `:752-753`; `docs/lists-spec.md` §8 W12.

---

## What I verified in the code and could not break

Save and sync (spec §4 against the real code):
- **An older build keeps `modules.lists` untouched.** `CC.checkModules` falls back to `clean` for unknown sections (`tracker/src/core/save.js:143-150`); `ET.validateState` passes modules through `CC.checkModules` (`tracker/src/core/model.js:108`); the codec keeps them in EVT2 and leaves them alone for EVT1 (`tracker/src/core/codec.js:14-26,146-147`); cloud packs `save.modules` whole (`tracker/src/core/cloud.js:160`). `clean`'s limits (`save.js:26-36`: safe keys ≤ 64 chars, depth ≤ 10, strings ≤ 20000, arrays ≤ 5000) cannot bite any shape the spec allows — composite keys `<listId>.<targetId>` are ≤ 33 chars and match the safe-key charset. So LS-3/C145 are feasible as written.
- **The merge really works in the units the spec assumes (D5).** `CC.UNIT_DEPTH = 2` (`save.js:173`) makes one unit per `lists.<group>.<id>` — list header (with its steps), per wanted item, per way, per stock count, per owner — exactly as §4 says; `walk`/`unflatModules` (`save.js:175-201`) handle the composite keys, and `CC.safeKey` accepts the dots.
- **No existing path deletes a list or entry without the player's choice.** `writeSection` refuses or merges and stores nothing on refusal (`save.js:460-530`); one-sided removals in a merge are the other page's explicit choice and are asked as conflicts otherwise (`merge.js:54-66`); `applyMerge` without answers keeps the local side, and the integrity kinds (owner/slot) never delete unanswered (`merge.js:200-260`) — the list pass (W4) can mirror this for kind `list`; `CC.checkDoc` refuses newer saves (`save.js:159-165`); "erase everything" and "go back" delete only the Tracker's own parts and keep other modules (`tracker/src/core/storage.js` `ET.clearState`, `ET.goBack`); the old cloud copy without modules is read as agreeing, never as deleting (`merge.js:41-44`). The LI/LY patterns the spec reuses are the proven Submersibles ones (`save.js:460-530`, `merge.js:85-180`).
- **The stale-write rules fit the real write path.** The Submersibles refusals live exactly where W3 would put LI1–LI3: after the three-way merge inside the stale branch, comparing base/stored/result and throwing (`save.js:460-530`). The wording strings match the existing UX. The only gap is finding 5's gate.
- **Sync question mechanics fit.** `ET.threeWay` pushes per-unit conflicts and adds integrity-tagged questions in passes (`merge.js:66,85-180`); `ET.applyMerge` has per-kind branches (`merge.js:200-260`); `CC.describeUnit(id, local, remote, nameOf, integrity)` keeps its signature and already has a `lists` label (`save.js:252-253,290`), so the `lists-label`/`list` integrity labels slot in without a signature change, and Settings needs no Lists data — as the spec says.
- **Price service claims hold.** Line ranges verified (price code at `earn.js:140-205, 222-237`); `subs.js` uses only `EARN.*` names that survive the move (finding 9 lists them); the two storage keys and record shape are untouched by D9.
- **Tracker/Atelier hook claims hold.** `groupHtml` draws one group row with one count cell per character (`ui.js:475-482`); the back link and its `home` address exist (`ui.js:1348-1352`) and are gated on `HOSTED` (`ui.js:19`), which excludes the downloaded single file — matching "only inside the Command Center"; the Atelier's first-visit move and its `moved.atelier` marker exist (`atelier.js:114-124`), and the Atelier currently has **no** hash handling, so W10's "hash link only" is genuinely additive. `check.js` today ends at C144 with no `checkLists` and no "On the way" read (verified), the count assertions W0 lists really do pin exact switcher/card counts (e.g. `check.js:154-155,254,296,535-537,630,769`), and `checks.yml` really uses `actions/checkout@v4` without `fetch-depth` — so W3's workflow change is needed and correctly scoped. `docs/STATE.md` confirms the 2026-11-21 owner decisions the spec cites.

Engine rules (spec §5) I tried to break and could not, with the worked examples:
- **E1–E3:** purity (D3) plus deterministic tie-breaks (order, made, listId) make same-input-same-plan hold; multi-yield: need 5, yield 3 → crafts 2, made 6, spare 1, and 0 ≤ spare < yield.
- **E4:** raising any stock count only lowers shortfalls. Worked case: 1 HQ X held, merchant sells normal X only, X craftable; want 1 HQ + 1 normal X. HQ part takes the 1 HQ stock (shortfall 0); normal part takes normal stock 0 plus the HQ stock part 3 left (0) → shortfall 1 → bought from the merchant. Add 1 more HQ stock: HQ shortfall stays 0, leftover HQ 1 → normal shortfall 0 → totals fall, never rise.
- **E5:** all totals are recomputed globally (D4), and crafts/trades use ceil(shortfall/…) which is monotone non-increasing in shortfall; removing a wanted item only shrinks needs.
- **E6/E7:** parts partition by quality — HQ needs draw HQ stock only and go only to sources that have the quality; collectables draw collectable stock or a craft only.
- **E8:** trades = ceil(shortfall ÷ gives), cost = trades × offer cost — the real ratio (research fault #559), including a trade whose currency is itself crafted: the currency gets a need of trades × amount, is settled after its consumers, and its own recipe's materials get needs in turn.
- **E9:** parts are per item, not per step/list, so one step vs two steps give identical totals (the HQ-X case above in both layouts); shares telescope — a step's crafts = ceil(cum_i/y) − ceil(cum_{i−1}/y), which sums to ceil(total/y), so shares add exactly to the total and moving items between lists/steps moves shares but never totals.
- **E10:** topological order over the craft graph; adjacent same-job blocks merge, so neighbouring blocks always differ in job.
- **E11:** `have` drops the need and everything below it, stock untouched.
- **E12:** worked: need 4 X, recipe yields 3 and takes 2 Y, Y stock 10 → plan 2 crafts, Y covered, Y left 6. Record 1 craft: X stock +3, Y stock 8 → replan: shortfall 1 → 1 craft, Y need 2, Y left 6. Crafts fell by exactly 1 and no other total moved (C×a of each material is consumed from stock either way, so other items' to-get is unchanged) — holds when `short` is empty, as conditioned.
- **E13:** nothing computed is stored (D4) and ids do not enter totals, so remove-and-add-back is the identical plan.
- **E15:** unpriced market items land in `gil.unknown`, never 0 — matching §1's "unknown, never 0".
- **E16:** the page always plans the whole owner (never one list alone), and shares sum to the stock given.
- **E17:** with the default order, a normal need with a normal gil offer is `vendor` and gives no need below it (its whole subtree vanishes); materials appear only for crafts/trades actually in the plan, because needs are computed top-down from the wanted items.
- **E18(a)/(b):** craft→vendor/market/have removes the craft and its subtree, so no total rises and only the bought item's own stock rises; craft→trade adds needs only to the offer's currencies (and, via `LISTS.tree`, what a crafted currency needs).
- **The two owner rules:** merchant-first at every level is the default order plus E17 (subtree vanishing), with `make`/`coll` as the documented exceptions (finding 14); change-at-any-time from every row is D15 + D16 + E18 with C162/C163 pinning it, including "Bought it" after a recorded craft: the bought amount only adds stock, gathered/made materials stay in stock and show under "Left over", and undo restores the exact replaced units.

---

## Q4 (open owner question, §11): once per character, per list, or as first written

Question in plain words: when a character has several lists, is "how I get this item" (buy / craft / gather / trade / market) chosen once for that character, or separately inside each list?

**Option A — once per character (what is built until you answer; keeping things as they are).**
What happens: if you say "I buy iron ingots", that holds in all of that character's lists, and the order of ways (merchant first, then craft, …) is set once per character. What it improves: removing an item from one list, or typing that you hold more of something, can never make any number in any list go up; "I bought it" is said once. What it costs: nothing extra to build — the save layout, engine and tests in W2/W3/W7/W8 already assume it. What is left as risk: a single list's own figures can shift when a sister list changes (a craft can move from one list's share to another), while the character's totals never rise; the permanent randomized test is meant to prove that. What you give up: you cannot craft an item for one list and buy the same item for another list at the same moment (crafting-log entries are always crafted regardless). How sure: fairly — worked through on paper here and by the previous reviewer; the model test will be the authority.

**Option B — separately in each list.**
What happens: each list keeps its own choices and its own order; lists share only the stock you typed, handed out in list order, and what one list crafts beyond its need is not passed to another list until you record the craft. What it improves: each list can be planned its own way. What it costs: about one more builder item and a different save layout (the choices and the order move back into each list), plus rework of W2, W3, W7 and W8 — best decided before the save layout ships. What is left as risk: totals can come out higher than needed (one list shows 2 spare while another tells you to buy 2 of the same item); keeping the same never-goes-up guarantee was not worked through in this plan. What you give up: the one-place "I buy this" statement. How sure: medium.

**Option C — keep the plan as first written before the review (choices per list, and what one list crafts beyond its need is passed on to the others).**
What happens: costs nothing to write. What is left as risk: certain, with a worked example — list 1 crafts X (makes 3, needs 1), list 2 buys X (needs 2) and lives on list 1's spare; removing list 1's item makes list 2 buy 2, so a removal raises another list's numbers. That is exactly the kind of wrong total this module exists to end, and no test can promise otherwise. What you give up: the core guarantee. How sure: certain.

**Recommendation: A (once per character).** One plain reason: it is the only option where removing something or typing more stock can never make any list tell you to get more of anything — the exact fault this module was commissioned to fix — and it costs nothing extra to build. Decide before W3 ships the save layout; if you pick B, that is the moment to change it.

Technical: Q4 (`docs/lists-spec.md:651-672`), D12, E9, save keys `modules.lists.ways` / `modules.lists.owners`, affected items W2, W3, W7, W8 (`docs/lists-spec.md:455-500`).

---

## Notes for the requesting model

- The spec's own claims I checked and found accurate: earn.js line ranges (finding 9), check.js counts and C144 ceiling, `checks.yml` checkout depth, `groupHtml` shape, `moved.atelier`, `UNIT_DEPTH`, the `lists` label in `describeUnit`, STATE.md decisions, "On the way" at `src/index.html:81-84` with no check reading it.
- W-order in §8 is dependency-correct; the only sequencing constraint is answering Q4 before W3, which §9 already states.
- No acceptance check I read is unfailable; the model test's "never weaken an invariant, escalate instead" stance is the right guard, and finding 2 is the one invariant that will trip it first.
- I did not open the private planning workspace (the spec says it was not opened either); nothing here depends on it.
