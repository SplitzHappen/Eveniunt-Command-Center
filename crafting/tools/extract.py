#!/usr/bin/env python3
"""Build the Cosmic Exploration crafting database from datamined game sheets.

Input: a checkout of https://github.com/xivapi/ffxiv-datamining (English CSVs).
Output: data/cosmic-db.json (all planets) and data/actions-verified.json.

Usage: python3 tools/extract.py <path-to-ffxiv-datamining> [--commit <sha>]

Every value written comes from a game sheet column named in SOURCES below.
Columns whose meaning is not documented (EXDSchema "UnknownN") are either
left out or copied raw under a key that says so; they are never interpreted
as scores.
"""
import csv
import json
import os
import re
import sys
from collections import Counter, OrderedDict, defaultdict

JOBS = ["CRP", "BSM", "ARM", "GSM", "LTW", "WVR", "ALC", "CUL"]
JOB_NAMES = ["Carpenter", "Blacksmith", "Armorer", "Goldsmith", "Leatherworker",
             "Weaver", "Alchemist", "Culinarian"]
# Recipe.PatchNumber prefix -> destination. Every crafter mission's recipes
# carry one patch prefix; the planet mapping is checked below for consistency
# with contiguous mission-id blocks.
PLANETS = OrderedDict([
    ("72", {"key": "sinus-ardorum", "name": "Sinus Ardorum", "patch": "7.21"}),
    ("73", {"key": "phaenna", "name": "Phaenna", "patch": "7.31"}),
    ("74", {"key": "oizys", "name": "Oizys", "patch": "7.41"}),
    ("75", {"key": "auxesia", "name": "Auxesia", "patch": "7.51"}),
])
# Mission minimum level by LevelGroup. Source: ICE plugin
# (LeontopodiumNivale14/Ices-Cosmic-Exploration, ICEDictornaryCreation.cs) and
# consistent with the recipe data: groups 1-3 are level-synced recipes
# (MaxAdjustableJobLevel=100); groups 4-6 use level-100 recipe levels.
MIN_LEVEL = {1: 10, 2: 50, 3: 90, 4: 100, 5: 100, 6: 100}
RANK = {1: "D", 2: "C", 3: "B", 4: "A", 5: "EX", 6: "EX+"}
TEMP_ACTIONS = {41269: "MaterialMiracle", 46843: "StellarSteadyHand"}
CONDITION_BITS = ["Normal", "Good", "Excellent", "Poor", "Centered", "Sturdy",
                  "Pliant", "Malleable", "Primed", "GoodOmen", "Robust"]
SOURCES = {
    "WKSMissionUnit": "Name, SilverStarRequirement, GoldStarRequirement, ClassJobCategory, MissionTime, MissionToDo[0..2], WKSMissionSupplyItem, WKSMissionRecipe, LevelGroup, IsSynced, IsSpecialQuest, LockedBehind, WKSMissionText",
    "WKSMissionToDo": "TemporaryAction, TemporaryActionCount, BronzeScore, RequiredItem[0..2], RequiredItemQuantity[0..2], WKSMissionText, MissionType, Unknown15 (objective kind, interpreted only by correlation checks below)",
    "WKSMissionRecipe": "Recipe[0..4]",
    "WKSMissionSupplyItem": "Item[0..2], ItemCount[0..2]",
    "WKSItemInfo": "Item",
    "WKSMissionText": "Text",
    "WKSMissionToDoEvalutionRefin": "LowPercent, MidPercent, HighPercent (joined via Recipe.CollectableMetadataKey==7 -> Recipe.CollectableMetadata; same join as Craftimizer RecipeData.cs and Artisan Crafting.cs)",
    "Recipe": "CraftType, ItemResult, RecipeLevelTable, MaxAdjustableJobLevel, DifficultyFactor, QualityFactor, DurabilityFactor, RequiredQuality, RequiredCraftsmanship, RequiredControl, CollectableMetadataKey, CollectableMetadata, PatchNumber, IsExpert, CanHq, Ingredient[0..7], AmountIngredient[0..7]",
    "RecipeLevelTable": "Quality, Difficulty, Durability, ConditionsFlag, ClassJobLevel, Stars, ProgressDivider, QualityDivider, ProgressModifier, QualityModifier",
    "GathererCrafterLvAdjustTable": "RecipeLevel",
    "Item": "Name",
    "CraftAction / Action": "Name, ClassJobLevel, Cost / PrimaryCostValue (action verification only)",
}


def load(root, name):
    path = os.path.join(root, "csv", "en", name + ".csv")
    with open(path, encoding="utf-8") as f:
        rows = list(csv.reader(f))
    header = rows[0]
    out = {}
    for r in rows[1:]:
        if not r or not re.fullmatch(r"-?\d+", r[0]):
            continue
        out[int(r[0])] = dict(zip(header, r))
    return out


def clean_name(s):
    # Mission names may begin with a private-use glyph (the in-game level-sync
    # icon). Strip private-use code points and surrounding whitespace.
    return re.sub(r"[-]", "", s).strip()


def i(v):
    return int(v) if v not in ("", None) else 0


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    root = sys.argv[1]
    commit = None
    if "--commit" in sys.argv:
        commit = sys.argv[sys.argv.index("--commit") + 1]
    here = os.path.dirname(os.path.abspath(__file__))
    out_dir = os.path.join(here, "..", "data")

    mu = load(root, "WKSMissionUnit")
    td = load(root, "WKSMissionToDo")
    mr = load(root, "WKSMissionRecipe")
    msi = load(root, "WKSMissionSupplyItem")
    wii = load(root, "WKSItemInfo")
    mtext = load(root, "WKSMissionText")
    refin = load(root, "WKSMissionToDoEvalutionRefin")
    rec = load(root, "Recipe")
    rlt = load(root, "RecipeLevelTable")
    adj = load(root, "GathererCrafterLvAdjustTable")
    items = load(root, "Item")
    cja = load(root, "CraftAction")
    act = load(root, "Action")

    problems = []   # validation findings (fatal)
    notes = []      # informational findings

    def item_name(item_id):
        return items.get(item_id, {}).get("Name", "") or f"Item {item_id}"

    # ---- recipes -------------------------------------------------------
    recipes = {}
    used_rlvls = set()

    def recipe_entry(rid):
        if rid in recipes:
            return recipes[rid]
        R = rec.get(rid)
        if R is None:
            problems.append(f"recipe {rid} referenced by a mission is missing from Recipe")
            return None
        rl = i(R["RecipeLevelTable"])
        L = rlt.get(rl)
        if L is None:
            problems.append(f"recipe {rid}: RecipeLevelTable {rl} missing")
            return None
        used_rlvls.add(rl)
        craft_type = i(R["CraftType"])
        q = i(L["Quality"]) * i(R["QualityFactor"]) // 100
        prog = i(L["Difficulty"]) * i(R["DifficultyFactor"]) // 100
        dur = i(L["Durability"]) * i(R["DurabilityFactor"]) // 100
        thresholds = None
        pct = None
        if R["CollectableMetadataKey"] == "7":
            row = refin.get(i(R["CollectableMetadata"]))
            if row is None:
                problems.append(f"recipe {rid}: Refin row {R['CollectableMetadata']} missing")
            else:
                pct = [i(row["LowPercent"]), i(row["MidPercent"]), i(row["HighPercent"])]
                # Quality needed for each tier: collectability = floor(quality/10).
                # Artisan and Craftimizer floor maxQuality*pct/1000; a wiki value
                # quoted by a third party (1955 for 2300 x 85%) suggests no
                # rounding. We round UP to the next collectability point, which
                # can only overshoot the true threshold by <= 10 quality.
                thresholds = [-(-(q * p) // 1000) * 10 for p in pct]
        e = OrderedDict([
            ("id", rid),
            ("itemId", i(R["ItemResult"])),
            ("name", item_name(i(R["ItemResult"]))),
            ("job", craft_type),
            ("rlvl", rl),
            ("level", i(L["ClassJobLevel"])),
            ("stars", i(L["Stars"])),
            ("expert", R["IsExpert"] == "True"),
            ("canHq", R["CanHq"] == "True"),
            ("progress", prog),
            ("quality", q),
            ("durability", dur),
            ("difficultyFactor", i(R["DifficultyFactor"])),
            ("qualityFactor", i(R["QualityFactor"])),
            ("durabilityFactor", i(R["DurabilityFactor"])),
            ("conditionsFlag", i(L["ConditionsFlag"])),
            ("requiredQuality", i(R["RequiredQuality"])),
            ("requiredCraftsmanship", i(R["RequiredCraftsmanship"])),
            ("requiredControl", i(R["RequiredControl"])),
            ("maxLevelScaling", i(R["MaxAdjustableJobLevel"])),
            ("collectable", thresholds is not None),
            ("tierPct", pct),
            ("tiers", thresholds),
            ("patch", R["PatchNumber"]),
            ("ingredients", [
                {"item": i(R[f"Ingredient[{k}]"]), "amount": i(R[f"AmountIngredient[{k}]"])}
                for k in range(8) if i(R[f"Ingredient[{k}]"]) > 0 and i(R[f"AmountIngredient[{k}]"]) > 0
            ]),
        ])
        if craft_type < 0 or craft_type > 7:
            problems.append(f"recipe {rid}: CraftType {craft_type} out of range")
        recipes[rid] = e
        return e

    # ---- missions -------------------------------------------------------
    missions = []
    for mid, r in mu.items():
        if mid == 0:
            continue
        cats = [i(r["ClassJobCategory[0]"]), i(r["ClassJobCategory[1]"])]
        jobs = [c - 9 for c in cats if 9 <= c <= 16]
        mrow = mr.get(i(r["WKSMissionRecipe"]))
        rids = [i(mrow[f"Recipe[{k}]"]) for k in range(5)] if mrow else []
        rids = [x for x in rids if x > 0]
        if not jobs:
            if rids:
                problems.append(f"mission {mid}: has recipes but no crafter class")
            continue  # gathering/fishing mission: out of scope
        if len(jobs) != 1:
            problems.append(f"mission {mid}: {len(jobs)} crafter classes")
            continue
        if not rids:
            problems.append(f"mission {mid}: crafter mission without recipes")
            continue
        recs = [recipe_entry(x) for x in rids]
        if any(x is None for x in recs):
            continue
        patches = {x["patch"][:2] for x in recs}
        if len(patches) != 1 or next(iter(patches)) not in PLANETS:
            problems.append(f"mission {mid}: ambiguous planet from recipe patches {patches}")
            continue
        planet = PLANETS[next(iter(patches))]["key"]
        for x in recs:
            if x["job"] != jobs[0]:
                problems.append(f"mission {mid}: recipe {x['id']} job {x['job']} != mission job {jobs[0]}")
        lg = i(r["LevelGroup"])
        name = clean_name(r["Name"])
        rank = RANK.get(lg, "?")
        if lg == 6 and name.startswith("Master:"):
            rank = "Master"
        elif lg == 6 and not name.startswith("EX+:"):
            notes.append(f"mission {mid} '{name}': level group 6 without EX+/Master prefix")
        objectives = []
        for k in range(3):
            t = i(r[f"MissionToDo[{k}]"])
            if not t:
                continue
            T = td.get(t)
            if T is None:
                problems.append(f"mission {mid}: MissionToDo {t} missing")
                continue
            req = []
            for j in range(3):
                info = i(T[f"RequiredItem[{j}]"])
                qty = i(T[f"RequiredItemQuantity[{j}]"])
                if info:
                    it = i(wii.get(info, {}).get("Item", 0))
                    if not it:
                        problems.append(f"mission {mid}: WKSItemInfo {info} missing")
                    req.append({"item": it, "name": item_name(it), "quantity": qty})
            ta = i(T["TemporaryAction"])
            kind_raw = i(T["Unknown15"])
            bronze = i(T["BronzeScore"])
            kind = {3: "craft", 4: "score", 5: "deliver"}.get(kind_raw, f"unknown-{kind_raw}")
            # Correlation checks that justify the interpretation of Unknown15.
            if kind == "craft" and not req:
                problems.append(f"mission {mid} todo {t}: kind 3 without required items")
            if kind == "score" and req:
                notes.append(f"mission {mid} todo {t}: score objective also lists items")
            if kind == "deliver" and i(T["MissionType"]) != 10:
                notes.append(f"mission {mid} todo {t}: delivery objective with MissionType {T['MissionType']}")
            if ta and ta not in TEMP_ACTIONS:
                problems.append(f"mission {mid}: unknown temporary action {ta}")
            objectives.append(OrderedDict([
                ("todo", t),
                ("kind", kind),
                ("text", mtext.get(i(T["WKSMissionText"]), {}).get("Text", "")),
                ("items", req),
                ("bronzeScore", bronze or None),
                ("specialAction", TEMP_ACTIONS.get(ta)),
                ("specialActionCharges", i(T["TemporaryActionCount"]) if ta else 0),
                # Raw, undocumented column (100/150/200 on Master phases). Not interpreted.
                ("rawUnknown18", i(T["Unknown18"])),
            ]))
        supply = []
        srow = msi.get(i(r["WKSMissionSupplyItem"]))
        if srow:
            for j in range(3):
                it = i(srow[f"Item[{j}]"])
                if it:
                    supply.append({"item": it, "name": item_name(it), "count": i(srow[f"ItemCount[{j}]"])})
        missions.append(OrderedDict([
            ("id", mid),
            ("planet", planet),
            ("name", name),
            ("job", jobs[0]),
            ("rank", rank),
            ("levelGroup", lg),
            ("minLevel", MIN_LEVEL.get(lg)),
            ("synced", r["IsSynced"] == "1"),
            ("critical", r["IsSpecialQuest"] == "True"),
            ("timeLimitSec", i(r["MissionTime"])),
            ("silver", i(r["SilverStarRequirement"])),
            ("gold", i(r["GoldStarRequirement"])),
            ("text", mtext.get(i(r["WKSMissionText"]), {}).get("Text", "")),
            ("previousMission", i(r["LockedBehind"]) or None),
            ("objectives", objectives),
            ("recipes", rids),
            ("supply", supply),
        ]))

    # ---- profiles (equivalence groups) ----------------------------------
    # Two recipes share a profile only if every number the simulator and the
    # target logic use is identical: recipe level row, progress, quality,
    # durability, conditions, expert flag, required quality, required stats,
    # level scaling and tier percentages. Mission and item names stay apart.
    prof_index = {}
    profiles = OrderedDict()
    for rid in sorted(recipes):
        e = recipes[rid]
        key = (e["rlvl"], e["progress"], e["quality"], e["durability"], e["conditionsFlag"],
               e["expert"], e["requiredQuality"], e["requiredCraftsmanship"],
               e["requiredControl"], e["maxLevelScaling"],
               tuple(e["tierPct"]) if e["tierPct"] else None,
               e["difficultyFactor"], e["qualityFactor"], e["durabilityFactor"])
        if key not in prof_index:
            pid = f"P{len(prof_index) + 1:03d}"
            prof_index[key] = pid
            L = rlt[e["rlvl"]]
            profiles[pid] = OrderedDict([
                ("id", pid),
                ("rlvl", e["rlvl"]),
                ("level", e["level"]),
                ("stars", e["stars"]),
                ("expert", e["expert"]),
                ("progress", e["progress"]),
                ("quality", e["quality"]),
                ("durability", e["durability"]),
                ("difficultyFactor", e["difficultyFactor"]),
                ("qualityFactor", e["qualityFactor"]),
                ("durabilityFactor", e["durabilityFactor"]),
                ("conditionsFlag", e["conditionsFlag"]),
                ("conditions", [CONDITION_BITS[b] for b in range(len(CONDITION_BITS)) if e["conditionsFlag"] >> b & 1]),
                ("progressDivider", i(L["ProgressDivider"])),
                ("qualityDivider", i(L["QualityDivider"])),
                ("progressModifier", i(L["ProgressModifier"])),
                ("qualityModifier", i(L["QualityModifier"])),
                ("requiredQuality", e["requiredQuality"]),
                ("requiredCraftsmanship", e["requiredCraftsmanship"]),
                ("requiredControl", e["requiredControl"]),
                ("maxLevelScaling", e["maxLevelScaling"]),
                ("tierPct", e["tierPct"]),
                ("tiers", e["tiers"]),
                ("recipeCount", 0),
                ("jobs", []),
            ])
        pid = prof_index[key]
        e["profile"] = pid
        profiles[pid]["recipeCount"] += 1
        if e["job"] not in profiles[pid]["jobs"]:
            profiles[pid]["jobs"].append(e["job"])
        if e["conditionsFlag"] >> 11:
            problems.append(f"recipe {rid}: unknown condition bits in flag {e['conditionsFlag']}")

    # ---- level sync tables ------------------------------------------------
    adjust = {lv: i(adj[lv]["RecipeLevel"]) for lv in range(1, 101) if lv in adj}
    if len(adjust) != 100:
        problems.append("GathererCrafterLvAdjustTable incomplete for levels 1-100")
    sync_rlvls = sorted(set(adjust.values()))
    rlvl_rows = OrderedDict()
    for rl in sorted(set(sync_rlvls) | used_rlvls):
        L = rlt[rl]
        rlvl_rows[rl] = OrderedDict([(k, i(L[k])) for k in [
            "ClassJobLevel", "Stars", "Difficulty", "Quality", "Durability", "ConditionsFlag",
            "ProgressDivider", "QualityDivider", "ProgressModifier", "QualityModifier"]])

    # ---- validation -------------------------------------------------------
    ids = [m["id"] for m in missions]
    if len(ids) != len(set(ids)):
        problems.append("duplicate mission ids")
    per_planet = Counter(m["planet"] for m in missions)
    for pkey in [p["key"] for p in PLANETS.values()]:
        ms = sorted(m["id"] for m in missions if m["planet"] == pkey)
        # contiguity check: planet blocks must not interleave
        others = [m["id"] for m in missions if m["planet"] != pkey and ms and ms[0] <= m["id"] <= ms[-1]]
        if others:
            problems.append(f"planet {pkey}: mission id block interleaves with other planets {others[:5]}")
        jobs = Counter(m["job"] for m in missions if m["planet"] == pkey)
        if set(jobs) != set(range(8)):
            problems.append(f"planet {pkey}: missing classes {set(range(8)) - set(jobs)}")
        if len(set(jobs.values())) != 1:
            notes.append(f"planet {pkey}: uneven missions per class {dict(jobs)}")
    for m in missions:
        if not m["objectives"]:
            problems.append(f"mission {m['id']}: no objectives")
        if m["rank"] != "Master" and not m["critical"] and (m["silver"] <= 0 or m["gold"] <= 0):
            notes.append(f"mission {m['id']} '{m['name']}': no silver/gold requirement in data")
        for o in m["objectives"]:
            if o["kind"].startswith("unknown"):
                problems.append(f"mission {m['id']}: unknown objective kind {o['kind']}")

    db = OrderedDict([
        ("schema", 1),
        ("generated_from", OrderedDict([
            ("repository", "https://github.com/xivapi/ffxiv-datamining"),
            ("commit", commit),
            ("sheets", SOURCES),
        ])),
        ("planets", [dict(v) for v in PLANETS.values()]),
        ("jobs", JOBS),
        ("jobNames", JOB_NAMES),
        ("missions", missions),
        ("recipes", OrderedDict((str(k), recipes[k]) for k in sorted(recipes))),
        ("profiles", profiles),
        ("levelAdjust", adjust),
        ("recipeLevels", OrderedDict((str(k), v) for k, v in rlvl_rows.items())),
        ("validation", OrderedDict([
            ("problems", problems),
            ("notes", notes),
            ("missionsPerPlanet", dict(per_planet)),
            ("recipes", len(recipes)),
            ("profiles", len(profiles)),
            ("expertProfiles", sum(1 for p in profiles.values() if p["expert"])),
        ])),
    ])
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "cosmic-db.json"), "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=1)

    # ---- action verification table ----------------------------------------
    verified = OrderedDict()
    for aid, a in cja.items():
        if a.get("ClassJob") == "8" and a.get("Name"):
            verified[a["Name"]] = {"source": "CraftAction", "id": aid,
                                   "level": i(a["ClassJobLevel"]), "cp": i(a["Cost"])}
    for aid in [260, 4574, 4631, 4639, 19004, 19012, 19297, 41269, 46843]:
        a = act[aid]
        verified[a["Name"]] = {"source": "Action", "id": aid,
                               "level": i(a["ClassJobLevel"]), "cp": i(a["PrimaryCostValue"]),
                               "primaryCostType": i(a["PrimaryCostType"])}
    with open(os.path.join(out_dir, "actions-verified.json"), "w", encoding="utf-8") as f:
        json.dump(verified, f, ensure_ascii=False, indent=1)

    print(json.dumps(db["validation"], indent=1)[:3000])
    if problems:
        print(f"{len(problems)} PROBLEMS", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
