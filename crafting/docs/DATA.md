# Recipe and mission database

File: `data/cosmic-db.json` (generated, do not edit by hand). Generator: `tools/extract.py`, run against a checkout of `xivapi/ffxiv-datamining` at commit `44948e4cda5846eab0baa9872122a888fcc4f1b1` ("7.57h1", 2026-10-20).

```
git clone --filter=blob:none --no-checkout https://github.com/xivapi/ffxiv-datamining dm
cd dm && git sparse-checkout set 'csv/en/WKS*' 'csv/en/Recipe.csv' 'csv/en/RecipeLevelTable.csv' \
  'csv/en/CraftAction.csv' 'csv/en/Action.csv' 'csv/en/Item.csv' 'csv/en/GathererCrafterLvAdjustTable.csv' && git checkout
python3 tools/extract.py <path-to-dm> --commit <sha>
```

## Coverage

All crafter missions in the game data at that commit. Gathering and fishing missions are excluded by design.

| Planet (patch) | Missions | D | C | B | A | EX | EX+ | Master | Critical | Timed | Multi-recipe | Recipes | Expert recipes | Numeric profiles | Expert profiles |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sinus Ardorum (7.21) | 400 | 72 | 56 | 64 | 64 | 72 | 72 | 0 | 24 | 224 | 104 | 520 | 160 | 55 | 19 |
| Phaenna (7.31) | 360 | 72 | 56 | 64 | 64 | 56 | 48 | 0 | 24 | 80 | 104 | 480 | 136 | 50 | 17 |
| Oizys (7.41) | 240 | 48 | 32 | 40 | 48 | 32 | 40 | 0 | 16 | 64 | 64 | 304 | 80 | 36 | 10 |
| Auxesia (7.51) | 240 | 48 | 32 | 40 | 48 | 24 | 24 | 24 | 16 | 72 | 40 | 280 | 56 | 33 | 7 |
| **Total** | **1,240** | | | | | | | | | | | **1,584** | | **138** (unique) | **50** (unique) |

Every class has the same number of missions on each planet (e.g. 30 per class on Auxesia).

**How planets are assigned:** each crafter mission's recipes carry one `Recipe.PatchNumber` prefix (72x, 73x, 74x, 75x). The extractor checks that each planet's missions form one contiguous id block that does not interleave with another planet (ids 1–535, 545–1039, 1040–1369, 1370–1703, with gathering missions between).

## Fields

Per mission: id, planet, name, class, rank (from `LevelGroup`: 1 D, 2 C, 3 B, 4 A, 5 EX, 6 EX+ or Master by name prefix), minimum level (10/50/90/100), level-synced flag, critical flag (`IsSpecialQuest`), time limit, silver and gold score thresholds, mission text, previous mission (chains), objectives, recipe ids and supplied materials.

Per objective (`WKSMissionToDo`): kind (craft N items / reach a score / deliver), required items and quantities, bronze score, special action (Material Miracle or Stellar Steady Hand) and its charge count, objective text. The kind comes from an undocumented column (`Unknown15`: 3, 4, 5); the extractor checks the interpretation by correlation (kind 3 always lists required items; kind 5 always has `MissionType` 10, the delivery step). A second undocumented column (`Unknown18`: 100/150/200 on Master phases) is copied raw and not interpreted.

Per recipe: result item, class, recipe level row, level, stars, expert flag, max progress, max quality, max durability (row × factor / 100, as Teamcraft and Raphael compute), condition flags, required quality, level-scaling cap, quality tiers for collectables (see `docs/MECHANICS.md`).

## Equivalence profiles

Recipes are grouped into a profile only when every number the simulator and the target logic use is identical: recipe level row (which fixes dividers, modifiers and condition set), progress, quality, durability, all three factors, expert flag, required quality/stats, level-scaling cap and tier percentages. Mission names, item names and scoring stay per mission.

Result: 1,584 recipes → 138 profiles. Every profile is shared by all 8 classes (the eight class versions of a mission are numerically identical), and some profiles also recur across ranks and planets. Expert profiles: 50, spanning 17 distinct condition sets.

## Validation performed by the extractor

The run fails if any of these occur; the shipped database has **0 problems and 0 notes**:

- missing recipe, recipe-level row, to-do row, item-info row or quality-tier row;
- duplicate mission ids; a mission with zero or several crafter classes; recipe class ≠ mission class;
- a mission whose recipes span several patches; planet blocks that interleave;
- a planet missing any of the 8 classes; uneven missions per class (note);
- unknown objective kind or unknown special action; objective kinds that contradict their correlation checks;
- condition flags with unknown bits;
- a non-Master, non-critical mission without silver/gold thresholds (note).

Independent cross-checks: Raphael's own extraction of the same sheets lists 1,240 crafter missions with the same Stellar Steady Hand charge rule; the quality-tier join is the one used by Craftimizer and Artisan.

## What the data does not contain

- The score each crafted item earns (only thresholds are present). The app does not invent it.
- Real-time behaviour of Material Miracle beyond its 45 s duration text.
- Condition probabilities (no game sheet holds them).
