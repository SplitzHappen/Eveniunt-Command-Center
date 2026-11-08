#!/usr/bin/env python3
"""Build data/info.json: for each entry, a few plain lines on how to get or do it (the tracker shows them in the window
that opens when the pointer rests on an entry's name, and in the entry's details).

  python3 -I tools/info.py <ffxiv-datamining checkout> <ffxiv-teamcraft libs/data/src/lib/json dir> <teamcraft json dir used by extract.py>

Run after tools/organize.py. Sources, all facts rather than prose:
  - the game sheets (xivapi/ffxiv-datamining, the pinned commit): quest givers, levels, prerequisites, unlocks,
    recipes, sightseeing conditions, map coordinates (Level + Map);
  - FFXIV Teamcraft's data files (MIT): NPC positions, FATE levels, monster positions, fishing holes with bait and
    hook, gathering nodes, levequest givers, aetheryte positions;
  - what the entries already carry (FFXIV Collect sources, achievement text, checklist details);
  - small facts files in data/ (duty unlocks, field operation triggers, elite marks, beasts, variant routes) restated in
    our own words from the Console Games Wiki, which publishes no licence, so none of its text is copied.
"""
import collections, csv, json, os, re, sys

if len(sys.argv) < 4:
    sys.exit(__doc__)
DM, TC, TJ = sys.argv[1:4]
FISHDATA = sys.argv[4] if len(sys.argv) > 4 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "fish-tracker.json")  # tools/fetch-fishdata.py
T = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
data = json.load(open(os.path.join(T, "data", "tracker-data.json"), encoding="utf-8"))

RAWDIR = os.environ.get("DM_RAW", "")  # optional: sheets fetched at the same commit but not checked out
def sheet(name):
    path = os.path.join(DM, "csv", "en", name + ".csv")
    if not os.path.exists(path) and RAWDIR: path = os.path.join(RAWDIR, name + ".csv")
    with open(path, encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    return {int(r[0]): dict(zip(rows[0], r)) for r in rows[1:] if r and r[0].isdigit()}
def tc(name, d=TC): return json.load(open(os.path.join(d, name), encoding="utf-8"))
def i(v):
    try: return int(v)
    except (TypeError, ValueError): return 0
def f(v):
    try: return float(v)
    except (TypeError, ValueError): return 0.0
clean = lambda s: " ".join(re.sub(r"[\ue000-\uf8ff]", "", re.sub(r"<[^>]+>", "", str(s or ""))).split())
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

QUEST_BY_NAME = {}
for qid_, nm_ in QNAME.items(): QUEST_BY_NAME.setdefault(norm(nm_), qid_)
def sheet_sub(name):  # sheets with sub-rows ("12.0", "12.1")
    path = os.path.join(DM, "csv", "en", name + ".csv")
    if not os.path.exists(path) and RAWDIR: path = os.path.join(RAWDIR, name + ".csv")
    if not os.path.exists(path): return []
    with open(path, encoding="utf-8-sig") as f_:
        rows = list(csv.reader(f_))
    return [dict(zip(rows[0], r)) for r in rows[1:] if r and re.match(r"^\d+\.\d+$", r[0])]
def hhmm(h):  # 9.5 -> "09:30"
    h = float(h); return "%02d:%02d" % (int(h), round((h - int(h)) * 60))
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
    name = name[:1].upper() + name[1:]
    if not p: return name
    zone = PLACE.get(i(p.get("zoneid")), "")
    return name + (" in " + zone if zone else "") + (" (%.1f, %.1f)" % (p["x"], p["y"]) if p.get("x") else "")

INFO = {}
def put(key, lines, limit=6):
    lines = [l for l in lines if l]
    if lines: INFO[key] = lines[:limit]
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
# the quest's own journal text (csv/en/quest/<nnn>/<Id>.csv): its summary and its objectives, in order
QFILE = {}
for root_, _, files_ in os.walk(os.path.join(DM, "csv", "en", "quest")):
    for f_ in files_:
        if f_.endswith(".csv"): QFILE[f_[:-4].lower()] = os.path.join(root_, f_)
def journal(qid):
    r = Q.get(qid) or {}
    path = QFILE.get(str(r.get("Id", "")).lower())
    if not path: return "", []
    seq, todo = {}, {}
    with open(path, encoding="utf-8-sig") as fh:
        for row in csv.reader(fh):
            if len(row) < 3 or not row[2].strip(): continue
            m = re.search(r"_(SEQ|TODO)_(\d+)$", row[1])
            if not m: continue
            txt = re.split(r"\s*※", clean(row[2].replace("**", "")))[0].strip()
            txt = re.sub(r"\s*Quest Sync\b.*$", "", txt).strip()
            if not txt or txt.lower() in ("quest sync",): continue
            (seq if m.group(1) == "SEQ" else todo)[int(m.group(2))] = txt
    steps = []
    for n_ in sorted(todo):
        t_ = todo[n_]
        if not steps or steps[-1] != t_: steps.append(t_)
    return seq.get(0, ""), steps
qsteps = 0
for key, g, e in each("quests-"):
    summary, steps = journal(e["i"])
    lines = quest_lines(e["i"])
    if summary: lines.insert(0, summary)
    if steps:
        qsteps += 1
        if len(steps) > 9: steps = steps[:8] + ["… then " + steps[-1][0].lower() + steps[-1][1:]]
        lines += ["Step %d: %s" % (n_ + 1, t_) for n_, t_ in enumerate(steps)]
    put(key, lines, 16); stats["quests"] += 1
stats["quests with their journal steps"] = qsteps

# ---------------------------------------------------------------- duties (and the Crucible's boards)
CONTENT_OF = {cid: i(r.get("Content")) for cid, r in CFC.items() if i(r.get("ContentLinkType")) == 1}
_du = os.path.join(T, "data", "duty-unlocks.json")
DUTY_UNLOCK = json.load(open(_du, encoding="utf-8")).get("unlocks", {}) if os.path.exists(_du) else {}
_df = json.load(open(os.path.join(T, "data", "duty-facts.json"), encoding="utf-8"))
DUTY_FACTS, DUTY_RULES = {norm(k): v for k, v in _df["facts"].items()}, _df["rules"]
PLAYED_IN = {}  # a solo duty is played inside a quest: InstanceContent -> that quest
QB_QUEST = {}   # quest battles: QuestBattle -> its quest
for qid_, r_ in Q.items():
    if not QNAME.get(qid_): continue
    for n_ in range(50):
        ins = r_.get(f"QuestParams[{n_}].ScriptInstruction") or ""
        if ins.startswith("INSTANCEDUNGEON"): PLAYED_IN.setdefault(i(r_.get(f"QuestParams[{n_}].ScriptArg")), qid_)
        elif ins.startswith("QUESTBATTLE"): QB_QUEST.setdefault(i(r_.get(f"QuestParams[{n_}].ScriptArg")), qid_)
def quest_ref(q, verb="Unlocked by the quest "):
    who = npc_where(i(Q[q].get("IssuerStart")))
    lv = i(Q[q].get("ClassJobLevel[0]"))
    inner = ", ".join(x for x in (who, ("level " + str(lv)) if lv > 1 else "") if x)
    return verb + QNAME.get(q, "") + ((" (" + inner + ")") if inner else "")
def duty_lines(cid, e):
    r = CFC.get(cid, {})
    out = []
    name = clean(r.get("Name")) or (e or {}).get("n", "")
    lv, il = i(r.get("ClassJobLevelRequired")), i(r.get("ItemLevelRequired"))
    if lv: out.append("Level " + str(lv) + (" · item level " + str(il) if il else ""))
    m = re.match(r"^(.*) - Turn (\d+)$", name)
    if m and int(m.group(2)) > 1:
        out.append("Unlocked by clearing " + m.group(1) + " - Turn " + str(int(m.group(2)) - 1))
    base = re.sub(r"\s*\((Floors|Stones) \d+-\d+\)$", "", name)
    fl = re.search(r"\((?:Floors|Stones) (\d+)-\d+\)$", name)
    fact = DUTY_FACTS.get(norm(name)) or DUTY_FACTS.get(norm(base)) or {}
    q = None
    if i(r.get("ContentLinkType")) == 1:
        q = unlock_by_content.get(CONTENT_OF.get(cid)) or (DUTY_UNLOCK.get(str(cid)) if DUTY_UNLOCK.get(str(cid)) in Q else None)
    if not q and fact.get("quest"): q = QUEST_BY_NAME.get(norm(fact["quest"]))
    if q and not (m and int(m.group(2)) > 1):
        out.append(quest_ref(q))
    elif fact.get("quest") and not q and not m:
        out.append("Unlocked by the quest " + fact["quest"])
    if not q and i(r.get("ContentLinkType")) == 1 and (QB_QUEST.get(CONTENT_OF.get(cid)) or PLAYED_IN.get(CONTENT_OF.get(cid))):
        out.append(quest_ref(QB_QUEST.get(CONTENT_OF.get(cid)) or PLAYED_IN[CONTENT_OF[cid]], "Played during the quest "))
    if not q and i(r.get("ContentLinkType")) == 5 and QB_QUEST.get(i(r.get("Content"))):
        out.append(quest_ref(QB_QUEST[i(r["Content"])], "Played during the quest "))
    if fact.get("unlock"): out.append(fact["unlock"])
    if fl and int(fl.group(1)) > 1: out.append(DUTY_RULES["floors"])
    if fact.get("entrance"): out.append("Entrance: " + fact["entrance"])
    if fact.get("note") and (not fl or int(fl.group(1)) == 1): out.append(fact["note"])
    low = name.lower()
    if low.startswith("crystalline conflict (custom"): out.append(DUTY_RULES["custom"])
    elif low in ("the palaistra", "the volcanic heart", "cloud nine", "the clockwork castletown", "the red sands", "the bayside battleground", "archeia harmonias"): out.append(DUTY_RULES["crystalline"])
    elif re.search(r"\((seize|secure|shatter|danshig naadam|triumph)\)$", low): out.append(DUTY_RULES["frontline"])
    elif low in ("astragalos", "hidden gorge"): out.append(DUTY_RULES["rivalwings"])
    return out
DUTY_NAMES = {clean(r.get("Name")).lower(): cid for cid, r in CFC.items() if clean(r.get("Name")) and i(r.get("ContentLinkType")) == 1}
for key, g, e in each("duty-"):
    lines = duty_lines(e["i"], e)
    if key.startswith("duty-guildhests:") and not any(l.startswith("Unlocked") for l in lines): lines.append(DUTY_RULES["guildhest"])
    m = re.match(r"^(.*) \(Savage\)$", e["n"])
    if m and not any(l.startswith("Unlocked") for l in lines) and DUTY_NAMES.get(m.group(1).lower()):
        lines.append("Unlocked by clearing the normal " + m.group(1))
    put(key, lines); stats["duties"] += 1
BESTIARY = json.load(open(os.path.join(T, "data", "bestiary.json"), encoding="utf-8"))["beasts"]
for key, g, e in each("beastmaster"):
    if g["t"] == "Crucible of the Unbroken": put(key, duty_lines(e["i"], e))
    else:
        b_ = BESTIARY.get(e["n"]) or BESTIARY.get(e["n"].capitalize()) or {}
        lines = []
        if b_.get("from"): lines.append("Tame it from a " + b_["from"] + (" in " + b_["where"] if b_.get("where") else "") + " as a Beastmaster" + ((" of level " + b_["level"] + " or higher") if b_.get("level") else ""))
        elif b_.get("level"): lines.append("Beastmaster level " + b_["level"])
        if b_.get("gourd") and b_["gourd"] not in ("—", "-"): lines.append("Needs: " + b_["gourd"])
        if b_.get("class"): lines.append("Beast class: " + b_["class"])
        if not lines and e.get("d"): lines = ["Found in " + e["d"]]
        put(key, lines)

# ---------------------------------------------------------------- FATEs, hunt marks, hunting log
FATES = tc("fates.json")
FATE_ROW = sheet("Fate")
FATE_KIND = {60721: "Slay enemies: defeat the waves of enemies until the progress bar is full",
             60722: "Boss FATE: defeat the named enemy (it hits hard; join with others if you can)",
             60723: "Collect and deliver: take the items from enemies or objects around the FATE and hand them to the NPC",
             60724: "Defend: keep the NPCs or objects alive while waves of enemies attack",
             60725: "Escort: keep the NPC alive while it walks to its destination; enemies ambush on the way",
             60852: "Eureka notorious monster: it appears after the trigger enemy below is defeated",
             60858: "Restoration stage of the Firmament or a city event stage",
             63914: "Bozja skirmish: defeat the enemies", 63915: "Bozja skirmish against a boss"}
FIELD_EVENTS = json.load(open(os.path.join(T, "data", "field-events.json"), encoding="utf-8"))["events"]
def field_lines(name):
    ev = FIELD_EVENTS.get(name)
    if not ev: return []
    out = []
    if ev.get("boss"): out.append(("Notorious monster: " if ev.get("kind") == "NM" else "Boss: ") + ev["boss"] + ((" (weak to " + ev["weak"] + ")") if ev.get("weak") else ""))
    sp = ev.get("spawn", "")
    if sp and sp.lower() != "automatic": out.append("Spawns after you defeat " + sp + ((" (needs " + ev["light"] + ")") if ev.get("light") else ""))
    elif sp.lower() == "automatic": out.append("Spawns by itself (no trigger enemy); on a cooldown")
    at = re.sub(r"\(\s*X:\s*([\d.]+),\s*Y:\s*([\d.]+)\)", r"(\1, \2)", ev.get("at", ""))
    if at: out.append("Location: " + ev["area"] + " " + at)
    return out
for key, g, e in each("fates-"):
    fa = FATES.get(str(e["i"]), {})
    fr = FATE_ROW.get(e["i"], {})
    lines = []
    kind = FATE_KIND.get(i(fr.get("Icon")))
    obj = clean(fr.get("Objective"))
    if obj.lower().startswith("checking contributions"):
        lines.append("Ishgardian Restoration stage in the Firmament: it advanced as crafters and gatherers turned in Skybuilders' items; only Disciples of the Hand or the Land take part and get rewards")
    elif obj: lines.append("Objective: " + obj)
    elif kind: lines.append(kind)
    lines += field_lines(e["n"])
    if fa.get("level"): lines.append("Level " + str(fa["level"]) + " FATE" + ("" if g["t"].startswith("Not placed") else " in " + g["t"]))
    where = level_where(i(fa.get("location")))
    if where and not field_lines(e["n"]): lines.append("Appears at " + where)
    put(key, lines); stats["fates"] += 1
MON = tc("monsters.json")
sheet_bnpc_early = sheet("BNpcName")
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
            out.append(verb + " in " + zone + " (%.1f, %.1f)" % (p["x"], p["y"]) + ((", level %d" % p["level"]) if p.get("level") else ""))
            if len(out) >= 3: return out
    return out
ELITE = {norm(k): v for k, v in json.load(open(os.path.join(T, "data", "elite-marks.json"), encoding="utf-8"))["marks"].items()}
MHT = sheet("MobHuntTarget")
BILL = collections.defaultdict(list)  # BNpcName -> [(bill name, kills)]
_mho = {}
for r_ in sheet_sub("MobHuntOrder"):
    a_, b_ = r_["#"].split("."); _mho[(int(a_), int(b_))] = r_
EVITEM = sheet("EventItem")
for k_, t_ in sheet("MobHuntOrderType").items():
    ev_ = EVITEM.get(i(t_.get("EventItem")), {})
    bill = clean(ev_.get("Name") or ev_.get("Singular") or "")
    if not bill: continue
    for n_ in range(i(t_.get("OrderAmount"))):
        for sub in range(6):
            r_ = _mho.get((i(t_.get("OrderStart")) + n_, sub))
            if not r_: break
            tg = MHT.get(i(r_.get("Target")), {})
            if i(tg.get("Name")): BILL[i(tg["Name"])].append((bill, i(r_.get("NeededKills")), PLACE.get(i(MAP.get(i(tg.get("Map")), {}).get("PlaceName")), ""), i(t_.get("Quest")), i(t_.get("Type"))))
BILL_BY_NAME = {}
for k_, r_ in sheet_bnpc_early.items():
    if k_ in BILL and clean(r_.get("Singular")): BILL_BY_NAME.setdefault(norm(r_["Singular"]), BILL[k_])
for key, g, e in each("hunt-"):
    lines = mon_lines([e["i"]] + list(e.get("al") or [])) or mon_lines(BNPC.get(norm(e["n"]), []))
    el = ELITE.get(norm(e["n"]))
    if el:
        head = el["rank"] + " rank elite mark in " + el["area"]
        lines = [head] + ([("Spawns when: " + el["spawn"])] if el.get("spawn") and el["spawn"].lower() != "none" else []) + ([("Respawn: " + el["respawn"] + ("" if "hour" in el["respawn"].lower() or "second" in el["respawn"].lower() else " hours"))] if el.get("respawn") else []) + lines
    elif g["t"] == "Hunt bill marks":
        bl = BILL.get(e["i"]) or BILL_BY_NAME.get(norm(e["n"])) or []
        if bl:
            bills = list(dict.fromkeys(("daily " if t == 1 else "weekly " if t == 2 else "") + b for b, _, _, _, t in bl))
            zone = next((z for _, _, z, _, _ in bl if z), "")
            uq = next((q for _, _, _, q, _ in bl if q in Q), None)
            head = "On the " + " and ".join(bills[:2]) + ((": defeat " + str(bl[0][1])) if bl[0][1] > 1 else "") + ((" in " + zone) if zone else "")
            if zone: lines = [l for l in lines if zone in l]
            lines = [head, ("Those bills come from the Hunt board once you finish the quest " + QNAME[uq] + " (" + npc_where(i(Q[uq].get("IssuerStart"))) + ")") if uq else "Those bills come from the Hunt board of your Grand Company",
                     "The mark only counts while the bill is in your inventory"] + lines
        else:
            lines = ["Hunt bill mark: take the matching daily or weekly bill from the Hunt board; the mark only counts while the bill is in your inventory"] + lines
    put(key, lines); stats["hunt"] += 1
NOTE_AT = {}
for r_ in sheet("MonsterNoteTarget").values():
    nm_ = clean(sheet_bnpc_early.get(i(r_.get("BNpcName")), {}).get("Singular"))
    if not nm_: continue
    at = []
    for n_ in range(3):
        z, loc = PLACE.get(i(r_.get(f"PlaceNameZone[{n_}]")), ""), PLACE.get(i(r_.get(f"PlaceNameLocation[{n_}]")), "")
        if z: at.append(z + ((", " + loc) if loc and loc != z else ""))
    if at: NOTE_AT.setdefault(norm(nm_), list(dict.fromkeys(at)))
for key, g, e in each("hunting"):
    at = NOTE_AT.get(norm(e["n"]), [])
    head = "Defeat " + str(e.get("cnt", 1)) + ((" in " + "; or ".join(at[:3])) if at else "")
    put(key, [head] + mon_lines(BNPC.get(norm(e["n"]), []))); stats["hunting log"] += 1

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
    items = [str(x.get("amount", 1)) + "× " + ITEM.get(i(x.get("itemId")), "") for x in lv.get("items") or [] if ITEM.get(i(x.get("itemId")))]
    if items: lines.append("Deliver " + ", ".join(items) + " (HQ items pay more)")
    elif ((lv.get("job") or {}).get("en") or "").startswith("Disciples of War"): lines.append("Battle levequest: accept it, go to the marked area, start it there and defeat the targets")
    elif ((lv.get("job") or {}).get("en") or "") in ("Miner", "Botanist", "Fisher"): lines.append("Gathering levequest: accept it, go to the marked area, start it there and gather the requested items from the special nodes that appear")
    rw = [x for x in ((format(lv["gilReward"], ",") + " gil") if lv.get("gilReward") else "", (format(lv["expReward"], ",") + " experience") if lv.get("expReward") else "") if x]
    if rw or lv.get("cost"): lines.append("Costs " + str(lv.get("cost") or 1) + " leve allowance" + ("s" if (lv.get("cost") or 1) > 1 else "") + ("; rewards " + ", ".join(rw) if rw else ""))
    put(key, lines); stats["leves"] += 1

# ---------------------------------------------------------------- crafting, gathering, fishing
# ---------------------------------------------------------------- where an item comes from (FFXIV Teamcraft, MIT)
def tcx(name):
    try: return tc(name)
    except FileNotFoundError: return {}
SHOPS = tcx("shops.json") or []
DROPS, INST_SRC, QUEST_SRC = tcx("drop-sources.json"), tcx("instance-sources.json"), tcx("quest-sources.json")
MOG, VENTURE, FATE_SRC = tcx("mogstation-sources.json"), tcx("venture-sources.json"), tcx("fate-sources.json")
DESYNTH, REDUCTION = tcx("desynth.json"), tcx("reduction.json")
INSTANCES = tcx("instances.json")
FATENAME = {k: (v.get("name") or {}).get("en") for k, v in tc("fates.json").items()}
SOLD = collections.defaultdict(list)  # item -> [(npc id, [(currency, amount)])]
for sh in SHOPS:
    for tr in sh.get("trades") or []:
        cur = [(c["id"], c.get("amount", 0)) for c in tr.get("currencies") or []]
        for it in tr.get("items") or []:
            SOLD[it["id"]].append((sh.get("npcs") or [], cur))
def price(cur):
    return " + ".join(format(a, ",") + " " + ("gil" if c == 1 else (ITEM.get(c) or "?")) for c, a in cur) if cur else ""
def npc_short(npc_id):
    n = NPCS.get(str(npc_id))
    if not n: return ""
    p = n.get("position") or {}
    zone = PLACE.get(i(p.get("zoneid")), "")
    return (n.get("en") or "") + ((" in " + zone) if zone else "") + ((" (%.1f, %.1f)" % (p["x"], p["y"])) if p.get("x") else "")
def item_sources(it, limit=4):
    """Plain lines on where an item comes from, most useful first."""
    out = []
    seen_npc = set()
    for npcs, cur in SOLD.get(it, []):
        for nid in npcs:
            w = npc_short(nid)
            if w and w not in seen_npc:
                seen_npc.add(w); out.append("Sold by " + w + ((" for " + price(cur)) if cur else ""))
                break
        if len(seen_npc) >= 2: break
    duties = [INSTANCES.get(str(x), {}).get("en") for x in INST_SRC.get(str(it), [])]
    duties = [d_ for d_ in dict.fromkeys(duties) if d_]
    if duties: out.append("Drops in " + ", ".join(duties[:4]) + (" and more" if len(duties) > 4 else ""))
    mons = []
    for m in DROPS.get(str(it), [])[:6]:
        nm = clean(sheet_bnpc.get(i(m), {}).get("Singular"))
        if nm: mons.append(nm)
    if mons: out.append("Dropped by " + ", ".join(dict.fromkeys(mons)))
    qs = [QNAME.get(i(q)) for q in QUEST_SRC.get(str(it), [])]
    qs = [q for q in dict.fromkeys(qs) if q]
    if qs: out.append("Reward from the quest " + ", ".join(qs[:3]))
    fs = [FATENAME.get(str(x)) for x in FATE_SRC.get(str(it), [])]
    fs = [x for x in dict.fromkeys(fs) if x]
    if fs: out.append("Reward from the FATE " + ", ".join(fs[:3]))
    if VENTURE.get(str(it)): out.append("Brought back by retainer ventures")
    ds = [ITEM.get(i(x)) for x in DESYNTH.get(str(it), [])][:3]
    if any(ds): out.append("Desynthesis of " + ", ".join(x for x in ds if x))
    rd = [ITEM.get(i(x)) for x in REDUCTION.get(str(it), [])][:3]
    if any(rd): out.append("Aetherial reduction of " + ", ".join(x for x in rd if x))
    mg = MOG.get(str(it))
    if mg: out.append("Mog Station (online store)" + ((" for about $" + str(mg.get("price"))) if isinstance(mg, dict) and mg.get("price") else ""))
    return out[:limit]
def short_source(it):
    """A two- or three-word tag for a recipe material."""
    if SOLD.get(it):
        cur = SOLD[it][0][1]
        return "vendor" + ((" " + price(cur)) if cur and len(price(cur)) < 28 else "")
    if INST_SRC.get(str(it)):
        d_ = INSTANCES.get(str(INST_SRC[str(it)][0]), {}).get("en")
        return "drop: " + d_ if d_ else "duty drop"
    if DROPS.get(str(it)):
        nm = clean(sheet_bnpc.get(i(DROPS[str(it)][0]), {}).get("Singular"))
        return "drop: " + nm if nm else "monster drop"
    if REDUCTION.get(str(it)): return "aetherial reduction"
    if DESYNTH.get(str(it)): return "desynthesis"
    if VENTURE.get(str(it)): return "venture"
    if QUEST_SRC.get(str(it)): return "quest reward"
    return ""
sheet_bnpc = sheet("BNpcName")
def trade_line(it):
    r = ITEMROW_ALL.get(it, {})
    if not r: return ""
    return "Untradable" if r.get("IsUntradable") == "True" else "Tradable: also sold by players on the market board"
ITEMROW_ALL = sheet("Item")

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
    return short_source(it)
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
        line += " · up at " + hrs + " Eorzea time" + ((" for %d hours" % (dur // 60) if dur % 60 == 0 else " for %d:%02d hours" % (dur // 60, dur % 60)) if dur else "")
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
        out.append("Bites between %s and %s Eorzea time" % (hhmm(a), hhmm(b)))
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
SPEAR_SRC = tcx("spearfishing-sources.json") if "tcx" in globals() else {}
try:
    SPEAR_ITEM = {i(r_.get("Item")): r_ for r_ in sheet("SpearfishingItem").values()}
    SPEAR_NODE = sheet("SpearfishingNotebook")
    TT = sheet("TerritoryType")
except FileNotFoundError:
    SPEAR_ITEM, SPEAR_NODE, TT = {}, {}, {}
SIZE = {1: "small", 2: "average", 3: "large"}
SPEED = {1: "slow", 2: "average", 3: "fast", 4: "very fast", 5: "lightning fast"}
def spear_lines(it):
    out = []
    nb = SPEAR_NODE.get(i(SPEAR_ITEM.get(it, {}).get("SpearfishingNotebook")), {})
    if nb:
        m_ = MAP.get(i(TT.get(i(nb.get("TerritoryType")), {}).get("Map")), {})
        num = lambda v: float(v) if str(v or "").replace(".", "", 1).lstrip("-").isdigit() else 0.0
        sf = num(m_.get("SizeFactor")) or 100.0
        x, y = 41.0 / (sf / 100.0) * num(nb.get("X")) / 2048.0 + 1, 41.0 / (sf / 100.0) * num(nb.get("Y")) / 2048.0 + 1
        out.append("Spearfishing hole " + PLACE.get(i(nb.get("PlaceName")), "") + " in " + PLACE.get(i(TT.get(i(nb.get("TerritoryType")), {}).get("PlaceName")), "") + " (%.1f, %.1f), level %d" % (x, y, i(nb.get("GatheringLevel"))) + (" (a hidden hole that appears after a successful catch)" if nb.get("IsShadowNode") == "True" else ""))
    for sr in (SPEAR_SRC.get(str(it)) or [])[:1]:
        sz, spd = SIZE.get(sr.get("shadowSize"), ""), SPEED.get(sr.get("speed"), "")
        if sz or spd: out.append("Its shadow: " + ", ".join(x for x in ((sz + " size") if sz else "", (spd + " speed") if spd else "") if x))
        pr = [str(x.get("amount")) + "× " + ITEM.get(i(x.get("id")), "") for x in sr.get("predators") or [] if ITEM.get(i(x.get("id")))]
        if pr: out.append("Spear " + ", ".join(pr) + " first to make it appear")
    return out
for key, g, e in each("spearfishing"):
    f = FT_FISH.get(str(e.get("it")))
    lines = spear_lines(e.get("it"))
    if f:
        sp = FT_SPEAR.get(str(f.get("location"))) or {}
        if sp.get("name_en") and not lines: lines.append("Spearfishing spot: " + sp["name_en"] + (" in " + g["t"] if g["t"] != "Other" else ""))
        if f.get("gig") and str(f["gig"]).upper() != "UNKNOWN": lines.append("Gig: " + str(f["gig"]))
        lines += fish_extra(e.get("it"))
    put(key, lines); stats["spearfishing"] += 1

# ---------------------------------------------------------------- collections: who sells it and where, what drops it, market board
ACH_BY_NAME = {norm(clean(r.get("Name"))): r for r in sheet("Achievement").values() if clean(r.get("Name"))}
QUEST_BY_NAME = {}
for qid_, nm_ in QNAME.items(): QUEST_BY_NAME.setdefault(norm(nm_), qid_)
CFC_BY_NAME = {}
for cid_, r_ in CFC.items():
    if clean(r_.get("Name")) and i(r_.get("ContentLinkType")) == 1: CFC_BY_NAME.setdefault(norm(clean(r_["Name"])), cid_)
TT_NPC = {}
for s_ in data["sections"]:
    if s_["id"] == "ttnpcs":
        for g_ in s_["g"]:
            for e_ in g_["e"]: TT_NPC[norm(e_["n"])] = (g_["t"], e_.get("d", ""))
DUTY_TYPES = ("dungeon", "trial", "raid", "alliance raid", "ultimate raid", "deep dungeon", "variant dungeon", "criterion dungeon", "guildhest", "pvp", "treasure hunt", "quest battle")
NPC_BY_NAME = collections.defaultdict(list)
for k_, n_ in NPCS.items():
    if n_.get("en") and (n_.get("position") or {}).get("x"): NPC_BY_NAME[norm(n_["en"])].append(k_)
def npc_at(name, hint=""):
    ids = NPC_BY_NAME.get(norm(name), [])
    if not ids: return ""
    for k_ in ids:
        z = PLACE.get(i(NPCS[k_]["position"].get("zoneid")), "")
        if hint and z and (norm(z) in norm(hint) or norm(hint) in norm(z)): return npc_where(k_)
    return npc_where(ids[0])
FATE_BY_NAME = {}
for k_, v_ in tc("fates.json").items():
    nm_ = (v_.get("name") or {}).get("en")
    if nm_: FATE_BY_NAME.setdefault(norm(nm_), v_)
def fate_at(name):
    v_ = FATE_BY_NAME.get(norm(name))
    if not v_: return ""
    w_ = level_where(i(v_.get("location")))
    return "FATE “" + name + "”" + ((" (level " + str(v_["level"]) + ")") if v_.get("level") else "") + ((" at " + w_) if w_ else "")
RANK_NAME = {1: "Neutral", 2: "Recognized", 3: "Friendly", 4: "Trusted", 5: "Respected", 6: "Honored", 7: "Sworn", 8: "Allied or Bloodsworn"}
def vendor_line(what, verb="Buy from "):
    """'NPC - Place (Zone) - price (Rank 4)' -> 'Buy from NPC in Zone (x, y) for price'."""
    tail = re.findall(r"\((Requires[^)]*|Rank \d+)\)", what)
    core = re.sub(r"\s*\((Requires[^)]*|Rank \d+)\)", "", what).strip()
    parts = [x.strip() for x in re.split(r"\s+-\s+", core)]
    if len(parts) < 2: return ""
    price = parts[-1] if re.match(r"^[\d,]+\s", parts[-1]) else ""
    rest = parts[:-1] if price else parts
    thing = ""
    if len(rest) >= 3 or (len(rest) == 2 and re.search(r"(Kit|Box|Set|Coffer|Token)s?$", rest[0])): thing, rest = rest[0], rest[1:]
    npc, hint = rest[0], " ".join(rest[1:])
    w_ = npc_at(npc, hint) or (npc + ((" in " + hint) if hint else ""))
    out = verb + w_ + ((" for " + price) if price else "")
    if thing: out = "Buy the " + thing + " from " + w_ + ((" for " + price) if price else "") + ", then use it from your inventory"
    for t_ in tail:
        m_ = re.match(r"Rank (\d+)", t_)
        if m_: out += "; needs rank " + m_.group(1) + " (" + RANK_NAME.get(int(m_.group(1)), "") + ") with that allied society"
        else:
            fm = re.search(r"“([^”]+)”|\"([^\"]+)\"", t_)
            fname = (fm.group(1) or fm.group(2)) if fm else ""
            out += "; only after you complete the " + (fate_at(fname) or ("FATE " + fname))
    return out
CRAFTER = {0: "Carpenter", 1: "Blacksmith", 2: "Armorer", 3: "Goldsmith", 4: "Leatherworker", 5: "Weaver", 6: "Alchemist", 7: "Culinarian"}
RECIPES_OF = collections.defaultdict(list)
for rid_, r_ in RECIPE.items():
    if i(r_.get("ItemResult")): RECIPES_OF[i(r_["ItemResult"])].append(r_)
def recipe_brief(it):
    rs = RECIPES_OF.get(it)
    if not rs: return []
    r_ = sorted(rs, key=lambda x: i(x.get("RecipeLevelTable")))[0]
    t_ = RLT.get(i(r_["RecipeLevelTable"]), {})
    mats = []
    for n_ in range(8):
        m_ = i(r_.get(f"Ingredient[{n_}]"))
        if m_ and ITEM.get(m_) and not CRYSTAL(m_):
            tag = source_tag(m_)
            mats.append(str(i(r_[f"AmountIngredient[{n_}]"])) + "× " + ITEM[m_] + (" (" + tag + ")" if tag else ""))
    out = ["Crafted by a " + CRAFTER.get(i(r_.get("CraftType")), "crafter") + " of level " + str(i(t_.get("ClassJobLevel"))) + (" " + "★" * i(t_.get("Stars")) if i(t_.get("Stars")) else "") + ((": " + ", ".join(mats[:5])) if mats else "")]
    bk = BOOK.get(i(r_.get("SecretRecipeBook")))
    if bk: out.append("The recipe comes from the book " + bk)
    return out
def item_named(name):
    return ITEM_BY_NAME_EARLY.get(norm(name))
ITEM_BY_NAME_EARLY = {}
for k_, v_ in ITEM.items(): ITEM_BY_NAME_EARLY.setdefault(norm(v_), k_)
def cfc_named(name):
    n_ = norm(name)
    if n_ in CFC_BY_NAME: return CFC_BY_NAME[n_]
    for k_, v_ in CFC_BY_NAME.items():
        if k_.startswith(n_) and len(k_) - len(n_) <= 8: return v_
    return None
RETAINER = {"woodland": "Botanist", "highland": "Miner", "waterside": "Fisher", "field": "combat"}
def expand_src(src, it=None):
    """Turn FFXIV Collect's short sources into what to actually do."""
    out = []
    for line in src:
        m = re.match(r"^([^:]+):\s*(.+)$", line)
        if not m: continue
        kind, what = m.group(1).strip().lower(), m.group(2).strip()
        name = re.split(r"\s+-\s+", what)[0].strip()
        parts = [x.strip() for x in re.split(r"\s+-\s+", what)]
        if kind == "achievement":
            if "Achievement Certificate" in what:
                out.append(vendor_line(what) + " (Jonathas hands out one certificate for every 50 achievement points)")
            else:
                r = ACH_BY_NAME.get(norm(name))
                if r and clean(r.get("Description")): out.append("Achievement “" + clean(r["Name"]) + "”: " + clean(r["Description"]))
        elif kind == "quest":
            q = QUEST_BY_NAME.get(norm(re.sub(r"\s*\(.*\)$", "", name)))
            if q: out.append(quest_ref(q, "Reward of the quest "))
        elif kind == "premium":
            if what == "Online Store": out.append("Sold on the Mog Station (the online store, paid with real money); claim it in game from a Calamity Salvager in any city")
            elif "Collector" in what: out.append("Bonus item of the " + what + ": register its code on the Mog Station, then claim it from a Calamity Salvager")
            elif what.lower().startswith("item code included with"): out.append("Comes with a code packed with " + what[len("item code included with"):].strip() + "; register the code on the Mog Station and claim the item from a Calamity Salvager")
            else: out.append("Promotion: " + what + "; claim it from a Calamity Salvager once the code or offer is registered on the Mog Station")
        elif kind == "event":
            if "yo-kai" in what.lower(): out.append("Yo-kai Watch collaboration event: trade Yo-kai Medals (from FATEs in A Realm Reborn, Heavensward and Stormblood zones while wearing the Yo-kai Watch) to Nohi in the Gold Saucer (5.2, 6.9); the event returns now and then (last run August to October 2026)")
            else: out.append("Seasonal event reward: " + what + ". Rewards of past events are usually sold later on the Mog Station (the online store)")
        elif kind == "crafting":
            rb = recipe_brief(it) if it else []
            dm = parts[1] if len(parts) > 1 else ""
            out += rb or ["Crafted by " + parts[0].replace("Crafted by ", "a ")]
            if dm: out.append("A key material for it comes from " + dm)
        elif kind == "npc":
            t = TT_NPC.get(norm(name))
            w_ = (t[0] + ((" at " + re.sub(r"\s*·.*$", "", t[1])) if t[1] else "")) if t else (npc_at(name) or "")
            out.append("Win it from " + (name + " in " + w_ if t else (w_ or name)) + " at Triple Triad (a chance to win it after each victory)")
        elif kind == "gold saucer":
            if re.match(r"^[\d,]+ MGP$", what): out.append("Buy it with " + what + " at the Gold Saucer's prize exchange")
            else:
                k_ = item_named(what)
                src_ = item_sources(k_)[:1] if k_ else []
                out.append("Random reward from a " + what + ((" (" + src_[0][0].lower() + src_[0][1:] + ")") if src_ else "") + " in the Gold Saucer")
        elif kind in ("deep dungeon",):
            dd = parts[0]; sacks = parts[1] if len(parts) > 1 else "treasure"
            fact = DUTY_FACTS.get(norm(dd)) or {}
            out.append("Found in " + sacks.lower().replace("/", " or ").replace(" sack", "") + " treasure coffers (sacks) on the floors of " + dd + ((" (unlocked by the quest " + fact["quest"] + ")") if fact.get("quest") else ""))
        elif kind == "treasure hunt":
            k_ = item_named(what)
            fact = DUTY_FACTS.get(norm(what)) or {}
            if k_ and "map" in what.lower():
                src_ = item_sources(k_)[:2]
                out.append("Comes from the coffer of a " + what + ": decipher the map, dig at the marked spot and open the coffer" + ((". Maps: " + "; ".join(x[0].lower() + x[1:] for x in src_)) if src_ else ""))
            elif fact.get("unlock"): out.append("Inside the treasure dungeon " + what + ": " + fact["unlock"][0].lower() + fact["unlock"][1:])
            else: out.append("Treasure hunt: " + what)
        elif kind == "occult crescent":
            if "Forked Tower" in what: out.append("From the " + (parts[1].lower() if len(parts) > 1 else "chest") + " of " + parts[0].replace("The Forked Tower", "the Forked Tower") + ", the 48-player raid inside the Occult Crescent")
            elif len(parts) > 1 and "Coffer" in parts[1]: out.append("Found in " + parts[1].lower().replace("/", " or ") + "s scattered around " + parts[0] + " in the Occult Crescent; open as many as you can")
            else: out.append("Occult Crescent: " + what)
        elif kind == "cosmic exploration":
            out.append("Cosmic Exploration reward: " + (parts[0] + " on " + parts[1] if len(parts) > 1 else what))
        elif kind == "skybuilders":
            if len(parts) >= 3: out.append(vendor_line(what) + " (Skybuilders' Scrips come from Ishgardian Restoration crafting and gathering)")
            else: out.append("Random reward from a " + what + " (Ishgardian Restoration, in the Firmament)")
        elif kind == "fate":
            fm = re.match(r'^FATE\s+["“](.+?)["”]\s*-\s*(.+)$', what)
            if fm: out.append("Reward of the " + (fate_at(fm.group(1)) or ("FATE " + fm.group(1) + " in " + fm.group(2))))
            else: out.append(vendor_line(what))
        elif kind in ("tribal", "hunts", "gathering", "beastmaster", "chaotic raid") and len(parts) >= 3:
            out.append(vendor_line(what))
        elif kind == "purchase" and len(parts) >= 2:
            out.append(vendor_line(what))
        elif kind == "pvp":
            pm = re.match(r"PvP Series (\d+) - Level (\d+)", what)
            if pm: out.append("Reward for reaching level " + pm.group(2) + " of PvP Series " + pm.group(1) + " (Series Malmstones: any PvP match during that series gives series experience)")
            elif not re.match(r"^[\d,]+ Wolf Marks$", what) and not re.match(r"^[\d,]+ Trophy Crystals$", what): out.append("PvP: " + what)
        elif kind == "bozja":
            if "Lockbox" in what: out.append("Open a " + what.replace(" / ", " or a ") + " from your inventory; lockboxes drop from skirmishes and critical engagements there")
        elif kind == "eureka":
            if "Happy Bunny" in what: out.append("Follow a Happy Bunny (from the bunny FATEs) in " + (parts[1] if len(parts) > 1 else "Eureka") + " to its buried coffer; the coffer can hold it")
            elif "Lockbox" in what: out.append("Open a " + what + " from your inventory; they drop from enemies and notorious monsters in that part of Eureka")
        elif kind == "voyages":
            out.append("Brought back by your Free Company's submersibles sent to " + (parts[1] if len(parts) > 1 else what) + " (needs a Free Company workshop)")
        elif kind == "venture":
            rt = RETAINER.get(what.split()[0].lower(), "")
            out.append("Send a " + (rt + " " if rt else "") + "retainer on the venture " + what + "; it can bring this back")
        elif kind == "wondrous tails":
            out.append("Wondrous Tails reward: buy it for " + what + " from the Idyllshire vendors (Faux Leaves come from Faux Hollows, the unreal trial minigame)")
        elif kind == "other":
            out.append(what)
        elif kind == "island sanctuary":
            pass  # the vendor line below names the seller and price
        if (kind in DUTY_TYPES or kind.startswith("blue mage") or kind in ("v&c dungeon", "chaotic raid", "bozja", "eureka", "occult crescent", "beastmaster")) and kind not in ("treasure hunt", "deep dungeon"):
            if kind == "blue mage" and "Masked Carnivale" in what:
                out.append("As a Blue Mage, learn it from " + parts[0] + " in " + parts[-1].replace("The Masked Carnivale", "Masked Carnivale stage").replace("#", "") + " (talk to the Celestium Attendant in Ul'dah - Steps of Thal)")
                continue
            if kind == "blue mage" and len(parts) > 1 and re.search(r"\(\d", parts[-1]):
                out.append("As a Blue Mage, defeat " + parts[0] + " in " + parts[-1] + " after it uses the move on you (not guaranteed every time)")
                continue
            duty = next((x for x in reversed(parts) if cfc_named(x)), None)
            boss = parts[0] if duty and parts[0] != duty else ""
            c = cfc_named(duty) if duty else None
            if c:
                dl = duty_lines(c, {})
                out.append(("Defeat " + boss + " in " if boss else "Drops in ") + clean(CFC[c]["Name"]) + (" (" + "; ".join(dl[:2]) + ")" if dl else ""))
    return [x for x in dict.fromkeys(out) if x][:4]
COLLECTION_LISTS = ("mounts", "minions", "orchestrion", "emotes", "hairstyles", "barding", "fashion", "facewear", "cards", "armoire", "outfits")
for key, g, e in each("bluemagic"):
    lines = expand_src(e.get("src") or [])
    lines.append("To learn it: be a Blue Mage, let the enemy use the move on you, then win; it is a chance, not a certainty, so repeat if needed")
    if e.get("rank"): lines.append("Spell rank " + "★" * int(e["rank"]))
    if lines: put(key, lines); stats["blue magic"] += 1
for sid_ in COLLECTION_LISTS:
    for key, g, e in each(sid_):
        if not key.startswith(sid_ + ":"): continue
        ex = expand_src(e.get("src") or [], e.get("it"))
        if not e.get("it"):
            if ex: ex[0] = "How to obtain: " + ex[0]
            if ex: put(key, ex); stats["collections with item sources"] += 1
            continue
        lines = ex + [l for l in item_sources(e["it"]) if not (l.startswith("Sold by") and any(x.startswith(("Buy ", "Buy it")) for x in ex))
                      and not (l.startswith("Drops in") and any(x.startswith(("Drops in", "Defeat ")) for x in ex))]
        mog = [l for l in lines if l.startswith("Mog Station (online store)")]
        if mog and any(l.startswith("Sold on the Mog Station") for l in lines):
            pr = re.search(r"about \$[\d.]+", mog[0])
            lines = [(l.replace("(the online store, paid with real money)", "(the online store, " + pr.group(0) + ")") if pr and l.startswith("Sold on the Mog Station") else l) for l in lines if not l.startswith("Mog Station (online store)")]
        if any(l.startswith("Sold on the Mog Station") for l in lines):
            lines = [l.replace(". Rewards of past events are usually sold later on the Mog Station (the online store)", "") for l in lines]
        if lines: lines[0] = "How to obtain: " + lines[0]
        tags = []
        if ITEMROW_ALL.get(e["it"], {}).get("IsUntradable") == "True": tags.append("untradable")
        if i(ITEMROW_ALL.get(e["it"], {}).get("DyeCount")) > 0: tags.append("dye" + str(i(ITEMROW_ALL[e["it"]]["DyeCount"])))
        elif ITEMROW_ALL.get(e["it"], {}).get("IsUntradable") != "True": lines.append("Tradable: also sold by players on the market board")
        if tags: lines.insert(0, "§" + ",".join(tags))
        if lines: put(key, lines, 8); stats["collections with item sources"] += 1

# ---------------------------------------------------------------- achievements and titles
ACH = sheet("Achievement")
TITLE = {k: clean(r.get("Masculine")) for k, r in sheet("Title").items()}
CID_OF_CONTENT = {v_: k_ for k_, v_ in CONTENT_OF.items() if v_}
ACH_ID_NAME = {k_: clean(r_.get("Name")) for k_, r_ in ACH.items()}
def ach_extra(r):
    t_, k_ = i(r.get("Type")), i(r.get("Key"))
    data_ = [i(r.get(f"Data[{n}]")) for n in range(8)]
    desc = clean(r.get("Description"))
    out = []
    if t_ == 2:
        nm = [ACH_ID_NAME.get(x) for x in data_ if ACH_ID_NAME.get(x)]
        if nm and not all(x in desc for x in nm): out.append("Needs the achievements: " + ", ".join(nm))
    elif t_ == 6 and k_ in Q: out.append(quest_ref(k_, "Quest: "))
    elif t_ == 9:
        qs = [x for x in [k_] + data_ if x in Q and QNAME.get(x)]
        if qs: out.append("Quests: " + ", ".join(dict.fromkeys(QNAME[x] for x in qs[:6])))
    elif t_ == 14 and CID_OF_CONTENT.get(k_):
        dl = duty_lines(CID_OF_CONTENT[k_], {})
        if dl: out.append("Duty: " + "; ".join(dl[:3]))
    for nm in re.findall(r"\u201c([^\u201d]+?),?\u201d", desc)[:4]:
        fa_ = fate_at(nm)
        if fa_: out.append(fa_); continue
        q_ = QUEST_BY_NAME.get(norm(nm))
        if q_ and not (t_ == 6 and q_ == k_): out.append(quest_ref(q_, "Quest: "))
    return out[:4]
for key, g, e in each("ach-"):
    r = ACH.get(e["i"], {})
    lines = [clean(r.get("Description")) or e.get("d", "")] + ach_extra(r)
    if TITLE.get(i(r.get("Title"))): lines.append("Title: " + TITLE[i(r["Title"])])
    if ITEM.get(i(r.get("Item"))): lines.append("Reward: " + ITEM[i(r["Item"])])
    put(key, lines, 8); stats["achievements"] += 1
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
def opt(name):
    try: return sheet(name)
    except FileNotFoundError: return {}
WKS_TODO, WKS_RECIPE, WKS_SUPPLY = opt("WKSMissionToDo"), opt("WKSMissionRecipe"), opt("WKSMissionSupplyItem")
WKS_ITEMINFO = {}
for k_, r_ in (opt("WKSItemInfo") or {}).items(): WKS_ITEMINFO[k_] = i(r_.get("Item"))  # mission items point here, then to Item
wki = lambda x: WKS_ITEMINFO.get(i(x), 0)
ITEM_BY_NAME = {}
for k_, v_ in ITEM.items(): ITEM_BY_NAME.setdefault(norm(v_), k_)
ISLE_GATHER = {g_["itemId"]: g_ for g_ in tcx("island-gathering-items.json").values()} if isinstance(tcx("island-gathering-items.json"), dict) else {}
ISLE_CROP = {i(k_): i(v_.get("seed")) for k_, v_ in (tcx("island-crops.json") or {}).items()} if isinstance(tcx("island-crops.json"), dict) else {}
ISLE_LEAVINGS = collections.defaultdict(list)
for a_ in (tcx("island-animals.json") or {}).values() if isinstance(tcx("island-animals.json"), dict) else []:
    for rw in a_.get("rewards") or []: ISLE_LEAVINGS[rw].append(clean(sheet_bnpc.get(i(a_.get("bnpcName")), {}).get("Singular")))
ISLE_CRAFT = {c_["itemId"]: c_ for c_ in (tcx("island-craftworks.json") or {}).values()} if isinstance(tcx("island-craftworks.json"), dict) else {}
TRIBES = {}
for k_, r_ in opt("BeastTribe").items():
    if clean(r_.get("Name")): TRIBES[norm(re.sub(r"s$", "", clean(r_["Name"]).lower()))] = k_
RANK_QUESTS = collections.defaultdict(list)  # (tribe, rank) -> quests that open at that rank
for qid_, r_ in Q.items():
    if i(r_.get("BeastTribe")) and i(r_.get("BeastReputationRank")) and QNAME.get(qid_):
        RANK_QUESTS[(i(r_["BeastTribe"]), i(r_["BeastReputationRank"]))].append(QNAME[qid_])
TRIBE_GIVER = {}
_tg = collections.defaultdict(collections.Counter)
for qid_, r_ in Q.items():
    if i(r_.get("BeastTribe")) and i(r_.get("IssuerStart")): _tg[i(r_["BeastTribe"])][i(r_["IssuerStart"])] += 1
for t_, c_ in _tg.items():
    TRIBE_GIVER[t_] = npc_where(c_.most_common(1)[0][0])
RANK_ID = {"neutral": 1, "recognized": 2, "friendly": 3, "trusted": 4, "respected": 5, "honored": 6, "sworn": 7, "allied": 8, "bloodsworn": 8}
for key, g, e in each("societyranks"):
    tribe = TRIBES.get(norm(re.sub(r"s$", "", g["t"].lower())))
    rk = RANK_ID.get(e["n"].split(" - ")[-1].strip().lower())
    qs = RANK_QUESTS.get((tribe, rk), []) if tribe and rk else []
    giver = TRIBE_GIVER.get(tribe, "")
    if qs and giver:
        put(key, ["Raise your reputation with the " + g["t"] + " through their daily quests from " + giver + ((" (" + str(e.get("d")) + " reputation for this rank)") if e.get("d") else ""),
                  "Quests that open at this rank: " + ", ".join(qs[:6]) + (" and more" if len(qs) > 6 else ""),
                  "Each rank ends with a rank-up quest from the same giver once the reputation bar is full"])
        continue
    if giver:
        put(key, ["Raise your reputation with the " + g["t"] + " through their daily quests from " + giver + ((" (" + str(e.get("d")) + " reputation for this rank)") if e.get("d") else ""),
                  "Each rank ends with a rank-up quest from the same giver once the reputation bar is full"])
        continue
    if qs:
        put(key, ["Raise your reputation with the " + g["t"] + " through their daily quests" + ((" (" + str(e.get("d")) + " reputation for this rank)") if e.get("d") else ""),
                  "Quests that open at this rank: " + ", ".join(qs[:6]) + (" and more" if len(qs) > 6 else "")])
        continue
    put(key, ["Raise your reputation with the " + g["t"] + " through their daily quests (" + str(e.get("d", "")) + " reputation for this rank)" if e.get("d") else "Raise your reputation with the " + g["t"] + " through their daily quests"])

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
    raw = [x.strip() for x in str(d).split(" · ") if x.strip()]
    gt = g["t"]
    if sid == "cosmicmissions":
        r = WKS.get(e["i"], {})
        todo = []
        for n_ in range(3):
            t_ = WKS_TODO.get(i(r.get(f"MissionToDo[{n_}]")), {})
            for m_ in range(3):
                it = wki(t_.get(f"RequiredItem[{m_}]"))
                if it and ITEM.get(it): todo.append(str(i(t_.get(f"RequiredItemQuantity[{m_}]")) or "") + "× " + ITEM[it])
        rec = [ITEM.get(i(RECIPE.get(i(WKS_RECIPE.get(i(r.get("WKSMissionRecipe")), {}).get(f"Recipe[{n_}]")), {}).get("ItemResult")), "") for n_ in range(5)]
        rec = [x for x in rec if x]
        su = WKS_SUPPLY.get(i(r.get("WKSMissionSupplyItem")), {})
        sup = [str(i(su.get(f"ItemCount[{n_}]"))) + "× " + ITEM.get(wki(su.get(f"Item[{n_}]")), "") for n_ in range(3) if wki(su.get(f"Item[{n_}]")) and ITEM.get(wki(su.get(f"Item[{n_}]")))]
        out = [(bits[0] if bits else "") + " mission on " + (bits[1] if len(bits) > 1 else gt.split(":")[0]) + ": take it from the mission board in Cosmic Exploration and complete it"]
        sv, gd = i(r.get("SilverStarRequirement")), i(r.get("GoldStarRequirement"))
        if sv or gd: out.append("Score %s for silver, %s for gold" % (format(sv, ","), format(gd, ",")))
        if i(r.get("MissionTime")): out.append("Time limit: " + str(round(i(r["MissionTime"]) / 60)) + " minutes")
        if rec: out.append("Craft: " + ", ".join(dict.fromkeys(rec)))
        if todo: out.append("Turn in: " + ", ".join(dict.fromkeys(todo)))
        if sup: out.append("Provided materials: " + ", ".join(sup))
        return out
    if sid == "cosmicrecords": return ["Cosmic Exploration record (" + gt + "): " + e["n"], "Shown in the Cosmic Exploration record book; its credits are paid when it is completed"]
    if sid in ("plate", "portraits"):
        how = [b for b in bits if not b.lower().startswith("standard element")]
        if not how: return ["Standard element: available from the start (" + gt + ")"]
        out = []
        for h in how:
            am = re.search(r"\u201c([^\u201d]+)\u201d|\"([^\"]+)\" achievement", h)
            an = (am.group(1) or am.group(2)) if am else ""
            ar = ACH_BY_NAME.get(norm(an)) if an else None
            if ar: out.append("Achievement \u201c" + clean(ar["Name"]) + "\u201d: " + clean(ar.get("Description")))
            elif len(re.split(r"\s+-\s+", h)) >= 3 and re.search(r"\d", h.split(" - ")[-1]): out.append(vendor_line(h))
            else: out.append("How to get it: " + h)
        return out
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
    if sid == "bluelog":
        c_ = cfc_named(e["n"])
        return ["Clear " + e["n"] + " as a Blue Mage" + ((" (level " + raw[0] + ")") if raw and raw[0].isdigit() else "") + " to fill this Blue Mage log entry"] + ((duty_lines(c_, {})[1:3]) if c_ else [])
    if sid == "mountspeed":
        if e.get("x") == "gone": return ["This zone has no such increase (the checklist lists none), so it is not counted"]
        qm = [QUEST_BY_NAME.get(norm(b)) for b in bits]
        qm = [x for x in qm if x]
        if qm: return [quest_ref(qm[0], "Unlocked by the quest ")]
        return [("Unlocked by: " + "; ".join(bits)) if bits else "Unlocked by finishing this zone's story or its aether currents"]
    if sid == "masterbooks":
        who = coords(bits[0]) if bits else ""
        return ["Buy from " + who.replace(";", " in", 1) + ((" for " + " · ".join(bits[1:])) if len(bits) > 1 else ""), "Use the book to learn its recipes"]
    if sid == "folklore":
        who = coords(bits[0]) if bits else ""
        return ["Buy from " + who.replace(";", " in", 1) + ((" for " + " · ".join(bits[1:])) if len(bits) > 1 else ""), "Use it to see that region's legendary gathering or fishing spots"]
    if sid == "lostactions":
        fr = ITEM_BY_NAME.get(norm(bits[0])) if bits else None
        where = [x for x in (item_sources(fr, 3) if fr else []) if not x.startswith("Sold by")]
        return ["Comes from the " + (bits[0] if bits else "forgotten fragment") + ": take it to the Resistance quartermaster or appraiser at the Bozjan Southern Front or Zadnor to turn it into this action"] + [("The fragment: " + x[0].lower() + x[1:]) for x in where[:2]]
    if sid == "porters": return ["Talk to the chocobokeep at " + e["n"] + (" in " + bits[0] if bits else "") + " to register this porter stop"]
    if sid == "sharedfate": return [e["n"] + ((" (Shared FATE rank " + raw[0] + ")") if raw else ""), "Ranks rise as you complete FATEs in that zone; check them in the Shared FATE window, and spend the rewards with the zone's FATE vendor (gemstone trader)"]
    if sid == "eurekalevel": return ["Reach elemental level " + e["n"] + " in " + (bits[0] if bits else "Eureka") + " by defeating monsters and notorious monsters there"]
    if sid == "bozjarank": return ["Reach resistance rank " + e["n"] + " in " + (bits[0] if bits else "Bozja") + " by completing skirmishes, critical engagements and duels there"]
    if sid == "oclevel": return ["Reach knowledge level " + e["n"] + " in the Occult Crescent (" + (bits[0] if bits else "") + ") by defeating monsters and completing events there"]
    if sid == "logos": return ["Logos action for " + (bits[0] if bits else "any role") + ": combine mnemes at the Logos Manipulator in Eureka Hydatos"]
    if sid in ("eurekaaeth", "bozjaaeth", "ocaeth"): return ["Attune to " + e["n"] + ((" (unlocks at level/rank " + bits[0] + ")") if bits and bits[0].isdigit() else "") + " in " + gt]
    if sid in ("eurekaduties", "bozjaduties", "ocduties"):
        return ["Field operation duty in " + gt + ((": needs level/rank " + bits[0]) if bits and bits[0].isdigit() else "")]
    if sid == "ocevents" and field_lines(e["n"]):
        kind = "Critical engagement" if (bits and bits[0].lower().startswith("critical")) else "FATE"
        return [kind + " in the Occult Crescent (" + gt.replace("The Occult Crescent: ", "").replace(" Events", "") + ")"] + field_lines(e["n"])
    if sid == "ocevents": return [(bits[0] if bits else "Event") + " in the Occult Crescent (" + gt.replace("The Occult Crescent: ", "").replace(" Events", "") + ")" + ((": " + bits[1]) if len(bits) > 1 else "")]
    if sid == "phantomjobs": return ["Unlocked by: " + "; ".join(bits)] if bits else ["Phantom job of the Occult Crescent"]
    if sid == "islebuild": return ["Island Sanctuary building" + ((": needs island " + bits[0].lower()) if bits else "") + "; build it from the Felicitous Furball's menu"]
    if sid == "islecraft":
        it_ = ITEM_BY_NAME.get(norm(e["n"]))
        rk_ = raw[0] if raw and raw[0].isdigit() else ""
        if it_ in ISLE_CRAFT: return ["Made in your island's workshop" + ((" from island rank " + rk_) if rk_ else "") + (" (" + str(ISLE_CRAFT[it_].get("craftingTime", "")) + " hours)" if ISLE_CRAFT[it_].get("craftingTime") else "")]
        return ["Island Sanctuary item made at your cabin's crafting bench" + ((", available from island rank " + rk_) if rk_ else "")]
    if sid == "isleanimals": return ["Rare animal on your Island Sanctuary" + ((": " + bits[0].lower() + " animal") if bits else "") + ((" at " + bits[1]) if len(bits) > 1 else "") + "; catch it with Makeshift Restraints (or Net for large ones)"]
    if sid == "isleitems":
        it = ITEM_BY_NAME.get(norm(e["n"]))
        if it in ISLE_GATHER:
            gp = ISLE_GATHER[it]; return ["Gather it on your Island Sanctuary around (%.1f, %.1f) with the matching tool (gathering or Gathering Mode)" % (gp["x"], gp["y"])]
        if it in ISLE_CROP: return ["Grow it in your island's cropland from " + ITEM.get(ISLE_CROP[it], "its seeds")]
        if it in ISLE_LEAVINGS: return ["Leavings from " + ", ".join(ISLE_LEAVINGS[it][:3]) + " kept in your island's pasture"]
        if it in ISLE_CRAFT: return ["Made in your island's workshop (level " + str(ISLE_CRAFT[it].get("lvl", "")) + ", " + str(ISLE_CRAFT[it].get("craftingTime", "")) + " hours)"]
        return ["Island Sanctuary material: gather it on your island (Isleventory)"]
    if sid == "islerank": return ["Island Sanctuary rank " + e["n"] + ((": unlocks " + bits[0]) if bits else "") + "; island experience comes from gathering, crafting and building there"]
    if sid == "gcranks": return ["Needs: " + "; ".join(bits)] if bits else ["Earn company seals and promote at your Grand Company"]
    if sid == "carnivale":
        st = int(raw[0]) if raw and raw[0].isdigit() else e["i"]
        need = " (needs the Blue Mage quest Blue Scream of Death)" if 26 <= st <= 30 else (" (needs the Blue Mage quest Master of Mimicry)" if st == 31 else (" (needs the Blue Mage quest A New Gold Standard)" if st == 32 else ""))
        return ["Masked Carnivale stage " + str(st) + ": as a Blue Mage, talk to the Celestium Attendant in Ul'dah - Steps of Thal (11.5, 13.2) and clear it" + need, "Stages 1 to 25 open with the Blue Mage quests; each stage also has an optional challenge for extra rewards"]
    if sid == "companionskills": return ["Chocobo companion " + (raw[0].lower() if raw else "skill") + " in the " + gt + " tree: spend a skill point on it in the Companion window" + ((" (it is skill " + raw[1] + " of that tree; points come with each companion rank)") if len(raw) > 1 else "")]
    if sid == "companionrank": return ["Reach companion rank " + e["n"] + ((" (" + format(int(bits[0]), ",") + " experience)") if bits and bits[0].isdigit() else "") + " by fighting with your chocobo companion out"]
    if sid == "treasuremaps": return [(bits[0] if bits else "Treasure map") + ": decipher it, dig at the marked spot and open the coffer", "Maps come from gathering nodes (one a day per character) or the market board"]
    if sid == "novice": return ["Hall of the Novice exercise (from level " + (bits[0] if bits else "15") + "): talk to the instructor in the Hall of the Novice"]
    if sid == "trust": return ["Level " + e["n"] + " in Trust duties (" + d + ")", "Their level rises with experience from Trust runs"]
    if sid == "levels":
        q_ = QUEST_BY_NAME.get(norm(d.split(" - ")[0])) if d else None
        if q_: return [quest_ref(q_)]
        return ["Unlocked by: " + coords(d)] if d else ["Level this class or job"]
    if sid == "mahjong": return [d] if d else []
    if sid == "verminion":
        if e["i"] <= 24: return ["Verminion Challenge %d of 24: in Minion Square (Chocobo Square, the Gold Saucer), choose Verminion Challenge at a Lord of Verminion table and win against the computer" % e["i"], "Needs at least three minions; set your Verminion hotbar in Character → Gold Saucer → Verminion. The challenges unlock one after another"]
        if e["i"] in (111, 112, 113): return ["Master Battle (" + e["n"].split(": ")[-1] + "): a harder single-player battle against the computer, chosen at a Lord of Verminion table in Minion Square", "Open with cheap, fast minions and group same-type minions so their special action can fire"]
        return [e.get("d") or ""]
    if sid == "chocoboracing":
        if e["i"] < 1000: return ["Chocobo Challenge race: choose Chocobo Challenge at the race registrar in Chocobo Square (the Gold Saucer); " + (d[0].lower() + d[1:] if d else "") , "The first clear pays a large MGP reward and can unlock ability manuals at the Tack & Feed Trader"]
        if e["i"] < 1100: return ["Raise your race chocobo to " + e["n"].split("chocobo ")[-1] + ": experience comes from every race (more for better placings, plus a bonus when other players race too)", "Each rank up raises five random stats and gives a feeding; save feedings for grade 3 feed bought with MGP"]
        return ["Breed a " + e["n"].lower() + ": a foal's pedigree is its lower parent's plus one, so breed each generation up from rank 40 chocobos", "Breeding opens with the quest Like Sire Like Fledgling (Chocobokeep, Chocobo Square, 6, 4)"]
    if sid == "deliveries": return ["Custom Delivery client: " + d.replace("Quest:", "unlocked by the quest").replace(" · ", "; ")] if d else []
    if sid == "collection" and gt == "Yo-kai Medallium":
        return ["Yo-kai Watch collaboration event (time-limited; last run August to October 2026): start the quest \u201cA Complete Game Changer\u201d from the Poor-heeled Youth in Ul'dah - Steps of Nald (9.2, 9.1) at level 15 or higher",
                "Wear the Yo-kai Watch and earn Silver or Gold in FATEs in A Realm Reborn, Heavensward or Stormblood zones for Yo-kai Medals; trade them to Nohi in the Gold Saucer (5.2, 6.9) for this Yo-kai minion (the first costs 1 medal, later ones 3)",
                "With the minion out, the same FATEs can also drop its Legendary Medals for the matching Yo-kai weapon"]
    if sid == "collection" and gt == "Field Record":
        return ["Bozja field record " + (bits[0] if bits else "") + ": " + (" · ".join(bits[1:]) if len(bits) > 1 else "") + " in the Bozjan Southern Front or Zadnor; it can drop when the event is completed", "Check the Field Records in the Collection menu once found"]
    if sid == "collection" and gt == "Occult Record":
        return ["Occult Crescent record " + (bits[0] if bits else "") + ": " + coords(" · ".join(bits[1:]) if len(bits) > 1 else "")]
    if sid == "collection" and bits:
        return ["How to get it: " + coords(" · ".join(bits))]
    if sid == "collection": return ["Collection item" + ((" (" + " · ".join(bits) + ")") if bits else "") + ": shown in the Portable Archive or Yo-kai Medallium once obtained"]
    if sid == "spearfishing": return ["Caught by spearfishing" + (" in " + gt if gt != "Other" else "") + "; look for its shadow at the spearfishing holes there"]
    if sid.startswith("duty-"): return ["Duty (" + gt + ")"]
    if sid.startswith("hunt-"): return ["Hunt mark in " + gt]
    if e.get("src"): return [SRC_LABEL(e["src"])]
    if e.get("x") == "gone": return ["Not obtainable by players (a quest or duty vehicle in the game files, or removed), so it is not counted"]
    if sid in ("mounts", "minions", "emotes", "fashion", "facewear", "hairstyles", "barding", "orchestrion"): return ["No source recorded for it yet (FFXIV Collect lists none)"]
    if bits: return ["Details: " + " · ".join(coords(b) for b in bits)]
    return []
# ---------------------------------------------------------------- relic weapons and tools: a stage-by-stage guide on every entry
RELIC = json.load(open(os.path.join(T, "data", "relic-guides.json"), encoding="utf-8"))["series"]
def relic_stage(series, name, il):
    st = series["stages"]
    for k, sg in enumerate(st):
        if "il" in sg and sg["il"] != il: continue
        if sg.get("name") and sg["name"].lower() not in name.lower(): continue
        if "il" not in sg and "name" not in sg: continue
        return k, sg
    return None, None
nrelic = 0
for sid_ in ("relicweapons", "relictools"):
    for key, g, e in each(sid_):
        if not key.startswith(sid_ + ":"): continue
        m_ = re.search(r"\((\w+)\)", g["t"])
        series = RELIC.get(m_.group(1).lower()) if m_ else None
        if not series: continue
        raw = [x.strip() for x in str(e.get("d") or "").split(" · ") if x.strip()]
        job = raw[0] if raw else ""
        il = int(raw[1]) if len(raw) > 1 and raw[1].isdigit() else 0
        need = " · ".join(x for x in raw[2:] if not x.startswith("Added after"))
        k, sg = relic_stage(series, e["n"], il)
        if sg is None: continue
        order = sorted(series["stages"], key=lambda x: x.get("il", 0)) if all("il" in x for x in series["stages"]) else None
        pos = (order.index(sg) + 1) if order else None
        lines = [series["title"] + ": " + sg["title"] + " stage" + ((" (" + str(pos) + " of " + str(len(order)) + ")") if pos else "") + ((" for " + job) if job else "") + ((", item level " + str(il)) if il else "")]
        lines += sg["lines"]
        if need: lines.append("This weapon or tool needs: " + coords(need))
        for nm in re.split(r"\s*[,/]\s*", need):
            nm = re.sub(r"\s*(x\d+|\(.*?\))\s*$", "", nm).strip()
            it_ = ITEM_BY_NAME.get(norm(nm)) if nm else None
            if it_:
                src_ = item_sources(it_, 2)
                if src_: lines.append(nm + ": " + "; ".join(x[0].lower() + x[1:] for x in src_))
        for dn in sg.get("duties", [])[:5]:
            c_ = cfc_named(dn)
            if not c_: continue
            ul = [x for x in duty_lines(c_, {}) if x.startswith(("Unlocked", "Played"))]
            dn_ = clean(CFC[c_]["Name"]); dn_ = dn_[:1].upper() + dn_[1:]
            if ul: lines.append(dn_ + ": " + ul[0][0].lower() + ul[0][1:])
        put(key, lines, 16); nrelic += 1
stats["relic stages with a guide"] = nrelic

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

for key, g, e in each("craft-"):  # crafted gear: dyeable and untradable stamps too
    it_ = i(RECIPE.get(e["i"], {}).get("ItemResult")); row_ = ITEMROW_ALL.get(it_, {})
    tg_ = (["untradable"] if row_.get("IsUntradable") == "True" else []) + (["dye" + str(i(row_.get("DyeCount")))] if i(row_.get("DyeCount")) else [])
    if tg_ and INFO.get(key): INFO[key] = ["§" + ",".join(tg_)] + INFO[key]
# ---------------------------------------------------------------- live conditions: weather of every zone, and when entries can be done
# data/conditions.json: weather tables (TerritoryType.WeatherRate -> WeatherRate), and per entry the zone, the Eorzea hours
# and the weather (and previous weather) it needs; timed gathering nodes carry their spawn hours. The page works out
# "now" and "next window" from these with the game's own weather formula.
EXP_NAMES = data["meta"]["expansions"]
WR = sheet("WeatherRate")
WNAME = {k: clean(r.get("Name")) for k, r in sheet("Weather").items()}
TTS = sheet("TerritoryType")
USE_REGION = {41: "Eureka", 48: "Bozja", 61: "Occult Crescent", 60: "Cosmic Exploration", 49: "Island Sanctuary", 26: "The Diadem", 47: "The Diadem", 21: "Ishgard Restoration"}
WEATHER, REGIONS, ZONE_EX, used_w = {}, collections.OrderedDict(), {}, set()
for k, r in TTS.items():
    use, wr = i(r.get("TerritoryIntendedUse")), i(r.get("WeatherRate"))
    if use not in (0, 1) and use not in USE_REGION: continue
    zone = PLACE.get(i(r.get("PlaceName")), "")
    row = WR.get(wr)
    if not zone or not row or zone in WEATHER: continue
    tab, cum = [], 0
    for n_ in range(8):
        w_, rt = i(row.get(f"Weather[{n_}]")), i(row.get(f"Rate[{n_}]"))
        if rt and WNAME.get(w_): cum += rt; tab.append([w_, cum]); used_w.add(w_)
    if not tab: continue
    WEATHER[zone] = tab
    reg = USE_REGION.get(use) or PLACE.get(i(r.get("PlaceNameRegion")), "") or "Elsewhere"
    if reg == "???": reg = "Elsewhere"
    ZONE_EX[zone] = i(r.get("ExVersion"))
    REGIONS.setdefault((ZONE_EX[zone], reg), []).append(zone)
def zone_of_territory(t): return PLACE.get(i(TTS.get(i(t), {}).get("PlaceName")), "")
FSPOT_SHEET = sheet("FishingSpot")
COND, NODES = {}, {}
for key, g, e in each("sightseeing"):
    r = ADV.get(e["i"])
    if not r: continue
    lv = LEVEL.get(i(r.get("Level"))); m_ = MAP.get(i(lv.get("Map"))) if lv else None
    zone = PLACE.get(i(m_.get("PlaceName")), "") if m_ else ""
    t0, t1, w_ = i(r.get("MinTime")), i(r.get("MaxTime")), i(r.get("Weather"))
    if not (t0 or t1 or w_): continue
    COND[key] = [zone, (t0 // 100 + t0 % 100 / 60) if (t0 or t1) else 0, (t1 // 100 + (t1 % 100 + 1) / 60) if (t0 or t1) else 24, [w_] if w_ else [], []]
def fish_cond(key, it, zone):
    f_ = FT_FISH.get(str(it))
    if not f_: return
    a, b = f_.get("startHour", 0), f_.get("endHour", 24)
    w_, pw = f_.get("weatherSet") or [], f_.get("previousWeatherSet") or []
    if (a == 0 and b == 24) and not w_ and not pw: return
    COND[key] = [zone, a, b, w_, pw]
for key, g, e in each("fishing"):
    if key.startswith("fishingspots:"): continue
    f_ = FT_FISH.get(str(e.get("it"))) or {}
    zone = zone_of_territory(FSPOT_SHEET.get(i(f_.get("location")), {}).get("TerritoryType")) if f_.get("location") else ""
    if not zone:
        src_ = (FSRC.get(str(e.get("it"))) or [{}])[0]
        zone = PLACE.get(i(SPOTS.get(src_.get("spot"), {}).get("zoneId") or SPOTS.get(src_.get("spot"), {}).get("placeId")), "")
    fish_cond(key, e.get("it"), zone)
for key, g, e in each("spearfishing"):
    nb = SPEAR_NODE.get(i(SPEAR_ITEM.get(e.get("it"), {}).get("SpearfishingNotebook")), {})
    fish_cond(key, e.get("it"), zone_of_territory(nb.get("TerritoryType")) if nb else "")
for key, g, e in each("gather-"):
    it = e.get("it"); base = sublime_of.get(it)
    ns = [n for n in (by_item.get(it, []) or by_item.get(base, [])) if n.get("spawns")]
    if ns and not [n for n in (by_item.get(it, []) or by_item.get(base, [])) if not n.get("spawns")]:
        NODES[key] = [sorted(set(h for n in ns for h in n["spawns"])), max(n.get("duration") or 120 for n in ns)]
COND = {k: v for k, v in COND.items() if v[0] in WEATHER or not (v[3] or v[4])}
json.dump({"weather": WEATHER, "names": {str(k): WNAME[k] for k in sorted(used_w | {w for v in COND.values() for w in v[3] + v[4]}) if WNAME.get(k)},
           "regions": [[EXP_NAMES[x] if x < len(EXP_NAMES) else "", reg, zs] for (x, reg), zs in sorted(REGIONS.items(), key=lambda t: t[0][0])],
           "cond": COND, "nodes": NODES}, open(os.path.join(T, "data", "conditions.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
stats["entries with a live window (time or weather)"] = len(COND) + len(NODES)
stats["zones with a weather forecast"] = len(WEATHER)

_desc = {s_["id"] + ":" + str(e_["i"]): str(e_.get("d") or "").strip() for s_ in data["sections"] for g_ in s_["g"] for e_ in g_["e"]}
for k_ in list(INFO):
    seen_, keep_ = set(), []
    for l_ in INFO[k_]:
        if l_ in seen_ or (_desc.get(k_) and l_.strip() == _desc[k_]): continue
        seen_.add(l_); keep_.append(l_)
    if keep_: INFO[k_] = keep_
    else: del INFO[k_]
with open(os.path.join(T, "data", "info.json"), "w", encoding="utf-8") as fh:
    json.dump(INFO, fh, ensure_ascii=False, separators=(",", ":"))
print(json.dumps({"entries with information": len(INFO), "of": sum(len(g["e"]) for s in data["sections"] for g in s["g"]), "by family": dict(stats), "bytes": os.path.getsize(os.path.join(T, "data", "info.json"))}, indent=1))
