#!/usr/bin/env python3
"""Build data/info.json: for each entry, a few plain lines on how to get or do it (the tracker shows them in the window
that opens when the pointer rests on an entry's name, and in the entry's details).

  python3 -I tools/info.py <ffxiv-datamining checkout> <ffxiv-teamcraft libs/data/src/lib/json dir> <teamcraft json dir used by extract.py>

Run after tools/organize.py. Sources, all facts rather than prose:
  - the game sheets (xivapi/ffxiv-datamining, the pinned commit): quest givers, levels, prerequisites, unlocks,
    recipes, sightseeing conditions, map coordinates (Level + Map);
  - FFXIV Teamcraft's data files (MIT): NPC positions, FATE levels, monster positions, fishing holes with bait and
    hook, gathering nodes, levequest givers, aetheryte positions;
  - what the entries already carry (FFXIV Collect sources, achievement text, checklist details).
No wiki text is copied: the window links to the Console Games Wiki page for step-by-step guides instead.
"""
import collections, csv, json, os, re, sys

if len(sys.argv) < 4:
    sys.exit(__doc__)
DM, TC, TJ = sys.argv[1:4]
FISHDATA = sys.argv[4] if len(sys.argv) > 4 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "fish-tracker.json")  # tools/fetch-fishdata.py
T = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
data = json.load(open(os.path.join(T, "data", "tracker-data.json"), encoding="utf-8"))

def sheet(name):
    with open(os.path.join(DM, "csv", "en", name + ".csv"), encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    return {int(r[0]): dict(zip(rows[0], r)) for r in rows[1:] if r and r[0].isdigit()}
def tc(name, d=TC): return json.load(open(os.path.join(d, name), encoding="utf-8"))
def i(v):
    try: return int(v)
    except (TypeError, ValueError): return 0
def f(v):
    try: return float(v)
    except (TypeError, ValueError): return 0.0
clean = lambda s: " ".join(re.sub(r"<[^>]+>", "", str(s or "")).split())
norm = lambda s: re.sub(r"[^a-z0-9]+", "", str(s or "").lower().replace("’", "'"))

PLACE = {k: clean(r["Name"]) for k, r in sheet("PlaceName").items()}
ITEM = {k: clean(r["Name"]) for k, r in sheet("Item").items()}
MAP = sheet("Map")
LEVEL = sheet("Level")
NPCS = tc("npcs.json")
Q = sheet("Quest")
QNAME = {k: clean(r["Name"]) for k, r in Q.items() if clean(r["Name"])}
CJC = {k: clean(r["Name"]) for k, r in sheet("ClassJobCategory").items()}
CFC = sheet("ContentFinderCondition")

def coord(raw, size, offset):
    c = size / 100.0
    return 41.0 / c * ((raw + offset) * c + 1024.0) / 2048.0 + 1.0
def level_where(level_id):
    lv = LEVEL.get(level_id)
    if not lv: return ""
    m = MAP.get(i(lv["Map"]))
    if not m: return ""
    size = f(m.get("SizeFactor")) or 100.0
    x, y = coord(f(lv["X"]), size, f(m.get("OffsetX"))), coord(f(lv["Z"]), size, f(m.get("OffsetY")))
    zone = PLACE.get(i(m.get("PlaceName")), "")
    return (zone + " " if zone else "") + "(%.1f, %.1f)" % (x, y)
def npc_where(npc_id):
    n = NPCS.get(str(npc_id))
    if not n: return ""
    p = n.get("position") or {}
    name = n.get("en") or ""
    if not p: return name
    zone = PLACE.get(i(p.get("zoneid")), "")
    return name + (" in " + zone if zone else "") + (" (%.1f, %.1f)" % (p["x"], p["y"]) if p.get("x") else "")

INFO = {}
def put(key, lines):
    lines = [l for l in lines if l]
    if lines: INFO[key] = lines[:6]
def sections(prefix):
    for s in data["sections"]:
        if s["id"] == prefix or s["id"].startswith(prefix):
            yield s
def each(prefix):
    for s in sections(prefix):
        for g in s["g"]:
            for e in g["e"]:
                yield s["id"] + ":" + str(e["i"]), g, e
stats = collections.Counter()

# ---------------------------------------------------------------- quests
unlock_by_content = {}
for qid, r in Q.items():
    ic = i(r.get("InstanceContentUnlock"))
    if ic: unlock_by_content.setdefault(ic, qid)
for qid, r in Q.items():  # a quest that adds content to the duty finder names it in its INSTANCEDUNGEON parameters
    ps = [(r.get(f"QuestParams[{n}].ScriptInstruction") or "", i(r.get(f"QuestParams[{n}].ScriptArg"))) for n in range(50) if f"QuestParams[{n}].ScriptInstruction" in r]
    if any(ins.startswith(("UNLOCK_ADD_NEW_CONTENT", "UNLOCK_DUNGEON_VVD", "UNLOCK_IMAGE_DUNGEON")) for ins, _ in ps):
        for ins, arg in ps:
            if ins.startswith("INSTANCEDUNGEON") and arg: unlock_by_content.setdefault(arg, qid)
for qid, r in Q.items():  # a duty played as part of a quest is opened by that quest
    for n in range(3):
        ic = i(r.get(f"InstanceContent[{n}]"))
        if ic and QNAME.get(qid): unlock_by_content.setdefault(ic, qid)
def quest_lines(qid):
    r = Q.get(qid)
    if not r: return []
    out = []
    who = npc_where(i(r.get("IssuerStart")))
    if who: out.append("Starts with " + who)
    lv, cat = i(r.get("ClassJobLevel[0]")), CJC.get(i(r.get("ClassJobCategory0")), "")
    generic = not cat or cat.lower().startswith(("all classes", "any disciple of war or magic", "disciple of war or magic"))
    if lv: out.append("Level " + str(lv) + ("" if generic else " · " + cat))
    prev = [QNAME.get(i(r.get(f"PreviousQuest[{n}]"))) for n in range(3)]
    prev = [p for p in prev if p]
    if prev: out.append(("After one of: " if r.get("PreviousQuestJoin") == "2" and len(prev) > 1 else "After: ") + ", ".join(prev))
    ic = i(r.get("InstanceContentUnlock"))
    if ic:
        duty = next((clean(c["Name"]) for c in CFC.values() if i(c.get("Content")) == ic and i(c.get("ContentLinkType")) == 1 and clean(c["Name"])), "")
        if duty: out.append("Unlocks: " + duty)
    return out
for key, g, e in each("quests-"):
    put(key, quest_lines(e["i"])); stats["quests"] += 1

# ---------------------------------------------------------------- duties (and the Crucible's boards)
CONTENT_OF = {cid: i(r.get("Content")) for cid, r in CFC.items() if i(r.get("ContentLinkType")) == 1}
def duty_lines(cid, e):
    r = CFC.get(cid, {})
    out = []
    lv, il = i(r.get("ClassJobLevelRequired")), i(r.get("ItemLevelRequired"))
    if lv: out.append("Level " + str(lv) + (" · item level " + str(il) if il else ""))
    q = unlock_by_content.get(CONTENT_OF.get(cid))
    if q:
        who = npc_where(i(Q[q].get("IssuerStart")))
        out.append("Unlocked by the quest " + QNAME.get(q, "") + (" (" + who + ")" if who else ""))
    return out
for key, g, e in each("duty-"):
    put(key, duty_lines(e["i"], e)); stats["duties"] += 1
for key, g, e in each("beastmaster"):
    if g["t"] == "Crucible of the Unbroken": put(key, duty_lines(e["i"], e))
    elif e.get("d"): put(key, ["Found in " + e["d"], "Befriended as a Beastmaster"])

# ---------------------------------------------------------------- FATEs, hunt marks, hunting log
FATES = tc("fates.json")
for key, g, e in each("fates-"):
    fa = FATES.get(str(e["i"]), {})
    lines = []
    if fa.get("level"): lines.append("Level " + str(fa["level"]) + " FATE" + ("" if g["t"].startswith("Not placed") else " in " + g["t"]))
    where = level_where(i(fa.get("location")))
    if where: lines.append("Appears at " + where)
    put(key, lines); stats["fates"] += 1
MON = tc("monsters.json")
BNPC = collections.defaultdict(list)
for k, r in sheet("BNpcName").items():
    if clean(r.get("Singular")): BNPC[norm(r["Singular"])].append(k)
def mon_lines(ids, verb="Found"):
    seen, out = set(), []
    for bid in ids:
        for p in (MON.get(str(bid)) or {}).get("positions", []):
            zone = PLACE.get(i(p.get("zoneid")), "")
            if not zone or zone in seen: continue
            seen.add(zone)
            out.append(verb + " in " + zone + " (%.1f, %.1f), level %d" % (p["x"], p["y"], p.get("level", 0)))
            if len(out) >= 3: return out
    return out
ELITE = {norm(k): v for k, v in json.load(open(os.path.join(T, "data", "elite-marks.json"), encoding="utf-8"))["marks"].items()}
for key, g, e in each("hunt-"):
    lines = mon_lines([e["i"]] + list(e.get("al") or [])) or mon_lines(BNPC.get(norm(e["n"]), []))
    el = ELITE.get(norm(e["n"]))
    if el:
        head = el["rank"] + " rank elite mark in " + el["area"]
        lines = [head] + ([("Spawns when: " + el["spawn"])] if el.get("spawn") and el["spawn"].lower() != "none" else []) + ([("Respawn: " + el["respawn"] + ("" if "hour" in el["respawn"].lower() or "second" in el["respawn"].lower() else " hours"))] if el.get("respawn") else []) + lines
    elif g["t"] == "Hunt bill marks":
        lines = ["Hunt bill mark (from the Hunt board's daily and weekly bills)"] + lines
    put(key, lines); stats["hunt"] += 1
for key, g, e in each("hunting"):
    put(key, ["Defeat " + str(e.get("cnt", 1))] + mon_lines(BNPC.get(norm(e["n"]), []))); stats["hunting log"] += 1

# ---------------------------------------------------------------- travel
AE = {a["id"]: a for a in tc("aetherytes.json")}
for key, g, e in each("aetherytes"):
    a = AE.get(e["i"])
    if a: put(key, ["Attune in " + (PLACE.get(i(a.get("zoneid")), "") or e.get("zone", "")) + " (%.1f, %.1f)" % (a["x"], a["y"])])
AC = sheet("AetherCurrent")
CURRENT_AT = {}  # field aether current -> its spot (EObj.Data = the current, Level.Object = that EObj)
eobj_cur = {k: i(r.get("Data")) for k, r in sheet("EObj").items() if 2818000 < i(r.get("Data")) < 2819000}
for lid, lv in LEVEL.items():
    c = eobj_cur.get(i(lv.get("Object")))
    if c and c not in CURRENT_AT: CURRENT_AT[c] = level_where(lid)
for key, g, e in each("aethercurrents"):
    qid = i(AC.get(e["i"], {}).get("Quest"))
    if qid: put(key, ["Reward of the quest " + QNAME.get(qid, "")] + quest_lines(qid)[:2])
    else: put(key, ["Field aether current at " + CURRENT_AT[e["i"]] if CURRENT_AT.get(e["i"]) else "Field aether current in " + g["t"], "Fly or walk there and interact with it"])
ADV = sheet("Adventure")
EMOTE = {k: clean(r["Name"]) for k, r in sheet("Emote").items()}
WEATHER = {k: clean(r["Name"]) for k, r in sheet("Weather").items()}
for key, g, e in each("sightseeing"):
    r = ADV.get(e["i"])
    if not r: continue
    lines = ["Vista at " + level_where(i(r["Level"]))] if level_where(i(r["Level"])) else []
    t0, t1 = i(r.get("MinTime")), i(r.get("MaxTime"))
    if t0 or t1: lines.append("Eorzea time %02d:%02d to %02d:%02d" % (t0 // 100, t0 % 100, t1 // 100, t1 % 100))
    w = WEATHER.get(i(r.get("Weather")))
    if w: lines.append("Weather: " + w)
    em = EMOTE.get(i(r.get("Emote")))
    if em: lines.append("Emote: /" + em.lower())
    put(key, lines); stats["sightseeing"] += 1

# ---------------------------------------------------------------- levequests
LEVES = tc("leves.json")
for key, g, e in each("leves-"):
    lv = LEVES.get(str(e["i"]), {})
    lines = []
    if lv.get("lvl"): lines.append("Level " + str(lv["lvl"]) + " " + ((lv.get("job") or {}).get("en") or "") + " levequest")
    if lv.get("startPlaceId"): lines.append("From the levemete in " + PLACE.get(i(lv["startPlaceId"]), ""))
    put(key, lines); stats["leves"] += 1

# ---------------------------------------------------------------- crafting, gathering, fishing
RECIPE, RLT = sheet("Recipe"), sheet("RecipeLevelTable")
BOOK = {k: clean(ITEM.get(i(r.get("Item")), "")) for k, r in sheet("SecretRecipeBook").items()} if os.path.exists(os.path.join(DM, "csv", "en", "SecretRecipeBook.csv")) else {}
ITEMROW = sheet("Item")
STATUS = {k: clean(r.get("Name")) for k, r in sheet("Status").items()} if os.path.exists(os.path.join(DM, "csv", "en", "Status.csv")) else {}
CRAFT_JOB = {0: "CRP", 1: "BSM", 2: "ARM", 3: "GSM", 4: "LTW", 5: "WVR", 6: "ALC", 7: "CUL"}
CRAFT_NAME = {"carpenter": "Carpenter", "blacksmith": "Blacksmith", "armorer": "Armorer", "goldsmith": "Goldsmith", "leatherworker": "Leatherworker", "weaver": "Weaver", "alchemist": "Alchemist", "culinarian": "Culinarian"}
NODES = tc("nodes.json", TJ)
GITEMS = tc("gathering-items.json", TJ)
NODE_TYPE = {0: "Mining", 1: "Quarrying", 2: "Logging", 3: "Harvesting"}
NODE_JOB = {0: "MIN", 1: "MIN", 2: "BTN", 3: "BTN"}
by_item = collections.defaultdict(list)
for nid, n in NODES.items():
    for it in (n.get("items") or []) + (n.get("hiddenItems") or []):
        by_item[it].append(n)
gather_level = {}
for gi in GITEMS.values():
    gather_level.setdefault(gi.get("itemId"), gi)
sublime_of = {gi["sublimeVariant"]: gi["itemId"] for gi in GITEMS.values() if gi.get("sublimeVariant")}
made_by = collections.defaultdict(list)  # item -> (job, level) of recipes that make it
for rid, r in RECIPE.items():
    it = i(r.get("ItemResult"))
    if it:
        made_by[it].append((CRAFT_JOB.get(i(r.get("CraftType")), "?"), i(RLT.get(i(r["RecipeLevelTable"]), {}).get("ClassJobLevel"))))
fished = set(i(k) for k in tc("fishing-sources.json"))
def source_tag(it):
    """Where an ingredient comes from, briefly: crafted (job, level), gathered (job, level) or fished."""
    if it in made_by:
        j, lv = sorted(made_by[it], key=lambda x: x[1])[0]
        return "craft " + j + " " + str(lv)
    if it in by_item:
        n = by_item[it][0]
        return "gather " + NODE_JOB.get(n.get("type"), "") + " " + str(gather_level.get(it, {}).get("level") or n.get("level", ""))
    if it in fished:
        return "fish"
    return ""
CRYSTAL = lambda it: 2 <= it <= 19
for key, g, e in each("craft-"):
    r = RECIPE.get(e["i"])
    if not r: continue
    t = RLT.get(i(r["RecipeLevelTable"]), {})
    job = CRAFT_NAME.get(key.split(":")[0][6:], "")
    head = job + " level " + str(i(t.get("ClassJobLevel"))) + (" " + "★" * i(t.get("Stars")) if i(t.get("Stars")) else "") + " (recipe level " + str(i(r["RecipeLevelTable"])) + ")"
    flags = [x for x, on in (("specialist only", r.get("IsSpecializationRequired") == "True"), ("expert recipe", r.get("IsExpert") == "True"),
                             ("collectable", i(r.get("CollectableMetadataKey")) or ITEMROW.get(i(r.get("ItemResult")), {}).get("AlwaysCollectable") == "True")) if on]
    lines = [head + (" · " + ", ".join(flags) if flags else "")]
    need = []
    for n in range(8):
        it = i(r[f"Ingredient[{n}]"])
        if not it or not ITEM.get(it): continue
        tag = "" if CRYSTAL(it) else source_tag(it)
        need.append(str(i(r[f"AmountIngredient[{n}]"])) + "× " + ITEM[it] + (" (" + tag + ")" if tag else ""))
    if need: lines.append("Materials: " + ", ".join(need) + ("; makes " + str(i(r.get("AmountResult"))) if i(r.get("AmountResult")) > 1 else ""))
    req = [x for x in ((str(i(r.get("RequiredCraftsmanship"))) + " Craftsmanship") if i(r.get("RequiredCraftsmanship")) else "",
                       (str(i(r.get("RequiredControl"))) + " Control") if i(r.get("RequiredControl")) else "") if x]
    if req: lines.append("Needs at least " + " and ".join(req))
    if i(r.get("ItemRequired")) and ITEM.get(i(r["ItemRequired"])): lines.append("Requires " + ITEM[i(r["ItemRequired"])] + " (equipped or in inventory)")
    if i(r.get("StatusRequired")) and STATUS.get(i(r["StatusRequired"])): lines.append("Requires the status " + STATUS[i(r["StatusRequired"])])
    bk = BOOK.get(i(r.get("SecretRecipeBook")))
    if bk: lines.append("Learn it first from " + bk)
    elif i(r.get("Quest")) and QNAME.get(i(r["Quest"])): lines.append("Unlocked by the quest " + QNAME[i(r["Quest"])])
    tail = [x for x, on in (("can be HQ", r.get("CanHq") == "True"), ("Quick Synthesis available", r.get("CanQuickSynth") == "True")) if on]
    dur = i(t.get("Durability")) * i(r.get("DurabilityFactor") or 100) // 100 if t.get("Durability") else 0
    if dur: tail.insert(0, "durability " + str(dur))
    if tail: lines.append(tail[0][0].upper() + ", ".join(tail)[1:])
    put(key, lines); stats["recipes"] += 1

# gathering log: where (node type, zone, coordinates), when (timed nodes), and whether it is collectable
TT_REGION = {}
for r in sheet("TerritoryType").values():
    z, reg = PLACE.get(i(r.get("PlaceName")), ""), PLACE.get(i(r.get("PlaceNameRegion")), "")
    if z and reg: TT_REGION.setdefault(z, reg)
FOLK = {}
for s_ in data["sections"]:
    if s_["id"] == "folklore":
        for g in s_["g"]:
            for e in g["e"]:
                m = re.match(r"^Tome of (\w+) Folklore - (.+)$", e["n"])
                if m: FOLK[(m.group(1), norm(m.group(2)))] = e["n"]
def folklore_for(kind, zone, map_id=None):
    m = MAP.get(i(map_id)) if map_id else None
    reg = norm(PLACE.get(i(m.get("PlaceNameRegion")), "") if m else TT_REGION.get(zone, ""))
    for (k, r), name in FOLK.items():
        if k == kind and reg and (r == reg or reg in r or r in reg): return name
    return ""
def node_line(n, it):
    zone = PLACE.get(i(n.get("zoneid")), "")
    m = MAP.get(i(n.get("map")), {})
    big = PLACE.get(i(m.get("PlaceName")), "")
    if big and big != zone: zone = zone + ", " + big if zone else big
    kind = NODE_TYPE.get(n.get("type"), "Gathering")
    tags = []
    if n.get("legendary"): tags.append("legendary")
    elif n.get("ephemeral"): tags.append("ephemeral")
    elif n.get("limited"): tags.append("unspoiled")
    if it in (n.get("hiddenItems") or []): tags.append("hidden item: appears once the node's hidden-item bonus triggers")
    line = "%s node, level %d, in %s (%.1f, %.1f)" % (kind, n.get("level", 0), zone, n.get("x", 0), n.get("y", 0))
    if tags: line += " · " + ", ".join(tags)
    if n.get("spawns"):
        hrs = ", ".join("%d:00" % h for h in n["spawns"])
        dur = n.get("duration") or 0
        line += " · up at " + hrs + " Eorzea time" + (" for %s hours" % (dur // 60 if dur % 60 == 0 else round(dur / 60, 1)) if dur else "")
    if n.get("legendary"):
        bk = folklore_for("Geological" if n.get("type") in (0, 1) else "Botanical", zone, n.get("map"))
        if bk: line += " · needs " + bk
    return line
for key, g, e in each("gather-"):
    it = e.get("it")
    base = sublime_of.get(it)
    ns = by_item.get(it, []) or by_item.get(base, [])
    lines, seen = [], set()
    if base and not by_item.get(it):
        lines.append("Sublime variant: found now and then in place of " + ITEM.get(base, "its ordinary version") + " at its nodes")
    for n in sorted(ns, key=lambda n: (bool(n.get("spawns")), n.get("level", 0))):
        z = PLACE.get(i(n.get("zoneid")), "")
        if not z or z in seen: continue
        seen.add(z)
        lines.append(node_line(n, it if not base else base))
        if len(seen) >= 3: break
    row = ITEMROW.get(it, {})
    gi = gather_level.get(it, {})
    extra = []
    if row.get("IsCollectable") == "True" or row.get("AlwaysCollectable") == "True":
        extra.append("collectable (use the Collect action to gather it for scrip turn-ins)")
    else:
        extra.append("not a collectable")
    if gi.get("perceptionReq"): extra.append("needs " + str(gi["perceptionReq"]) + " Perception")
    lines.append(extra[0][0].upper() + "; ".join(extra)[1:])
    put(key, lines); stats["gathering"] += 1
FT = json.load(open(FISHDATA, encoding="utf-8")) if FISHDATA else {}
FT_FISH, FT_ITEMS, FT_WEATHER = FT.get("FISH", {}), FT.get("ITEMS", {}), FT.get("WEATHER_TYPES", {})
FT_FOLK = FT.get("FOLKLORE", {})
def ft_name(iid): return (FT_ITEMS.get(str(iid)) or {}).get("name_en") or ITEM.get(i(iid), "")
def fish_extra(iid):
    f = FT_FISH.get(str(iid))
    if not f: return []
    out = []
    a, b = f.get("startHour"), f.get("endHour")
    if a is not None and b is not None and not (a == 0 and b == 24):
        out.append("Bites between %s:00 and %s:00 Eorzea time" % (str(a).rstrip("0").rstrip(".") if isinstance(a, float) else a, str(b).rstrip("0").rstrip(".") if isinstance(b, float) else b))
    w = [FT_WEATHER.get(str(x), {}).get("name_en") for x in f.get("weatherSet") or []]
    pw = [FT_WEATHER.get(str(x), {}).get("name_en") for x in f.get("previousWeatherSet") or []]
    if w: out.append("Weather: " + ", ".join(x for x in w if x) + (" (after " + ", ".join(x for x in pw if x) + ")" if pw else ""))
    path = [ft_name(x) for x in f.get("bestCatchPath") or []]
    if len(path) > 1: out.append("Bait chain: " + " → ".join(x for x in path if x))
    elif path and path[0]: out.append("Best bait: " + path[0])
    pred = [str(n) + "× " + ft_name(x) for x, n in (f.get("predators") or [])]
    if pred: out.append("First catch " + ", ".join(pred) + " for Fisher's Intuition")
    extra = [x for x, on in (("Fish Eyes", f.get("fishEyes") is True), ("Snagging", f.get("snagging"))) if on]
    if f.get("folklore"):
        extra.append("needs the folklore book " + ((FT_FOLK.get(str(f["folklore"])) or {}).get("book_en") or ""))
    if extra: out.append("Also: " + ", ".join(extra))
    return out
SPOTS = {s["id"]: s for s in tc("fishing-spots.json")}
FSRC, FPAR = tc("fishing-sources.json"), tc("fish-parameter.json")
HOOK = {1: "Precision Hookset", 2: "Powerful Hookset"}
TUG = {1: "medium (!!)", 2: "heavy (!!!)", 3: "light (!)"}
for key, g, e in each("fishing"):
    if key.startswith("fishingspots:"): continue
    lines = []
    for src in (FSRC.get(str(e.get("it"))) or [])[:2]:
        sp = SPOTS.get(src.get("spot"), {})
        zone = PLACE.get(i(sp.get("placeId")), "")
        bait = ITEM.get(i(src.get("bait")), "")
        lines.append((zone or "Fishing hole") + ((" (%.1f, %.1f)" % (sp["coords"]["x"], sp["coords"]["y"])) if sp.get("coords") else "") + (" · bait: " + bait if bait else "") + (" · " + TUG[src["tug"]] + " bite" if src.get("tug") in TUG else "") + (" · " + HOOK[src["hookset"]] if src.get("hookset") in HOOK else ""))
    lines += fish_extra(e.get("it"))
    put(key, lines[:7]); stats["fishing"] += 1

FT_SPEAR = FT.get("SPEARFISHING_SPOTS", {})
for key, g, e in each("spearfishing"):
    f = FT_FISH.get(str(e.get("it")))
    lines = []
    if f:
        sp = FT_SPEAR.get(str(f.get("location"))) or {}
        if sp.get("name_en"): lines.append("Spearfishing spot: " + sp["name_en"] + (" in " + g["t"] if g["t"] != "Other" else ""))
        if f.get("gig"): lines.append("Gig: " + str(f["gig"]))
        lines += fish_extra(e.get("it"))
    put(key, lines); stats["spearfishing"] += 1

# ---------------------------------------------------------------- achievements and titles
ACH = sheet("Achievement")
TITLE = {k: clean(r.get("Masculine")) for k, r in sheet("Title").items()}
for key, g, e in each("ach-"):
    r = ACH.get(e["i"], {})
    lines = [clean(r.get("Description")) or e.get("d", "")]
    if TITLE.get(i(r.get("Title"))): lines.append("Title: " + TITLE[i(r["Title"])])
    if ITEM.get(i(r.get("Item"))): lines.append("Reward: " + ITEM[i(r["Item"])])
    put(key, lines); stats["achievements"] += 1
for key, g, e in each("titles"):
    r = ACH.get(e.get("ach"), {})
    if r: put(key, ["From the achievement " + clean(r.get("Name")), clean(r.get("Description"))])

# ---------------------------------------------------------------- variant records
ROUTES = {norm(k): v for k, v in json.load(open(os.path.join(T, "data", "variant-routes.json"), encoding="utf-8")).items() if not k.startswith("_")}
for key, g, e in each("variantrecords"):
    r = ROUTES.get(norm(e["n"]))
    put(key, [(e.get("d") or g["t"]).replace("*", "") + ": " + (r or "finish the dungeon by the route that ends with this record")]); stats["variant records"] += 1
LORE = json.load(open(os.path.join(T, "data", "occult-lore.json"), encoding="utf-8"))["records"]
for key, g, e in each("oclore"):
    l = LORE.get(str(e["i"]))
    if l and l.get("unlocked"):
        u = re.sub(r"\s+for$", "", l["unlocked"])
        put(key, ["Unlocked by: " + u]); stats["occult records"] += 1
for key, g, e in each("societyranks"):
    put(key, ["Raise your reputation with the " + g["t"] + " through their daily quests (" + str(e.get("d", "")) + " reputation for this rank)" if e.get("d") else "Raise your reputation with the " + g["t"] + " through their daily quests", "Some ranks also need that society's rank quest"])

# ---------------------------------------------------------------- every other entry: a plain instruction from its own facts
def coords(txt):  # "Mor Dhona (x22,y6)" -> "Mor Dhona (22, 6)"
    return re.sub(r"\(x\s*([\d.]+)\s*,\s*y\s*([\d.]+)\)", r"(\1, \2)", txt or "")
def patchless(d):  # the checklist puts the patch last: "Standard element. · 6.1"
    parts = [x.strip() for x in str(d or "").split(" · ")]
    return [x for x in parts if x and not re.match(r"^\d+(\.\d+)?$", x)]
WKS = sheet("WKSMissionUnit") if os.path.exists(os.path.join(DM, "csv", "en", "WKSMissionUnit.csv")) else {}
FSPOT_BY_NAME = {}
for sp in SPOTS.values():
    nm = PLACE.get(i(sp.get("placeId")), "")
    if nm: FSPOT_BY_NAME.setdefault(norm(nm), sp)
SRC_LABEL = lambda src: "How to get it: " + "; ".join(src)
def fallback(sid, g, e):
    d = e.get("d") or ""
    bits = patchless(d)
    gt = g["t"]
    if sid == "cosmicmissions":
        r = WKS.get(e["i"], {})
        out = [(bits[0] if bits else "") + " mission on " + (bits[1] if len(bits) > 1 else gt.split(":")[0]) + ": take it from the mission board in Cosmic Exploration and complete it"]
        sv, gd = i(r.get("SilverStarRequirement")), i(r.get("GoldStarRequirement"))
        if sv or gd: out.append("Score %s for silver, %s for gold" % (format(sv, ","), format(gd, ",")))
        if i(r.get("MissionTime")): out.append("Time limit: " + str(round(i(r["MissionTime"]) / 60)) + " minutes")
        return out
    if sid == "cosmicrecords": return ["Cosmic Exploration record (" + gt + "): " + e["n"], "Shown in the Cosmic Exploration record book; its credits are paid when it is completed"]
    if sid in ("plate", "portraits"):
        how = [b for b in bits if not b.lower().startswith("standard element")]
        return ["How to get it: " + "; ".join(how)] if how else ["Standard element: available from the start (" + gt + ")"]
    if sid in ("relicweapons", "relictools"):
        job = bits[0] if bits else ""
        lv = bits[1] if len(bits) > 1 and bits[1].isdigit() else ""
        need = " · ".join(bits[2:] if lv else bits[1:])
        return [gt + ": " + job + (" (item level stage " + lv + ")" if lv else ""), ("Needs: " + need) if need else "Earlier stage of the same weapon or tool first"]
    if sid == "fishingspots":
        nm = re.sub(r"\s*\([\d.,\s]+\)\s*$", "", e["n"])
        sp = FSPOT_BY_NAME.get(norm(nm))
        out = ["Fishing hole" + ((" level " + bits[0]) if bits and bits[0].isdigit() else "") + " in " + (bits[-1] if bits else gt)]
        if sp:
            out[0] += " (%.1f, %.1f)" % (sp["coords"]["x"], sp["coords"]["y"])
            fish = [ITEM.get(f, "") for f in sp.get("fishes") or [] if ITEM.get(f)]
            if fish: out.append("Fish here: " + ", ".join(fish[:8]) + (" and more" if len(fish) > 8 else ""))
        out.append("Cast once at the hole to log it")
        return out
    if sid == "ttnpcs":
        where = coords(bits[0]) if bits else ""
        return ["Challenge " + e["n"] + " at " + where + (" in " + gt if gt and gt not in where else ""), ("Difficulty " + bits[1]) if len(bits) > 1 else "", ("Rules: " + bits[2]) if len(bits) > 2 else ""]
    if sid == "bluelog": return ["Clear " + e["n"] + " as a Blue Mage" + ((" (level " + bits[0] + ")") if bits and bits[0].isdigit() else "") + " to fill this Blue Mage log entry"]
    if sid == "mountspeed":
        if e.get("x") == "gone": return ["This zone has no such increase (the checklist lists none), so it is not counted"]
        return [("Unlocked by: " + "; ".join(bits)) if bits else "Unlocked by finishing this zone's story or its aether currents"]
    if sid == "masterbooks":
        who = coords(bits[0]) if bits else ""
        return ["Buy from " + who.replace(";", " in", 1) + ((" for " + " · ".join(bits[1:])) if len(bits) > 1 else ""), "Use the book to learn its recipes"]
    if sid == "folklore":
        who = coords(bits[0]) if bits else ""
        return ["Buy from " + who.replace(";", " in", 1) + ((" for " + " · ".join(bits[1:])) if len(bits) > 1 else ""), "Use it to see that region's legendary gathering or fishing spots"]
    if sid == "lostactions": return ["Comes from " + (bits[0] if bits else "a forgotten fragment") + ": appraise the fragment at the Bozjan Southern Front or Zadnor to get it"]
    if sid == "porters": return ["Talk to the chocobokeep at " + e["n"] + (" in " + bits[0] if bits else "") + " to register this porter stop"]
    if sid == "sharedfate": return [e["n"] + " (Shared FATE rank " + (bits[0] if bits else "") + ")", "Ranks rise as you complete FATEs in that zone; check them in the Shared FATE window"]
    if sid == "eurekalevel": return ["Reach elemental level " + e["n"] + " in " + (bits[0] if bits else "Eureka") + " by defeating monsters and notorious monsters there"]
    if sid == "bozjarank": return ["Reach resistance rank " + e["n"] + " in " + (bits[0] if bits else "Bozja") + " by completing skirmishes, critical engagements and duels there"]
    if sid == "oclevel": return ["Reach knowledge level " + e["n"] + " in the Occult Crescent (" + (bits[0] if bits else "") + ") by defeating monsters and completing events there"]
    if sid == "logos": return ["Logos action for " + (bits[0] if bits else "any role") + ": combine mnemes at the Logos Manipulator in Eureka Hydatos"]
    if sid in ("eurekaaeth", "bozjaaeth", "ocaeth"): return ["Attune to " + e["n"] + ((" (unlocks at level/rank " + bits[0] + ")") if bits and bits[0].isdigit() else "") + " in " + gt]
    if sid in ("eurekaduties", "bozjaduties", "ocduties"):
        return ["Field operation duty in " + gt + ((": needs level/rank " + bits[0]) if bits and bits[0].isdigit() else "")]
    if sid == "ocevents": return [(bits[0] if bits else "Event") + " in the Occult Crescent (" + gt.replace("The Occult Crescent: ", "").replace(" Events", "") + ")" + ((": " + bits[1]) if len(bits) > 1 else "")]
    if sid == "phantomjobs": return ["Unlocked by: " + "; ".join(bits)] if bits else ["Phantom job of the Occult Crescent"]
    if sid == "islebuild": return ["Island Sanctuary building" + ((": needs island " + bits[0].lower()) if bits else "") + "; build it from the Felicitous Furball's menu"]
    if sid == "islecraft": return ["Island Sanctuary workshop item; unlocked at island rank " + (bits[0] if bits else "?")]
    if sid == "isleanimals": return ["Rare animal on your Island Sanctuary" + ((": " + bits[0].lower() + " animal") if bits else "") + ((" at " + bits[1]) if len(bits) > 1 else "") + "; catch it with Makeshift Restraints (or Net for large ones)"]
    if sid == "isleitems": return ["Island Sanctuary material: gather it on your island (Isleventory)"]
    if sid == "islerank": return ["Island Sanctuary rank " + e["n"] + ((": unlocks " + bits[0]) if bits else "") + "; island experience comes from gathering, crafting and building there"]
    if sid == "gcranks": return ["Needs: " + "; ".join(bits)] if bits else ["Earn company seals and promote at your Grand Company"]
    if sid == "carnivale": return ["The Masked Carnivale stage " + (bits[0] if bits else "") + ": register at the Gold Saucer's Masked Carnivale counter as a Blue Mage and clear it"]
    if sid == "companionskills": return ["Chocobo companion " + (bits[0].lower() if bits else "skill") + ": learn it with a skill point from companion rank " + (bits[1] if len(bits) > 1 else "")]
    if sid == "companionrank": return ["Reach companion rank " + e["n"] + ((" (" + format(int(bits[0]), ",") + " experience)") if bits and bits[0].isdigit() else "") + " by fighting with your chocobo companion out"]
    if sid == "treasuremaps": return [(bits[0] if bits else "Treasure map") + ": decipher it, dig at the marked spot and open the coffer", "Maps come from gathering nodes (one a day per character) or the market board"]
    if sid == "novice": return ["Hall of the Novice exercise (from level " + (bits[0] if bits else "15") + "): talk to the instructor in the Hall of the Novice"]
    if sid == "trust": return ["Level " + e["n"] + " in Trust duties (" + d + ")", "Their level rises with experience from Trust runs"]
    if sid == "levels": return ["Unlocked by: " + coords(d)] if d else ["Level this class or job"]
    if sid == "mahjong": return [d] if d else []
    if sid == "deliveries": return ["Custom Delivery client: " + d.replace("Quest:", "unlocked by the quest").replace(" · ", "; ")] if d else []
    if sid == "collection": return ["Collection item" + ((" (" + " · ".join(bits) + ")") if bits else "") + ": shown in the Portable Archive or Yo-kai Medallium once obtained"]
    if sid == "spearfishing": return ["Caught by spearfishing" + (" in " + gt if gt != "Other" else "") + "; look for its shadow at the spearfishing holes there"]
    if sid.startswith("duty-"): return ["Duty (" + gt + ")"]
    if sid.startswith("hunt-"): return ["Hunt mark in " + gt]
    if e.get("src"): return [SRC_LABEL(e["src"])]
    if e.get("x") == "gone": return ["Not obtainable by players (a quest or duty vehicle in the game files, or removed), so it is not counted"]
    if sid in ("mounts", "minions", "emotes", "fashion", "facewear", "hairstyles", "barding", "orchestrion"): return ["No source recorded for it yet (FFXIV Collect lists none)"]
    if bits: return ["Details: " + " · ".join(coords(b) for b in bits)]
    return []
added = collections.Counter()
for s_ in data["sections"]:
    for g in s_["g"]:
        for e in g["e"]:
            k = s_["id"] + ":" + str(e["i"])
            if INFO.get(k): continue
            if e.get("src") and s_["id"] not in ("cards",): continue  # the window shows FFXIV Collect's "how to get it"
            lines = [l for l in fallback(s_["id"], g, e) if l]
            if lines: put(k, lines); added[s_["id"]] += 1
stats["plain instruction from the entry's own facts"] = sum(added.values())

with open(os.path.join(T, "data", "info.json"), "w", encoding="utf-8") as fh:
    json.dump(INFO, fh, ensure_ascii=False, separators=(",", ":"))
print(json.dumps({"entries with information": len(INFO), "of": sum(len(g["e"]) for s in data["sections"] for g in s["g"]), "by family": dict(stats), "bytes": os.path.getsize(os.path.join(T, "data", "info.json"))}, indent=1))
