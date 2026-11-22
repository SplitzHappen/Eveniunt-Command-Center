# Lists spec: adjudication of the two outside reviews (round 2)

Date: 2026-11-22. Subject: `docs/lists-spec.md` as reviewed (the revision after the same-family review). Reviewers:
ChatGPT (verdict "not ready", 20 findings, CG1 to CG20) and Mistral (verdict "ready after fixes", 15 findings, M1 to
M15), both outside the model family that wrote the spec. Rulings by the orchestrator, applied by the planner in
revision 4 of the spec; where the planner applied a ruling differently, the reason is in the row. Nothing was built or
run for this adjudication; the fixes are text in the spec and tests named for the builders.

Totals: 35 findings; 32 accepted, 3 accepted in part, 0 rejected.

| Reviewer | No. | Severity given | Our severity | Ruling | Reason | Fixed in the spec |
| --- | --- | --- | --- | --- | --- | --- |
| ChatGPT | CG1 | Blocker | Major | Accepted | Confirmed in the code: a unit removed here and changed there is deleted when no answer is given. Major, not blocker: it needs two sides acting on one entry, and the fix is one pass | D21; section 4 LY0 (sync and tab merge) and LI4 (stale write); W3 LS-13; W4 LY tests through the real tab save and a sync; C146, C149 |
| ChatGPT | CG2 | Blocker | Major | Accepted | A recorded craft could not complete a must-craft entry or count several crafts | D26; target field `crafted`; `LISTS.record` and "Recording a craft" in section 5; E12; W2 LE-R17; W7 ST-12; C153 |
| ChatGPT | CG3 | Blocker | Major | Accepted | "Already have" met a need with nothing and broke the balance rule | "Already have is an outside supply" in section 5; E2, E11; section 7 section "Not in your typed stock"; W2 LE-R18; C163 |
| ChatGPT | CG4 | Blocker | Major | Accepted | The old "exactly unchanged" claim was false when what was made serves another need | E12 rewritten as (a) what always holds, (b) when no total rises, (c) otherwise; recording with short materials allowed and said so; W2 LE-R17 |
| ChatGPT | CG5 | Blocker | Major | Accepted | Undo could overwrite a newer count from another tab | D16; section 4 LI5; E20; section 7 Undo; W3 LS-14; W7 ST-11; new check C165 |
| ChatGPT | CG6 | Blocker | Major | Accepted | Only trade loops had a rule | D24; "Loops" in section 5; E14; data tool stops on a recipe loop (section 3); W1 LD-9; W2 LE-R14; C163 |
| ChatGPT | CG7 | Major | Major | Accepted | The whole-list question had no complete table | Section 4 LY1 table (five cases, Keep, Remove, unanswered, repeat sync), LY4; W4 LY tests |
| ChatGPT | CG8 | Major | Major | Accepted | One line per item cannot hold two ways | D22; `plan.lines` keyed by item, part and recipe; section 7 "A row is one line of the plan"; C150 |
| ChatGPT | CG9 | Major | Major | Accepted | A partial purchase does not make the row disappear | `LISTS.bought` takes units; E18(a); section 7 "Bought it"; W2 LE-R20; C162 |
| ChatGPT | CG10 | Major | Major | Accepted | Flag combinations had no rule | "The four parts" in section 5 (precedence, flags always kept, a collectable needs a collectable recipe); E6; W2 LE-R19; W7 ST. Collectability ratings are not tracked: stated limit |
| ChatGPT | CG11 | Major | Major | Accepted | Removed intermediate recipes could not be found from today's tree | Section 6 patch rule: old table rebuilt from the old rows in `changes`, old and new trees compared, several patches as one step; `gone` keeps old rows (section 3); W1 LD-7; C157 |
| ChatGPT | CG12 | Major | Major | Accepted | A cap of four offers could drop the only high-quality offer | Section 3: every distinct offer kept, only exact duplicates merged; W1 LD-10; W2 LE-R16 |
| ChatGPT | CG13 | Major | Major | Accepted in part | Accepted: offer choice, every currency charged, currencies planned in turn, data closure. Applied differently for trades: "lowest total cost for the shortfall" is used for gil offers only. A trade offer chosen by the amount could switch when a wanted item is removed and raise a currency's need, breaking E5; so a trade is fixed by a rule that ignores amounts, and the player can pick another (D25) | D25; "Which offer" in section 5; E8; section 3 closure; way field `offer`; W1 LD-1; W2 LE-R15, LE-R16 |
| ChatGPT | CG14 | Major | Major | Accepted in part | The risk is real for arrays; a new protection for old builds is not possible. Fixed by design instead: no arrays at all in the section, so the cleaner's cut cannot apply in any build | D23; section 4 (steps, order of ways and combined selection are objects or text); W3 LS-12 against the shipped build |
| ChatGPT | CG15 | Major | Major | Accepted | The owner-facing text promised more than the design gives | Section 5 "How totals are shared out", E5, E9; section 7 step sentence; section 10; section 11 Q4 options A and C |
| ChatGPT | CG16 | Major | Minor | Accepted | Two work items contradicted the text | Section 3 and W1: `log` is added and checked by `build.js` in W6; W6 escalation: recipes the Atelier lacks are allowed and counted |
| ChatGPT | CG17 | Minor | Minor | Accepted | A link inside a button-like cell | Section 6 "From the Tracker": the link is a row of its own outside the fold cell; W12 TL-1, TL-3, TL-5 (mouse and keyboard) |
| ChatGPT | CG18 | Minor | Minor | Accepted | Missing, zero and stale prices had no stated display | Section 6 price table; `read` may return `null`; W5 PR-5; new check C166 |
| ChatGPT | CG19 | Minor | Minor | Accepted | No entropy or collision rule for ids | Section 4 "Ids" and LY6; target field `at`; W4 LY6 test; W7 ST-13 |
| ChatGPT | CG20 | Minor | Minor | Accepted | "Identical plan" was not defined for a fresh id | E13 compares totals; exact restore is E20 |
| Mistral | M1 | Major | Major | Accepted | A full-hash stamp would not fit the saved field and the notice would never show | Section 3 stamp format (at most 40 characters, short hashes), tool stop rule; W1 LD-8; W3 LS-15 |
| Mistral | M2 | Major | Major | Accepted | E18(c) was false after a purchase | E18(c) qualified as proposed; W2 LE-R10 |
| Mistral | M3 | Major | Major | Accepted | "kept-changed" was undefined | Same fix as CG7: LY1 table, case 3 covers a header missing while wanted items remain |
| Mistral | M4 | Major | Major | Accepted | Recipe loops had no rule | Same fix as CG6 |
| Mistral | M5 | Major | Major | Accepted | Confirmed in the code: the stale rules run only when a stored section exists | Section 4: the checker always returns the whole frame, and for `lists` the rules run with a missing section read as empty; W3 LS-11 |
| Mistral | M6 | Minor | Minor | Accepted | The orphan sentence contradicted LI2 | Section 4 "A wanted item without its list" reworded as proposed |
| Mistral | M7 | Minor | Minor | Accepted | Precedence of the flags | Same fix as CG10. Order used: must-craft, then collectable, then high quality, then ordinary |
| Mistral | M8 | Minor | Minor | Accepted | "Cheapest gil offer" was undefined | "Which offer" in section 5: lowest total for the shortfall, tie-breaks stated; W2 LE-R16 uses the reviewer's example |
| Mistral | M9 | Minor | Minor | Accepted | "Moved unchanged" cannot be literal at two lines | Section 6 names the two lines that become `create()` parameters |
| Mistral | M10 | Minor | Minor | Accepted | "Finished" and stock were unspecified | "Finished" in section 5, `LISTS.finishStep`, E19; section 7; W2 LE-R21; C151. A step takes out what the plan had given its items, so no other total rises |
| Mistral | M11 | Minor | Minor | Accepted | Which quality the select sets | Section 7 "Changing how an item is got", first bullet; C163 |
| Mistral | M12 | Minor | Minor | Accepted | The checker should always return every top-level key | Same fix as M5 |
| Mistral | M13 | Note | Note | Accepted | No spec change asked; kept as a risk, and W1 reports sizes on its first run. Keeping every offer makes the risk larger, which section 9 now says | Section 3 last paragraph; section 9; W1 accept and escalate lines |
| Mistral | M14 | Note | Note | Accepted in part | Collectables stay crafted: the merchant data does not say whether what is sold is a collectable, so "buy it" could not be honest. Stated as a limit, not changed | Section 5 (make and coll parts are always crafts); Order of ways sheet sentence; section 10 |
| Mistral | M15 | Note | Note | Accepted | The handler must not fold on the link | Same fix as CG17: the link is outside the fold cell and both handlers return at once for it |

## Where the planner's application differs from the ruling as written

- **CG13:** the ruling said the offer is the one with the lowest total cost for the shortfall. That is applied to gil
  offers. For trades it is not, for the reason in the row; the reason is a property the reviews themselves insist on
  (totals never rise from a removal). If the owner or the orchestrator prefers cost-based trade choice, E5 and E8
  would have to carve out currencies.
- **CG17 and M15:** of the two allowed fixes the stricter one is used (the link outside the fold control), with the
  early return kept as a guard.
- **CG2:** the `done` mark is kept for "Finished"; the made count asked for is a new field, `crafted`.

## What the reviews confirmed and is kept as it was

An older build keeps the lists section whole; the merge works in the units the spec assumes; no existing path deletes
a list without the player's choice; the price move is feasible with `subs.js` unedited; the Tracker and Atelier hooks
exist as described; E1 to E3, E10, E16 and the merchant-first rule in the simple case. Both reviewers recommend option
A of Q4; the question stays with the owner.

## What is still only argued on paper

That the loop cuts and the fixed trade offer keep "totals never rise"; E12(b); E19; that two devices compute the same
new id in LY6 and settle; that the new lists branch in the sync changes nothing for other sections. The permanent
model test (W2, W3, W4) is the authority for each.
