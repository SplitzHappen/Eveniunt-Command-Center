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
for key, g, e in each("craft-"):
    r = RECIPE.get(e["i"])
    if not r: continue
    t = RLT.get(i(r["RecipeLevelTable"]), {})
    lines = ["Recipe level " + str(i(t.get("ClassJobLevel"))) + (" " + "★" * i(t.get("Stars")) if i(t.get("Stars")) else "")]
    need = [str(i(r[f"AmountIngredient[{n}]"])) + "× " + ITEM.get(i(r[f"Ingredient[{n}]"]), "") for n in range(8) if i(r[f"Ingredient[{n}]"]) and ITEM.get(i(r[f"Ingredient[{n}]"]))]
    if need: lines.append("Needs " + ", ".join(need[:6]))
    b = BOOK.get(i(r.get("SecretRecipeBook")))
    if b: lines.append("Learned from " + b)
    put(key, lines); stats["recipes"] += 1
NODES = tc("nodes.json", TJ)
by_item = collections.defaultdict(list)
for nid, n in NODES.items():
    for it in (n.get("items") or []) + (n.get("hiddenItems") or []):
        by_item[it].append(n)
for key, g, e in each("gather-"):
    ns = by_item.get(e.get("it"), [])
    lines, seen = [], set()
    for n in ns:
        zone = PLACE.get(i(n.get("zoneid")), "")
        if not zone or zone in seen: continue
        seen.add(zone)
        lines.append("Level %d node in %s (%.1f, %.1f)" % (n.get("level", 0), zone, n.get("x", 0), n.get("y", 0)) + (" · timed" if n.get("spawns") else "") + (" · legendary" if n.get("legendary") else ""))
        if len(lines) >= 3: break
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

with open(os.path.join(T, "data", "info.json"), "w", encoding="utf-8") as fh:
    json.dump(INFO, fh, ensure_ascii=False, separators=(",", ":"))
print(json.dumps({"entries with information": len(INFO), "of": sum(len(g["e"]) for s in data["sections"] for g in s["g"]), "by family": dict(stats), "bytes": os.path.getsize(os.path.join(T, "data", "info.json"))}, indent=1))
