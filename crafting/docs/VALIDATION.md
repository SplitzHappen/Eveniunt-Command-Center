# Validation report

Build: see `dist/manifest.json`. Data: `xivapi/ffxiv-datamining` @ `44948e4c` (game version 7.57h1). Date: 2026-11-06.

## 1. Supported planets, missions and recipes

| File | Planet (patch) | Missions | Recipes | Classes |
| --- | --- | --- | --- | --- |
| `cosmic-sinus-ardorum.html` | Sinus Ardorum (7.21) | 400 | 520 | 8 |
| `cosmic-phaenna.html` | Phaenna (7.31) | 360 | 480 | 8 |
| `cosmic-oizys.html` | Oizys (7.41) | 240 | 304 | 8 |
| `cosmic-auxesia.html` | Auxesia (7.51) | 240 | 280 | 8 |

All 1,240 crafter missions and 1,584 recipes in the game data at that version are included, with every rank (D, C, B, A, EX, EX+, Master), critical, timed, multi-recipe and chained missions. Gathering and fishing are out of scope.

## 2. Completeness of the database

- Complete for what the game data holds: recipe values, condition sets, quality tiers, required quality, special-action type and charges, objectives, bronze/silver/gold thresholds, time limits, level requirements and level sync. The extractor's checks (`docs/DATA.md`) report 0 problems.
- Not available, therefore not included: the score a crafted item earns; condition probabilities; Material Miracle's condition distribution.
- Equivalence: 1,584 recipes share 138 numeric profiles (each profile is used by all 8 classes); names and scoring stay per mission.

## 3. Mechanics implemented

All crafter actions up to level 100 except Trained Eye (never usable on these recipes), all 11 material conditions, Cosmic tool Good bonus, Stellar Steady Hand, Material Miracle (time-based), combos, buffs and their timing, failures, level sync. Detail and status of every rule: `docs/MECHANICS.md`.

## 4. Tests executed

| Suite | What it checks | Result |
| --- | --- | --- |
| `tests/sim.test.js` (16) | Four in-game-recorded sequences reproduced exactly (Raphael "verified in-game" 7.0/7.1, Classical Index, Teamcraft's recorded in-game values incl. f32 rounding); condition effects; buff timing; non-step actions; Primed/Good Omen/Robust; failure handling; Stellar Steady Hand; Material Miracle; durability-0 rule; combos; CP costs and levels vs game sheets (35 actions); level sync | 16/16 pass |
| `tests/solver.test.js` (9) | Fuzz over all 50 expert profiles with random outcomes and 30% random off-policy actions: no unusable recommendation (>1,000 states); completes when the target is met; no exhausted special actions; completes when the target is unreachable; starved states; determinism; time budget; fallback; Good spent on quality; no free actions without a clear gain; regression: never an action that certainly ends the craft | 9/9 pass |
| `tests/ui.test.js` (9) | All four built files in headless Chromium from `file://` with every network request aborted: no errors, no external requests, own data embedded; 8 classes and rank/expert/search filters vs dataset; every recipe in every file builds valid settings at level 100 and at the mission's minimum level; full crafts driven through the real buttons with random conditions, page state equal to an independent engine replay; failure reporting, undo, manual correction (with clamping) and its undo, restart; Stellar Steady Hand charges and Material Miracle timer; next craft carries charges; reload restores the craft; storage blocked (in-memory fallback); phone viewport without horizontal scroll | 9/9 pass in 5 of 6 full runs on the final build. One run failed the next-craft/reload test and did not reproduce in 5 further runs; while investigating, a rare race (a late search result replacing advice after the safety timeout) was found and fixed, and the test now reports diagnostics. |
| Extractor validation | `docs/DATA.md` list | 0 problems, 0 notes |

## 5. Solver evaluation

Method: `tools/evaluate.js`. For every distinct expert scenario (profile × special action × charges; 51 scenarios), 40 simulated crafts per policy and stat tier. All policies face the **same** random conditions and success rolls (common random numbers). Conditions follow the Teamcraft rates unless stated. Success = craft completed **and** quality ≥ target (the top tier for collectables, required quality for intermediates, else max quality).

- **Static rotation:** a fixed macro (best of 300 randomized heuristic rotations planned for all-Normal conditions, Material Miracle pressed after the opener), replayed blindly.
- **Heuristic policy:** the condition-aware rule policy, re-applied each step.
- **Rollout solver:** the shipped engine, capped at 600 rollouts per decision for reproducibility (the app uses a time budget, 500 ms by default, which typically allows several thousand).

Stat tiers (level 100): high 5800/5600/750, specialist, Cosmic tool phase 9+; mid 5200/5000/680, specialist, Cosmic tool; low 4700/4500/620, no specialist, no Cosmic tool.

### Expert recipes, all planets (pooled)

| Group | Scenarios | Crafts per policy | Static rotation | Heuristic policy | Rollout solver | Solver completion | Solver mean steps | First-step estimate (mean) | ms per decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| All, high stats | 51 | 2040 | 31% | 45% | **66%** | 100% | 27.7 | 47% | 26 |
| All, mid stats | 51 | 2040 | 15% | 25% | **43%** | 100% | 27.0 | 27% | 26 |
| sinus-ardorum, high | 20 | 800 | 28% | 48% | **72%** | 100% | 28.0 | 50% | 26 |
| phaenna, high | 17 | 680 | 53% | 54% | **67%** | 100% | 23.8 | 54% | 22 |
| oizys, high | 10 | 400 | 11% | 30% | **49%** | 100% | 30.5 | 32% | 30 |
| auxesia, high | 4 | 160 | 3% | 28% | **82%** | 100% | 35.5 | 39% | 32 |
| sinus-ardorum, mid | 20 | 800 | 9% | 22% | **48%** | 100% | 27.8 | 24% | 26 |
| phaenna, mid | 17 | 680 | 35% | 42% | **53%** | 100% | 23.1 | 44% | 22 |
| oizys, mid | 10 | 400 | 2% | 13% | **25%** | 100% | 28.7 | 13% | 29 |
| auxesia, mid | 4 | 160 | 0% | 3% | **19%** | 100% | 35.5 | 6% | 33 |
| With Stellar Steady Hand | 16 | 640 | 6% | 16% | **34%** | 100% | 30.5 | 18% | 30 |
| With Material Miracle | 44 | 1760 | 14% | 25% | **42%** | 100% | 28.8 | 26% | 28 |
| No special action | 42 | 1680 | 40% | 54% | **75%** | 100% | 24.7 | 56% | 22 |

Solver vs heuristic per scenario: better 68, equal 33, worse 1; clearly better (gap larger than both 95% intervals) 49 of 102. Run time 848 s on 4 cores.

### Model mismatch: crafts follow Craftimizer condition rates, solver plans with Teamcraft rates (Auxesia, high stats)

| Group | Scenarios | Crafts per policy | Static rotation | Heuristic policy | Rollout solver | Solver completion | Solver mean steps | First-step estimate (mean) | ms per decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Auxesia | 7 | 280 | 14% | 40% | **88%** | 100% | 32.8 | 61% | 31 |

### Fast mode (Auxesia, high stats)

| Group | Scenarios | Crafts per policy | Static rotation | Heuristic policy | Rollout solver | Solver completion | Solver mean steps | First-step estimate (mean) | ms per decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Auxesia | 7 | 280 | – | – | **91%** | 100% | 31.5 | 61% | 32 |

### Normal (non-expert) recipes, sample across planets, low stats (4700/4500/620, no specialist, no Cosmic tool)

| Group | Scenarios | Crafts per policy | Static rotation | Heuristic policy | Rollout solver | Solver completion | Solver mean steps | First-step estimate (mean) | ms per decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sample | 24 | 720 | 48% | 56% | **67%** | 93% | 21.9 | 63% | 13 |

Scenario counts per planet: a profile shared by two planets (identical recipe numbers) is evaluated once, under the first planet in data order, so Auxesia shows 4 scenarios although it has 7 expert profiles.

Paired comparisons on the same 7 Auxesia scenarios (high stats): matched condition model 89% vs mismatched 88%; Reliable 89% in 32.3 steps vs Fast 91% in 31.5 steps (Fast saves up to 5 steps when the target is easy, e.g. 29.1 → 24.0).

**Reading the results.** Across the 51 expert scenarios the rollout solver reaches the target in 66% of crafts at high stats and 43% at mid stats, against 45%/25% for the same rules applied step by step and 31%/15% for a fixed rotation; it completes 100% of crafts. Per scenario it is better than the heuristic in 68 of 102 scenario-stat pairs, equal in 33 (mostly targets every policy always or never reaches) and worse in 1 (Sinus Ardorum EX+ "Biofuel I", high stats: 7.5% vs 12.5%, 3 vs 5 hits out of 40, inside both 95% intervals). The gap over the heuristic is largest where special actions and hard targets interact (Auxesia Master missions at high stats: 75–98% vs 18–40%). Planning with the other community condition model costs almost nothing (89% vs 88%), so the uncertainty about condition odds changes recommendations little. The solver's own first-step estimate (47% at high stats) is below the realized 66%: as designed, the displayed chance is conservative, because it assumes simple play after the next step. On normal recipes at low stats the solver reaches 67% vs 56%/48%; completion is 93% because two Sinus Ardorum recipes are deliberate progress challenges (difficulty factor 234 and 198) that no policy can reliably finish with 4,700 Craftsmanship. On one of them the solver now completes 43% of crafts where both baselines complete none; the other (25 durability, 19,800 progress) stays at 0% for every policy at those stats. These are simulations under community condition rates, not in-game measurements.

## 6. Measured performance

- In the app (desktop Chromium on this build machine, Auxesia Master opener): a recommendation in about 0.5–0.6 s with 4,096 simulated crafts; the search runs in a Web Worker, so the page stays responsive, and falls back to the quick heuristic (labelled) if no answer arrives within 4 s.
- The search is time-bounded (Settings: 0.2/0.5/1/2 s). On a slower device the wait stays the same and fewer simulations run. Chromium's CPU throttling does not slow Web Workers, so phone speed could not be emulated here; the batch evaluation above used 600 simulations per decision, roughly what a device 7× slower than this machine completes in the default 0.5 s.
- Batch evaluation: 22–33 ms per decision at 600 simulations (Node, one core).
- File sizes: 435–650 KB per HTML file; ZIP 268 KB.

## 7. Known limitations

1. **Mission score is not optimized directly.** The per-item score is not in the reachable data; the solver maximizes the chance of the chosen quality target per craft and spreads special-action charges evenly over the planned crafts.
2. **Condition probabilities are community estimates.** Two tools disagree; the app offers both. Displayed chances are simulations under the chosen model, and they are conservative because they assume the simple base policy after the next step.
3. **Material Miracle** is modelled as 45 s of real time converted to steps (default 3 s/step), with its six conditions equally likely (assumed). Whether using it consumes a step follows Teamcraft (unverified in game).
4. **Primed + Stellar Steady Hand** is assumed to extend Steady Hand by 2 steps (generic Primed rule); the buff display lets the player correct it.
5. **Tier boundaries** round up to the next collectability point (≤ 10 quality conservative), because sources disagree on the rounding.
6. **No in-game session was possible** from the build environment. Formulas are verified against in-game-recorded sequences from other projects, not against fresh in-game tests.
7. **Established solvers** (Raphael, Teamcraft, Craftimizer) could not be executed in the build environment, so no head-to-head comparison with them was run and no superiority over them is claimed.
8. **Lower levels:** D/C/B missions scale to levels 10–99 using the game's adjust table and level-gated actions; these were checked for valid settings and recommendations, but solver quality was evaluated at level 100 only.


## Appendix: per-scenario results (expert)

| Planet | Profile | Rank | Special | Stats | Target / max | Static | Heuristic | Solver | Solver mean quality |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sinus-ardorum | P023 | A | – | high | 14210 / 20300 | 30% | 98% | 100% | 15484 |
| sinus-ardorum | P023 | A | – | mid | 14210 / 20300 | 0% | 60% | 83% | 14763 |
| sinus-ardorum | P024 | A | MM×1 | high | 14700 / 21000 | 100% | 100% | 100% | 16081 |
| sinus-ardorum | P024 | A | MM×1 | mid | 14700 / 21000 | 100% | 100% | 100% | 16155 |
| sinus-ardorum | P025 | A | – | high | 10500 / 15000 | 100% | 98% | 100% | 11584 |
| sinus-ardorum | P025 | A | – | mid | 10500 / 15000 | 23% | 73% | 93% | 11090 |
| sinus-ardorum | P026 | A | – | high | 10500 / 15000 | 100% | 100% | 100% | 11806 |
| sinus-ardorum | P026 | A | – | mid | 10500 / 15000 | 25% | 80% | 98% | 11520 |
| sinus-ardorum | P027 | A | – | high | 10500 / 15000 | 100% | 100% | 100% | 11872 |
| sinus-ardorum | P027 | A | – | mid | 10500 / 15000 | 23% | 65% | 98% | 11333 |
| sinus-ardorum | P029 | EX | MM×1 | high | 19550 / 23000 | 5% | 80% | 100% | 21269 |
| sinus-ardorum | P029 | EX | MM×1 | mid | 19550 / 23000 | 0% | 20% | 70% | 19237 |
| sinus-ardorum | P030 | EX | MM×1 | high | 18700 / 22000 | 8% | 65% | 100% | 20098 |
| sinus-ardorum | P030 | EX | MM×1 | mid | 18700 / 22000 | 0% | 10% | 70% | 18357 |
| sinus-ardorum | P031 | EX | – | high | 10200 / 12000 | 43% | 63% | 100% | 11457 |
| sinus-ardorum | P031 | EX | – | mid | 10200 / 12000 | 0% | 10% | 68% | 9826 |
| sinus-ardorum | P032 | EX | – | high | 10200 / 12000 | 25% | 57% | 100% | 11469 |
| sinus-ardorum | P032 | EX | – | mid | 10200 / 12000 | 0% | 8% | 33% | 8036 |
| sinus-ardorum | P033 | EX | – | high | 10200 / 12000 | 20% | 40% | 98% | 11224 |
| sinus-ardorum | P033 | EX | – | mid | 10200 / 12000 | 0% | 0% | 43% | 8493 |
| sinus-ardorum | P034 | EX+ | – | high | 14900 / 14900 | 15% | 53% | 100% | 16535 |
| sinus-ardorum | P034 | EX+ | – | mid | 14900 / 14900 | 0% | 13% | 83% | 15460 |
| sinus-ardorum | P034 | EX+ | MM×1 | high | 14900 / 14900 | 18% | 50% | 100% | 16566 |
| sinus-ardorum | P034 | EX+ | MM×1 | mid | 14900 / 14900 | 0% | 10% | 80% | 15401 |
| sinus-ardorum | P035 | EX+ | MM×1 | high | 24000 / 24000 | 0% | 8% | 30% | 20716 |
| sinus-ardorum | P035 | EX+ | MM×1 | mid | 24000 / 24000 | 0% | 0% | 3% | 16539 |
| sinus-ardorum | P036 | EX+ | – | high | 22500 / 22500 | 0% | 3% | 33% | 19457 |
| sinus-ardorum | P036 | EX+ | – | mid | 22500 / 22500 | 0% | 0% | 5% | 16296 |
| sinus-ardorum | P047 | EX+ | MM×1 | high | 18900 / 18900 | 0% | 13% | 8% | 14904 |
| sinus-ardorum | P047 | EX+ | MM×1 | mid | 18900 / 18900 | 0% | 0% | 5% | 13666 |
| sinus-ardorum | P048 | EX+ | MM×1 | high | 24660 / 27400 | 0% | 0% | 13% | 19034 |
| sinus-ardorum | P048 | EX+ | MM×1 | mid | 24660 / 27400 | 0% | 0% | 0% | 11435 |
| sinus-ardorum | P049 | EX+ | MM×1 | high | 18000 / 18000 | 0% | 30% | 73% | 18419 |
| sinus-ardorum | P049 | EX+ | MM×1 | mid | 18000 / 18000 | 0% | 0% | 15% | 13730 |
| sinus-ardorum | P050 | EX+ | MM×1 | high | 24120 / 26800 | 0% | 3% | 15% | 19495 |
| sinus-ardorum | P050 | EX+ | MM×1 | mid | 24120 / 26800 | 0% | 0% | 0% | 13763 |
| sinus-ardorum | P051 | EX+ | MM×1 | high | 19500 / 19500 | 0% | 8% | 68% | 18933 |
| sinus-ardorum | P051 | EX+ | MM×1 | mid | 19500 / 19500 | 0% | 0% | 13% | 15337 |
| sinus-ardorum | P052 | EX+ | MM×1 | high | 29800 / 29800 | 0% | 0% | 0% | 19330 |
| sinus-ardorum | P052 | EX+ | MM×1 | mid | 29800 / 29800 | 0% | 0% | 0% | 14192 |
| phaenna | P078 | A | – | high | 9590 / 13700 | 100% | 100% | 100% | 10543 |
| phaenna | P078 | A | – | mid | 9590 / 13700 | 100% | 100% | 100% | 10599 |
| phaenna | P079 | A | MM×1 | high | 10570 / 15100 | 100% | 100% | 100% | 12684 |
| phaenna | P079 | A | MM×1 | mid | 10570 / 15100 | 100% | 100% | 100% | 11863 |
| phaenna | P080 | A | – | high | 7840 / 11200 | 100% | 100% | 100% | 8626 |
| phaenna | P080 | A | – | mid | 7840 / 11200 | 100% | 100% | 100% | 8739 |
| phaenna | P081 | A | – | high | 7840 / 11200 | 100% | 100% | 100% | 8708 |
| phaenna | P081 | A | – | mid | 7840 / 11200 | 100% | 100% | 100% | 8779 |
| phaenna | P082 | A | – | high | 7840 / 11200 | 100% | 100% | 100% | 8533 |
| phaenna | P082 | A | – | mid | 7840 / 11200 | 100% | 100% | 100% | 8580 |
| phaenna | P084 | EX | – | high | 9860 / 11600 | 100% | 73% | 100% | 11160 |
| phaenna | P084 | EX | – | mid | 9860 / 11600 | 0% | 15% | 70% | 9706 |
| phaenna | P085 | EX | – | high | 9860 / 11600 | 100% | 68% | 100% | 10948 |
| phaenna | P085 | EX | – | mid | 9860 / 11600 | 0% | 15% | 57% | 9021 |
| phaenna | P086 | EX | – | high | 9860 / 11600 | 40% | 60% | 98% | 10777 |
| phaenna | P086 | EX | – | mid | 9860 / 11600 | 0% | 13% | 57% | 8883 |
| phaenna | P089 | EX+ | – | high | 29700 / 29700 | 0% | 0% | 20% | 25464 |
| phaenna | P089 | EX+ | – | mid | 29700 / 29700 | 0% | 0% | 0% | 21929 |
| phaenna | P096 | EX | – | high | 17940 / 21100 | 95% | 100% | 100% | 19504 |
| phaenna | P096 | EX | – | mid | 17940 / 21100 | 23% | 75% | 100% | 19464 |
| phaenna | P097 | EX | MM×1 | high | 12410 / 14600 | 68% | 100% | 100% | 13806 |
| phaenna | P097 | EX | MM×1 | mid | 12410 / 14600 | 80% | 100% | 100% | 14034 |
| phaenna | P099 | EX+ | MM×1 | high | 19500 / 19500 | 0% | 0% | 48% | 17699 |
| phaenna | P099 | EX+ | MM×1 | mid | 19500 / 19500 | 0% | 0% | 8% | 13978 |
| phaenna | P100 | EX+ | MM×1 | high | 25110 / 27900 | 0% | 0% | 5% | 19391 |
| phaenna | P100 | EX+ | MM×1 | mid | 25110 / 27900 | 0% | 0% | 0% | 11669 |
| phaenna | P101 | EX+ | MM×1 | high | 19200 / 19200 | 0% | 15% | 33% | 16510 |
| phaenna | P101 | EX+ | MM×1 | mid | 19200 / 19200 | 0% | 0% | 10% | 14689 |
| phaenna | P102 | EX+ | MM×1 | high | 24840 / 27600 | 0% | 3% | 5% | 18393 |
| phaenna | P102 | EX+ | MM×1 | mid | 24840 / 27600 | 0% | 0% | 0% | 12306 |
| phaenna | P103 | EX+ | MM×1 | high | 23000 / 23000 | 0% | 3% | 25% | 18990 |
| phaenna | P103 | EX+ | MM×1 | mid | 23000 / 23000 | 0% | 0% | 0% | 15131 |
| phaenna | P104 | EX+ | MM×1 | high | 32300 / 32300 | 0% | 0% | 0% | 18926 |
| phaenna | P104 | EX+ | MM×1 | mid | 32300 / 32300 | 0% | 0% | 0% | 13982 |
| oizys | P119 | EX | MM×1 | high | 21000 / 24700 | 25% | 90% | 100% | 22488 |
| oizys | P119 | EX | MM×1 | mid | 21000 / 24700 | 3% | 35% | 85% | 21329 |
| oizys | P120 | EX | SSH×1 | high | 14710 / 17300 | 68% | 100% | 100% | 15907 |
| oizys | P120 | EX | SSH×1 | mid | 14710 / 17300 | 15% | 83% | 98% | 15963 |
| oizys | P121 | EX | – | high | 16580 / 19500 | 20% | 85% | 93% | 17468 |
| oizys | P121 | EX | – | mid | 16580 / 19500 | 0% | 8% | 40% | 14877 |
| oizys | P124 | EX+ | – | high | 24060 / 28300 | 0% | 3% | 20% | 19839 |
| oizys | P124 | EX+ | – | mid | 24060 / 28300 | 0% | 0% | 0% | 16744 |
| oizys | P126 | EX+ | SSH×1 | high | 21000 / 21000 | 0% | 0% | 40% | 19009 |
| oizys | P126 | EX+ | SSH×1 | mid | 21000 / 21000 | 0% | 0% | 5% | 15043 |
| oizys | P127 | EX+ | SSH×1 | high | 23720 / 27900 | 0% | 0% | 3% | 18385 |
| oizys | P127 | EX+ | SSH×1 | mid | 23720 / 27900 | 0% | 0% | 0% | 15925 |
| oizys | P128 | EX+ | SSH×1 | high | 22000 / 22000 | 0% | 8% | 43% | 19635 |
| oizys | P128 | EX+ | SSH×1 | mid | 22000 / 22000 | 0% | 0% | 15% | 17552 |
| oizys | P129 | EX+ | SSH×1 | high | 24740 / 29100 | 0% | 13% | 43% | 22046 |
| oizys | P129 | EX+ | SSH×1 | mid | 24740 / 29100 | 0% | 0% | 5% | 17787 |
| oizys | P130 | EX+ | SSH×1 | high | 23000 / 23000 | 0% | 5% | 48% | 20958 |
| oizys | P130 | EX+ | SSH×1 | mid | 23000 / 23000 | 0% | 0% | 0% | 16279 |
| oizys | P131 | EX+ | SSH×1 | high | 33500 / 33500 | 0% | 0% | 0% | 19080 |
| oizys | P131 | EX+ | SSH×1 | mid | 33500 / 33500 | 0% | 0% | 0% | 14329 |
| auxesia | P134 | EX+ | – | high | 22100 / 26000 | 3% | 20% | 70% | 21899 |
| auxesia | P134 | EX+ | – | mid | 22100 / 26000 | 0% | 0% | 5% | 16507 |
| auxesia | P136 | Master | MM×2 | high | 21340 / 25100 | 0% | 35% | 75% | 21230 |
| auxesia | P136 | Master | MM×2 | mid | 21340 / 25100 | 0% | 3% | 15% | 17344 |
| auxesia | P137 | Master | SSH×4 | high | 18790 / 22100 | 8% | 40% | 98% | 20311 |
| auxesia | P137 | Master | SSH×4 | mid | 18790 / 22100 | 0% | 8% | 43% | 16902 |
| auxesia | P138 | Master | MM×4 | high | 22360 / 26300 | 0% | 18% | 85% | 22777 |
| auxesia | P138 | Master | MM×4 | mid | 22360 / 26300 | 0% | 0% | 13% | 17662 |

Raw data: `validation/*.json` (per scenario: success, 95% interval, completion, mean quality, steps, decision time).
