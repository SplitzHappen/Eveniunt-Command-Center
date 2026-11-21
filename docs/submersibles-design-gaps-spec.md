# Submersibles: closing the gaps against the original design

Written 2026-11-18 by the orchestrator, after the built module was compared with the module's original design (kept
outside this repository). Ten gaps are closed here; two things the design asked for are deliberately not built.

## Owner decisions

- **The sea map stays read-only.** Discoveries are ticked in a list in Setup, and after a voyage the return sheet asks
  which sectors were revealed, offering only the ones that voyage could have revealed. Nothing is ticked on the map.
- **No availability window.** The owner prefers to maximise unlocking and leveling whatever the return time, so
  leveling routes are not timed to the player's hours. The unused setting is left alone.
- Everything below is built. Nothing here changes the save (`tracker/src/core/save.js` untouched; nothing new stored).

## Where things are

Code: `tracker/command-center/src/submersibles/` (`subs.js`: `plannerHtml`, `mapPick`, `routeRatesHtml`, `adviceHtml`,
`sendSheet`, `sendAllSheet`, `figures`, `confirmation`, `earnHtml`, `setupHtml`, the return sheet; `advisor.js`:
`adviseRecs`, `partTip`, `gilTip`, reasons and alternatives; `chart.js`; `drops.js`; `earn.js`; `fleet.js`; `subs.css`).
Tests: `tracker/tests/submarines.test.js`, `earn.test.js`, `core.test.js`. Browser checks: `tracker/command-center/
check.js`, each wrapped in `guard(id, fn)`; C78 to C99 exist.

Look: `docs/submersibles-look-spec.md`, Revisions 2 and 3 (slab heads, display numerals, the palette of four voices
`--rank-*`, `--gil-*`, `--loot-*`, `--route-*`, seven sea colours, status colours and their text tones). New elements
use the existing classes and tokens; minimal CSS in that style only where no class fits. The contrast test
`tracker/tests/subs-look.test.js` is the authority and gains any new colour pair. The hue-family floors asserted in
the evidence block L1 must still pass.

Rules for every item: `advise` without `input.recs` stays exactly as today; no check or test is weakened; a colour
never carries meaning alone; no sideways scroll at 360 px; the frozen chart rules hold (geometry, `viewBox`, exactly
one `<polyline`, no nested `<g>` in a sector node, attribute order on `.chart-letter` and `.chart-tag`, `tabindex`
only on sectors, tap sizes).

## Part A: planner and advisor (check C100)

**G1. The planner lists what the route can bring.** The planner's side panel shows range, time, tanks and experience
but not the loot. The send window has it (`routeRatesHtml`: "What this route usually brings", with the estimate and
its sample size). Show the same content in the planner once a route is chosen, collapsed by default, for the chosen
submarine.

**G2. A sector the submarine cannot take says why.** In the planner, with a submarine chosen, a sector that cannot be
added is only dimmed. Each such sector says its reason, visibly: on the chart a distinct "cannot" treatment (the error
colour as an outline or mark together with a shape or symbol), and in words when it is tapped or focused and in its
accessible name:
- "Rank N needed (this submarine is rank M)";
- "Not found yet";
- for a found sector the current route cannot be extended to within range, "Needs range N more", where N is the range
  the route would use with this sector added, minus the build's range, from the same route evaluation the planner
  uses. If the sector alone is out of range from Start, it says so.
A sector that can be added stays as it is.

**G3. Every figure says where it comes from.** A small label on each figure in the advice block, the send window and
the planner, in the existing small tag style: return time and range are "calculated" (the existing confirmation
wording stays); tanks and base experience are "game data"; an own-log gil figure is "learned", with its voyage count;
a community estimate is "community estimate" (it is neither the game's data nor the player's own). Compact at 360 px.

**G4. Each alternative says how it differs from the plan.** One short clause on each "other route", comparing it with
the plan on the deciding measure and on return time, for example "12% more experience an hour, back 5 h later
(04:10)" or "8% less gil an hour, back 3 h sooner". Computed from the figures already there.

**G5. A part suggestion when nothing useful is in reach.** When no discovered sector is within the build's range, name
the single part change (any slot, among parts the submarine's rank allows) that brings the most discovered sectors
into range, as a calculation, saying that it applies only if the player has the part or plans to craft it. If no
single swap brings anything into range, say that.

**G6. No part advice while unlocking or leveling.** Part advice appears only when Gil Farming leads (the estimate-based
tip) or in the G5 case. When Unlocking Routes or Leveling Submersible Rank leads there is none. When Loot Farming
leads, a tip appears only if it is valued by the loot estimate; otherwise none. Tests and checks that assert the old
minutes-based tip beside a non-gil plan change accordingly.

Tests: unit tests for G2 (the three reasons and the range arithmetic), G4, G5, G6. Browser check C100: G1, G2 and G3
in the planner at desktop and at 360 px, and G4 on an advice with alternatives.

## Part B: board, setup and earnings (check C101)

**G7. Send all back submarines, for the whole fleet.** Today "Send all back" exists per free company. Add one control
on the Board that does the same for every free company at once: it opens the same kind of sheet, listing every
returned submarine with its suggested route grouped by free company, each with its own tick, nothing sent until the
player confirms. Returns logged exactly as the per-company sheet logs them.

**G8. Which free companies to show.** A setting in Setup: a tick per free company, all ticked by default. An unticked
company is hidden from the Board, the "next back" strip and the fleet-wide send, and its alerts are unchanged. This is
a view preference: store it the way the module's other per-device view preferences are stored (the Board's "by FC /
by return time" choice); if that is in the save, use the same place and say so; add no new save field. A hidden
company's data is never deleted. The Board says how many companies are hidden, with a way back to Setup.

**G9. Rank-up plan per submarine.** For each submarine below the top rank: the experience still needed to the top rank
(from the game's rank table and the submarine's rank and experience into the rank), and the expected days at its
current or suggested route (that route's base experience per voyage and voyage length; say "at least", since base
experience is a floor). Shown where a submarine's details are (the send window and a compact line on the Board card
if it fits the dense layout; if it does not fit, the send window only).

**G10. Earnings totals per submarine.** Earnings has totals by period, free company, route and item. Add the same by
submarine, in the same table pattern.

**G11. Discoveries are asked for, not hunted.** Confirm and, where it falls short, fix: Setup has a tick list of
sectors per sea for what is already discovered; and when a returned submarine is sent again or its return is logged,
the return sheet asks which sectors were revealed, listing ONLY sectors that are not yet discovered and that a sector
on that voyage's route can reveal (from the unlock table), by name and letter, none ticked by default, with "none"
as the obvious answer. If the route could reveal nothing new, the question is not shown.

Tests: unit tests for G9's arithmetic, G10's totals, G11's eligible list. Browser check C101: G7 (two companies, three
returned submarines, one unticked; exactly the ticked ones are sent and logged), G8 (hide one company; Board and
fleet send follow; reload keeps it), G9 and G10 visible, G11 (only eligible sectors offered; none when nothing can be
revealed).
