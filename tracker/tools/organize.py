#!/usr/bin/env python3
"""Organise the tracker's lists by expansion (run after tools/add-checklist.py, before tools/links.py).

  python3 -I tools/organize.py <ffxiv-datamining checkout>

1. Quests the game keeps outside the journal go where they belong: "So You Want to Be a ..." into that class's group
   of the class and job quest lists, the rest (levequest, sightseeing, flying, Eureka and other unlocks) into Other
   Quests, group "Feature Unlocks".
2. Big lists become one list per expansion, in a folder of their own: Main Scenario, Sidequests, Allied Society
   Quests, Levequests, FATEs, The Hunt.
3. Every other list gets an expansion layer above its groups (each group carries "xp", the expansion it belongs to)
   when its entries span more than one expansion. Duties are placed by their release patch, not by the map they use
   (the Palace of the Dead is Heavensward content on an older map).

An entry that changes list keeps its old list in "mv", so ticks saved under the old key move over on load
(ET.migrateAliases); tools/check-keys.js treats them as moved. The expansion of an entry comes from the game's own
Quest.Expansion for quests, the release patch (2.x A Realm Reborn ... 7.x Dawntrail) for everything that has one,
then the map (TerritoryType.ExVersion) a group is named after.
"""
import collections, csv, json, os, re, sys

DM = sys.argv[1] if len(sys.argv) > 1 else sys.exit(__doc__)
T = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA = os.path.join(T, "data", "tracker-data.json")
data = json.load(open(DATA, encoding="utf-8"))
EXP = data["meta"]["expansions"]  # A Realm Reborn ... Dawntrail (game order)
ABBR = ["arr", "hw", "sb", "shb", "ew", "dt"]

def sheet(name):
    with open(os.path.join(DM, "csv", "en", name + ".csv"), encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    return {int(r[0]): dict(zip(rows[0], r)) for r in rows[1:] if r and r[0].isdigit()}
def i(v):
    try: return int(v)
    except (TypeError, ValueError): return 0
clean = lambda s: " ".join((s or "").split())
norm = lambda s: re.sub(r"[^a-z0-9]+", "", str(s or "").lower().replace("’", "'"))

QUEST_EX = {k: i(r.get("Expansion")) for k, r in sheet("Quest").items()}
place = sheet("PlaceName")
ZONE_EX = {}
for r in sheet("TerritoryType").values():
    n = norm(place.get(i(r.get("PlaceName")), {}).get("Name"))
    if n: ZONE_EX[n] = min(ZONE_EX.get(n, 9), i(r.get("ExVersion")))
EXP_NORM = {norm(x): n for n, x in enumerate(EXP)}

TT = sheet("TerritoryType")
ZONE_NAME = {k: clean(place.get(i(r.get("PlaceName")), {}).get("Name")) for k, r in TT.items()}
REGION_OF = {}
for r in TT.values():
    z, rg = norm(place.get(i(r.get("PlaceName")), {}).get("Name")), clean(place.get(i(r.get("PlaceNameRegion")), {}).get("Name"))
    if z and rg: REGION_OF.setdefault(z, rg)
SUB_EX = dict(ZONE_EX)  # areas inside zones (Gangos, Lower Jeuno ...) through the maps that show them
for r in sheet("Map").values():
    t = TT.get(i(r.get("TerritoryType")))
    if not t: continue
    for col in ("PlaceNameSub", "PlaceName"):
        n = norm(place.get(i(r.get(col)), {}).get("Name"))
        if n: SUB_EX.setdefault(n, i(t.get("ExVersion")))
def remember(e, old_sid):  # the entry leaves a list it was published in: keep that list for saved ticks
    pv = e.setdefault("pv", [])
    if old_sid not in pv and old_sid != e.get("mv"): pv.append(old_sid)
def patch_ex(p):
    m = re.match(r"^(\d+)", str(p or ""))
    if not m: return None
    v = int(m.group(1))
    return max(0, min(len(EXP) - 1, v - 2)) if v >= 1 else None

# Duties on an older map than their release (the map's expansion would be wrong): by name
DUTY_EX = [(r"^The Palace of the Dead", 1), (r"^Heaven-on-High", 2), (r"^Eureka Orthos", 4), (r"^Pilgrim's Traverse", 5), (r"^The Aquapolis$", 1)]
LEVEL_EX = [50, 60, 70, 80, 90, 999]  # level caps: a levequest's level gives its expansion

def entry_ex(sid, g, e):
    if sid.startswith("quests-") and e["i"] in QUEST_EX: return QUEST_EX[e["i"]]
    if sid.startswith("duty-"):
        for rx, x in DUTY_EX:
            if re.match(rx, e["n"], re.I): return x
        return group_ex(g)  # the map's expansion (Teamcraft's duty patch labels are not reliable)
    if sid in ("fates", "hunt"):
        x = group_ex(g)
        if x is not None: return x
    if sid == "leves" and e.get("lv"):
        return next(n for n, cap in enumerate(LEVEL_EX) if e["lv"] <= cap)
    x = patch_ex(e.get("p"))
    if x is not None: return x
    return group_ex(g)

def group_ex(g):
    for t in (g.get("t"), g.get("c")):
        n = norm(t)
        if n in EXP_NORM: return EXP_NORM[n]
        for en, x in EXP_NORM.items():
            if n.startswith(en): return x
        if n in ZONE_EX: return ZONE_EX[n]
    return None

secs = data["sections"]
S = {s["id"]: s for s in secs}
stats = collections.Counter()

# ---------------------------------------------------------------- 1. quests outside the journal
if "quests-other" in S:
    other = S["quests-other"]
    cj_groups = {}
    for s in secs:
        if s["id"].startswith("quests-cj-"):
            for g in s["g"]:
                cj_groups[norm(re.sub(r" Quests$", "", g["t"]))] = (s, g)
    unlocks = []
    for g in other["g"]:
        for e in g["e"]:
            e["mv"] = "quests-other"
            m = re.match(r"^So You Want to Be an? (.+)$", e["n"])
            hit = cj_groups.get(norm(m.group(1))) if m else None
            if hit:
                hit[1]["e"].insert(0, e); stats["outside-journal quest -> its class"] += 1
            else:
                unlocks.append(e); stats["outside-journal quest -> Other Quests: Feature Unlocks"] += 1
    oq = S["quests-otherquests"]
    oq["g"].append({"t": "Feature Unlocks", "e": unlocks})
    secs.remove(other); del S["quests-other"]

# ---------------------------------------------------------------- 1b. FATEs without a zone: the game's own Fate.Location
if "fates" in S:
    FATE_ZONE = json.load(open(os.path.join(T, "data", "fate-zones.json"), encoding="utf-8"))["zones"]  # Garland Tools + FATE type
    gs = S["fates"]["g"]
    by_t = {g["t"]: g for g in gs}
    keep = []
    for g in list(gs):
        if not g["t"].startswith("Not placed"): continue
        gs.remove(g)
        for e in g["e"]:
            px = patch_ex(e.get("p"))  # where the last published version listed it
            remember(e, "fates-" + (ABBR[px] if px is not None else "other"))
            zone = FATE_ZONE.get(str(e["i"]), "")
            if zone == "The Diadem": zone = "The Diadem (original 3.x version)"
            if zone:
                tg = by_t.get(zone)
                if not tg: tg = by_t[zone] = {"t": zone, "e": []}; gs.append(tg)
                tg["e"].append(e); stats["FATE placed in its zone (Garland Tools or its type)"] += 1
            else:
                e["x"] = "gone"; keep.append(e); stats["FATE never placed in the game (not counted)"] += 1
    if keep: gs.append({"t": "Never placed in the game world (test or removed FATEs, not counted)", "e": keep})

# ---------------------------------------------------------------- 2. one list per expansion
SPLITS = [
    (["quests-mainscenarioarealmreborn", "quests-mainscenariodawntrail"], "quests-msq", "Main Scenario"),
    (["quests-sidequests"], "quests-side", "Sidequests"),
    (["quests-alliedsocietyquestsareal", "quests-alliedsocietyquestsdawnt"], "quests-allied", "Allied Society Quests"),
    (["leves"], "leves", "Levequests"),
    (["fates"], "fates", "FATEs"),
    (["hunt"], "hunt", "The Hunt"),
]
for olds, base, title in SPLITS:
    olds = [o for o in olds if o in S]
    if not olds: continue
    at = secs.index(S[olds[0]])
    area = S[olds[0]]["area"]
    note = S[olds[0]].get("note")
    by = collections.OrderedDict()
    for o in olds:
        for g in S[o]["g"]:
            for e in g["e"]:
                x = entry_ex(o, g, e)
                if x is None: x = len(EXP)
                e.setdefault("mv", o)
                gl = by.setdefault(x, collections.OrderedDict())
                gl.setdefault((g["t"], g.get("c", "")), []).append(e)
        secs.remove(S[o]); del S[o]
    new = []
    for x in sorted(by):
        name = EXP[x] if x < len(EXP) else "Other"
        sid = base + "-" + (ABBR[x] if x < len(EXP) else "other")
        s = {"id": sid, "t": title + ": " + name, "area": area, "folder": title,
             "g": [{"t": t, "c": c, "e": es} if c else {"t": t, "e": es} for (t, c), es in by[x].items()]}
        if note: s["note"] = note
        new.append(s); S[sid] = s
        stats["split " + title] += 1
    secs[at:at] = new

# ---------------------------------------------------------------- 2a. Hildibrand Adventures: one list across expansions
hil = {"id": "quests-side-hildibrand", "t": "Sidequests: Hildibrand Adventures", "area": "", "folder": "Sidequests", "g": [],
       "note": "Hildibrand's comic quest lines from every expansion, in order. Finishing them up to The Imperfect Gentleman (and the later Endwalker ones) is needed for the Manderville relic weapons."}
for x, ab in enumerate(ABBR):
    s_ = S.get("quests-side-" + ab)
    if not s_: continue
    hil["area"] = s_["area"]
    for g in list(s_["g"]):
        if "Hildibrand" in g["t"]:
            s_["g"].remove(g)
            for e in g["e"]: remember(e, s_["id"])
            hil["g"].append({"t": g["t"], "e": g["e"], "xp": EXP[x]}); stats["Hildibrand quests gathered"] += len(g["e"])
if hil["g"]:
    last = max(n for n, s_ in enumerate(secs) if s_["id"].startswith("quests-side-"))
    secs.insert(last + 1, hil); S[hil["id"]] = hil

# ---------------------------------------------------------------- 2b. collection entries without a patch
for s in secs:
    nop = [g for g in s["g"] if g["t"] == "Patch not recorded"]
    if not nop: continue
    dated = sorted((e["i"], e["p"]) for g in s["g"] for e in g["e"] if e.get("p"))
    for g in nop:
        s["g"].remove(g)
        for e in g["e"]:
            before = [p for k, p in dated if k < e["i"]]
            p = before[-1] if before else (dated[0][1] if dated else None)
            x = patch_ex(p)
            tg = next((h for h in s["g"] if norm(h["t"]) == norm(EXP[x])), None) if x is not None else None
            if tg is None: tg = {"t": EXP[x if x is not None else 0], "e": []}; s["g"].append(tg)
            e["pe"] = 1  # its expansion is estimated from its neighbours
            tg["e"].append(e); stats["collection entry placed by its neighbours' patch"] += 1
    s["g"].sort(key=lambda g: EXP_NORM.get(norm(g["t"]), 99))

# ---------------------------------------------------------------- 3. expansion layer inside the other lists
SPLIT_BASES = tuple(b + "-" for _, b, _ in SPLITS)
for s in secs:
    sid = s["id"]
    if sid.startswith(SPLIT_BASES): continue
    titles_are_ex = all(group_ex({"t": g["t"]}) is not None and norm(g["t"]) in EXP_NORM for g in s["g"])
    if titles_are_ex and not sid.startswith("duty-"): continue  # already one group per expansion
    rows = []  # (expansion, original group index, group, entry)
    for gi, g in enumerate(s["g"]):
        gx = group_ex(g)
        for e in g["e"]:
            x = entry_ex(sid, g, e)
            if sid.startswith("duty-") and x is not None and e.get("p") and patch_ex(e["p"]) != x:
                del e["p"]; stats["duty patch label dropped (contradicts its expansion)"] += 1
            if x is None: x = gx
            rows.append((x, gi, g, e))
    known = {x for x, *_ in rows if x is not None}
    if len(known) < 2 and not titles_are_ex: continue
    if titles_are_ex:  # duties: one group per expansion, placed by release patch
        out = collections.OrderedDict()
        for x, gi, g, e in rows:
            out.setdefault(x if x is not None else group_ex(g), []).append(e)
        moved = sum(1 for x, gi, g, e in rows if x is not None and norm(EXP[x]) != norm(g["t"]))
        s["g"] = [{"t": EXP[x], "e": es} for x, es in sorted(out.items(), key=lambda kv: kv[0])]
        if moved: stats["duties placed by release patch: " + sid] = moved
        continue
    # every group whose entries are all of one expansion stays whole; a mixed group is split by expansion
    out = collections.OrderedDict()
    for x, gi, g, e in rows:
        if x is None:  # no expansion of its own: the group's most common one
            c = collections.Counter(y for y, gj, _, _ in rows if gj == gi and y is not None)
            x = c.most_common(1)[0][0] if c else len(EXP)
        out.setdefault((x, gi), []).append(e)
    groups = []
    for (x, gi), es in sorted(out.items(), key=lambda kv: kv[0]):
        g = s["g"][gi]
        ng = {"t": g["t"], "e": es, "xp": EXP[x] if x < len(EXP) else "Other"}
        if g.get("c"): ng["c"] = g["c"]
        groups.append(ng)
    s["g"] = groups
    stats["expansion layer"] += 1

# ---------------------------------------------------------------- 4. no "Other", "???" or "Added after" groups
SPEAR_ITEM = {i(r.get("Item")): r for r in sheet("SpearfishingItem").values()}
SPEAR_NODE = sheet("SpearfishingNotebook")
FSPOT = sheet("FishingSpot")
for s in secs:
    sid = s["id"]
    for g in list(s["g"]):
        if sid == "spearfishing" and g["t"] == "Other":
            s["g"].remove(g)
            for e in g["e"]:
                nb = SPEAR_NODE.get(i(SPEAR_ITEM.get(e.get("it"), {}).get("SpearfishingNotebook")), {})
                zone = ZONE_NAME.get(i(nb.get("TerritoryType")), "") if nb else ""
                t = zone or ("Treasure Maps" if "Map" in e["n"] else g.get("xp", ""))
                tg = next((h for h in s["g"] if h["t"] == t and h.get("xp") == g.get("xp")), None)
                if not tg: tg = {"t": t, "e": [], "xp": g.get("xp")}; s["g"].append(tg)
                tg["e"].append(e)
            stats["spearfishing Other split by zone"] += 1
        elif sid.startswith("craft-") and g["t"] == "Other":
            ns = [e["n"] for e in g["e"]]
            g["t"] = "Replica Gear (glamour)" if sum(n.startswith("Replica") for n in ns) * 2 > len(ns) else ("Aetherial Wheels" if all("Wheel" in n for n in ns) else "Special Recipes")
            stats["craft Other renamed"] += 1
        elif sid == "ttnpcs" and (g.get("xp") in (None, "Other") or g["t"] == "???"):
            if g["t"] == "???":
                s["g"].remove(g)
                for e in g["e"]:
                    loc = re.sub(r"\s*\(.*$", "", (e.get("d") or "").split(" · ")[0]).strip() or "Elsewhere"
                    x = SUB_EX.get(norm(loc))
                    tg = next((h for h in s["g"] if h["t"] == loc), None)
                    if not tg: tg = {"t": loc, "e": [], "xp": EXP[x] if x is not None else EXP[-1]}; s["g"].append(tg)
                    tg["e"].append(e)
            elif "Battlehall" in g["t"]: g["t"], g["xp"] = "The Gold Saucer: Triple Triad Battlehall", EXP[0]
            elif norm(g["t"]) in ("azysla", "azyslla"): g["t"], g["xp"] = "Azys Lla", EXP[1]
            stats["Triple Triad groups placed"] += 1
        elif sid == "fishingspots" and g.get("xp") in (None, "Other"):
            xs = [i(TT.get(i(FSPOT.get(e["i"], {}).get("TerritoryType")), {}).get("ExVersion")) for e in g["e"] if FSPOT.get(e["i"])]
            g["xp"] = EXP[max(xs)] if xs else EXP[3]
            if g["t"].startswith("Added after"): g["t"] = "Ocean Fishing: " + g["e"][0]["n"]
            elif not g["t"].startswith("Ocean"): g["t"] = "Ocean Fishing: " + g["t"]
            stats["ocean fishing groups placed"] += 1
        elif g["t"] == "Other" and sid.startswith("ach-"):
            s["g"].remove(g)
            for e in g["e"]:
                m = re.match(r"^Mapping the Realm: (.+)$", e["n"])
                t = REGION_OF.get(norm(m.group(1)), "") if m else ""
                t = t or "General"
                tg = next((h for h in s["g"] if h["t"] == t and h.get("xp") == g.get("xp")), None)
                if not tg: tg = {"t": t, "e": [], "xp": g.get("xp")}; s["g"].append(tg)
                tg["e"].append(e)
            stats["achievement Other split by region"] += 1
        if sid == "gather-other": s["t"] = "Gathering Log: Relic Tool Materials"
        if sid == "gather-other" and g["t"].startswith("In the gathering log"):
            g["t"] = "Skysteel tool materials" if any(e["n"].startswith("Oddly Specific") for e in g["e"]) else ("Splendorous tool materials" if g.get("xp") == EXP[4] else "Relic tool materials")
        if g["t"].startswith("Added after") and g in s["g"]:  # entries newer than the checklist join the group of their kind
            s["g"].remove(g)
            base_group = {}
            for h in s["g"]:
                for e in h["e"]: base_group.setdefault(norm(re.sub(r"\s*\d+$", "", e["n"])), h)
            for e in g["e"]:
                h = base_group.get(norm(re.sub(r"\s*\d+$", "", e["n"])))
                if not h and "Cosmic" in e["n"]: h = next((x for x in s["g"] if x["t"] == "Cosmic Exploration"), None)
                if not h and len(s["g"]) == 1: h = s["g"][0]
                if not h:
                    nm = e["n"]
                    if re.search(r"Vana'diel|Jeuno|San d'Oria|Windurst|Ark Angel|Shadow Lord|Kam'lanaut|Eald'narche|Shantotto|Promathia|Prishe|Distant Chains|Fafnir", nm) and not nm.startswith("Wind-up"): t = "Echoes of Vana'diel (alliance raids)"
                    elif re.search(r"Brute Bomber|Wicked Thunder|Dancing Green|Sugar Riot|Howling Blade|Vamp Fatale|Deep Blue|Red Hot|The Tyrant|Honey B\. Lovely|Black Cat|Breaker of Beasts", nm): t = "AAC Arcadion (raids)"
                    elif re.search(r"Beastmaster|Crucible of the Unbroken|Keybound", nm): t = "Beastmaster"
                    elif re.search(r"Maelstrom|Twin Adder|Immortal Flames", nm): t = "Grand Company"
                    elif "DRAGON QUEST" in nm: t = "Event"
                    elif "Archeia" in nm: t = "PvP"
                    elif re.search(r"Occult", nm): t = "Occult Crescent"
                    else: t = "Patch 7.5 additions (source not yet published)"
                    h = next((x for x in s["g"] if x["t"] == t), None)
                    if not h: h = {"t": t, "e": []}; s["g"].append(h)
                h["e"].append(e)
            stats["newer entries joined their kind's group: " + sid] = len(g["e"])
    if any(g.get("xp") for g in s["g"]):  # keep expansion order after the moves
        order = {x: n for n, x in enumerate(EXP)}
        s["g"].sort(key=lambda g: order.get(g.get("xp"), 99))

with open(DATA, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
print(json.dumps({"lists": len(secs), "entries": sum(len(g["e"]) for s in secs for g in s["g"]), "changes": dict(stats)}, indent=1))
