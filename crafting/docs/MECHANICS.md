# Crafting mechanics specification

Status of each rule: **Verified** (game data, or reproduces in-game-recorded values), **Corroborated** (two or more independent open-source simulators agree, no in-game record found), **Assumed** (no reachable source settles it; the app labels it and lets the player correct it).

Engine: `src/engine/sim.js`. Tests: `tests/sim.test.js` (16 tests).

## Sources

| Source | Used for | Licence |
| --- | --- | --- |
| `xivapi/ffxiv-datamining`, commit `44948e4c` ("7.57h1", 2026-10-20) | Recipes, recipe levels, missions, objectives, quality tiers, special-action charges, action CP/levels, item and status texts | Game data |
| `xivdev/EXDSchema` (branch `latest`, 2026-10-17) | Column names of the Cosmic Exploration sheets | MIT |
| Raphael simulator (`KonaeAkira/raphael-rs`, 2026-10-18) | Integer formulas, action order, in-game-verified test sequences, Stellar Steady Hand step behaviour, level-sync rule | Apache-2.0 |
| Teamcraft simulator (`ffxiv-teamcraft/simulator`, 2026-04-29) | Expert conditions incl. Robust, Material Miracle, Stellar Steady Hand, condition rates; in-game values recorded in its test comments | MIT |
| Craftimizer (`WorkingRobot/Craftimizer`, 2026-06-09) | Second independent condition model, action limits (Careful Observation 3 uses, Quick Innovation), Cosmic tier join | MIT |
| Artisan (`PunishXIV/Artisan`, 2026-10-31) | Cosmic quality-tier join and rounding | (read only) |
| ICE plugin (`LeontopodiumNivale14/Ices-Cosmic-Exploration`) | Mission minimum levels by rank | (read only) |

No code was copied from these projects; behaviour was re-implemented and tested. The community wiki, Icy Veins, Thiria and the Lodestone could not be reached from the build environment (network policy), so they were not used.

## Base values — Verified

```
baseProgress = trunc( f32( f32(craftsmanship*10 / progressDivider) + 2 ) [* progressModifier/100] )
baseQuality  = trunc( f32( f32(control*10 / qualityDivider) + 35 ) [* qualityModifier/100] )
```
Modifiers apply when crafter level ≤ the recipe level row's `ClassJobLevel`. Each operation is rounded to 32-bit float (as Raphael does). Double precision gives 288 instead of 289 for the Teamcraft test case (rlvl 710, 5255 control); the f32 sequence reproduces the in-game Preparatory Touch values 693, 1213, 1387, 1560 and Byregot's Blessing 2601 recorded in Teamcraft's test comments.

## Progress and quality — Verified

```
progress += floor(baseProgress * potency * (10 + 10*MuscleMemory + 5*Veneration) * cond / 2000)   cond: Malleable 3, else 2
quality  += floor(baseQuality * potency * (10 + IQ) * (10 + 10*GreatStrides + 5*Innovation) * q / 40000)
            q: Normal 4, Good 6 (7 with a phase-9+ Cosmic tool), Excellent 16, Poor 2
```
Byregot's Blessing potency = 100 + 20 × Inner Quiet. Reproduces three Raphael sequences marked "verified in-game" (patches 7.0 and 7.1) exactly, step by step.

**Cosmic tool:** item texts of Cosmic tools from *Phase 9* (`Cosmic Saw`, item 45679) through *Saw of Stars* read "Increases to quality are 1.75 times higher than normal when material condition is Good." Phases 1–8 have no such line. The app exposes this as a checkbox.

## Action table — Verified (CP, level) / Corroborated (potency, durability, effects)

CP costs and level requirements are checked against the `CraftAction`/`Action` sheets by a test (35 actions; Daring Touch, level 96 and 0 CP, has a class-neutral sheet row and was checked by hand). Potencies and level traits: Basic Synthesis 120 (Lv31+), Careful Synthesis 180 (Lv82+), Groundwork 360 (Lv86+, halved if durability is below its cost), Rapid Synthesis 500 (Lv63+), Delicate Synthesis progress 150 (Lv94+), Hasty Touch grants Expedience on success (Lv96+). Combos: Basic→Standard Touch 18 CP; Standard (combo)→Advanced Touch 18 CP; Observe→Advanced Touch 18 CP; Basic→Refined Touch +1 extra Inner Quiet. Preparatory Touch, Precise Touch and Reflect give 2 Inner Quiet. Trained Eye is excluded (Cosmic recipes are never 10+ levels below the crafter). Specialist actions: Careful Observation (3 per craft), Heart and Soul (1), Quick Innovation (1, not while Innovation is active).

## Order of operations — Corroborated (Raphael, Teamcraft, Craftimizer agree)

1. Success roll (rate +25 under Centered; 100 under Stellar Steady Hand).
2. On success: progress/quality gains using the buffs active *before* the action; Great Strides consumed by a successful quality action, Muscle Memory by a successful progress action; Final Appraisal clamps progress to max−1 once.
3. CP spent (Pliant: ceil(cost/2)); durability spent (Waste Not and Sturdy/Robust each halve, ceil; Trained Perfection makes it 0 and is consumed) — **also on failure**.
4. Progress ≥ max → success; else durability ≤ 0 → failure (Manipulation cannot rescue 0).
5. Step actions only: Manipulation +5 durability (not on the turn it is cast or recast), then every existing duration −1.
6. New effects are applied after the tick, so a 4-step buff covers the next 4 steps. Primed adds 2 to the next buff applied (including Stellar Steady Hand — **Assumed**, follows the generic rule of both simulators).
7. Failed actions: CP and durability spent, buffs tick, no Inner Quiet, Great Strides kept, no Expedience.

Non-step actions (Final Appraisal, Heart and Soul, Quick Innovation, Careful Observation) do not tick buffs; Careful Observation re-rolls the condition.

## Conditions

| Condition | Effect | Status |
| --- | --- | --- |
| Good | quality ×1.5 (×1.75 Cosmic tool); enables Precise Touch, Intensive Synthesis, Tricks of the Trade | Verified |
| Excellent / Poor | ×4 / ×0.5 quality; Excellent → Poor next | Corroborated (normal recipes only) |
| Centered | success +25% | Corroborated |
| Sturdy | durability cost halved | Corroborated |
| Pliant | CP cost halved (ceil) | Corroborated |
| Malleable | progress ×1.5 | Corroborated |
| Primed | next buff +2 steps | Corroborated |
| Good Omen | next condition Good | Corroborated |
| Robust | durability halved; next condition Sturdy | Corroborated (Teamcraft, Craftimizer) |

Which conditions a recipe can show comes from `RecipeLevelTable.ConditionsFlag` (bit = condition index): **Verified** per recipe.

**Probabilities — Assumed.** Two community tools disagree (Teamcraft: Pliant 12%, Malleable 12%, Primed 12%, Good Omen 10%, normal-recipe Good 25%; Craftimizer: 10%, 13%, 15%, 12%, 15%; Craftimizer also forces Normal after Good/Poor). The app ships both models (default Teamcraft), labels every simulated chance as model-based, and the validation measures the effect of planning with the wrong model.

## Cosmic Exploration special actions

| Action | Data | Behaviour in the engine | Status |
| --- | --- | --- | --- |
| Stellar Steady Hand (Action 46843, status 4839) | "Guarantees action success for the next three steps. Available only when crafting for cosmic exploration." Charges per mission objective (`WKSMissionToDo.TemporaryActionCount`, 1–4). | Step action, 0 CP, spends a charge, success = 100% for the next 3 steps. | Text verified; step behaviour corroborated (Raphael, Teamcraft) |
| Material Miracle (Action 41269, status 4220) | "Guarantees a Good, Sturdy, Centered, Pliant, Primed, or Malleable material condition each step. Duration: 45s." Charges 1–4. | Step action (Teamcraft), 0 CP, spends a charge. While active, the next condition is one of the six, **assumed equally likely**. The 45 s are real time: the app runs a countdown and converts remaining seconds into remaining steps (default 3 s per step, adjustable). | Text verified; distribution and step behaviour assumed |

Charges are treated as a mission-wide pool: by default a craft may use ceil(remaining charges / remaining crafts). The player can edit both numbers.

## Quality tiers and mission scoring

- Collectable Cosmic recipes (`Recipe.CollectableMetadataKey = 7`) link to `WKSMissionToDoEvalutionRefin` (Low/Mid/High percent). **Verified** join (Craftimizer and Artisan use it). Rounding at the boundary is **not settled**: both plugins use floor(maxQuality × pct / 1000) × 10, while a wiki value quoted by a third party (1955 for 2300 × 85%) implies no rounding. The app uses ceil(maxQuality × pct / 1000) × 10, which never undershoots and overshoots by at most 10 quality.
- Mission bronze/silver/gold thresholds (`BronzeScore`, `SilverStarRequirement`, `GoldStarRequirement`) are shown as data.
- **The score an individual crafted item earns is not in the reachable data.** A community guide claims bands of 100/300/700/1000; it could not be confirmed. The solver therefore optimizes the probability of reaching the player-chosen quality target (default: top tier, required quality for intermediates, or max quality for non-collectables), not mission score.

## Level sync — Verified (data) / Corroborated (durability rule)

Rank D/C/B missions (minimum level 10/50/90) use recipes with `MaxAdjustableJobLevel = 100`. Below level 100 the recipe level becomes `GathererCrafterLvAdjustTable[level].RecipeLevel`; progress and quality use that row with the recipe's factors and durability base 80 (Raphael). Ranks A, EX, EX+ and Master require level 100 and the app refuses lower levels.

## Explicit non-goals

No game-memory reading, no input automation, no macro execution. Gathering and fishing missions are excluded.
