#!/usr/bin/env python3
"""Add the community FFXIV 100% Completion Checklist's extra lists to the tracker data, and build the
desktop-app position map used by the public importer.

Owner decision 2026-11-07 (option 3): the workbook (same team as the FFXIV Completionist desktop app) is
used publicly without a licence, credited to its authors; the owner accepted that risk. Workbook content
is used only for (a) areas the game sheets do not cover as lists, and (b) translating the desktop app's
page positions into tracker entries.

Usage (after tools/extract.py):
  python3 -I tools/add-checklist.py <FFXIV_Checklist.xlsx> [data/tracker-data.json]
Writes data/tracker-data.json (sections appended) and data/desktop-map.json.
"""
import json, os, re, sys, collections
import openpyxl

ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
DM = sys.argv[sys.argv.index("--dm") + 1] if "--dm" in sys.argv else None  # game-sheet checkout: adds what came after the workbook
if DM in ARGS:
    ARGS.remove(DM)
WB_PATH = ARGS[0]
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = ARGS[1] if len(ARGS) > 1 else os.path.join(HERE, "..", "data", "tracker-data.json")
MAP_OUT = os.path.join(os.path.dirname(DATA), "desktop-map.json")
WB_VERSION = "7.45"

wb = openpyxl.load_workbook(WB_PATH, read_only=True, data_only=True)
data = json.load(open(DATA, encoding="utf-8"))
data["sections"] = [s for s in data["sections"] if not s.get("src") == "checklist"]  # idempotent
SEC = {s["id"]: s for s in data["sections"]}
norm = lambda t: re.sub(r"[^a-z0-9]+", "", str(t or "").lower().replace("’", "'")).removeprefix("the")
clean = lambda v: " ".join(str(v).split()) if v not in (None, "") else ""
report = collections.OrderedDict()

def rows(sheet):
    """[(heads, row)] for every Y/N/X row, heads = upper-case banner rows above it."""
    heads, out = [], []
    for r in wb[sheet].iter_rows(values_only=True):
        a = r[0]
        if a in ("Y", "N", "X"):
            out.append((list(heads), r))
        elif isinstance(a, str) and a.strip() and a.strip().upper() == a.strip() and any(c.isalpha() for c in a) \
                and all(v in (None, "") for v in r[1:5]):
            heads.append(a.strip())
    return out

def title(h):
    small = {"of", "the", "and", "a", "in", "on", "to"}
    words = h.lower().split()
    return " ".join(w if (i and w in small) else w[:1].upper() + w[1:] for i, w in enumerate(words))

def by_name(section_ids):
    m = {}
    for sid in section_ids:
        for g in SEC[sid]["g"]:
            for e in g["e"]:
                m.setdefault(norm(e["n"]), sid + ":" + str(e["i"]))
    return m

# ---------------------------------------------------------------- new sections from sheets
# sheet, section id, title, area, name column, detail columns, group: "head" | column index
LISTS = [
    ("Porters", "porters", "Porters (Chocobokeeps)", "Travel", 3, [2, 1], "head"),
    ("Shared FATE", "sharedfate", "Shared FATE Ranks", "Travel", 2, [1], "head"),
    ("Hall of the Novice", "novice", "Hall of the Novice", "Duties", 3, [2], 1),
    ("Grand Company Ranks", "gcranks", "Grand Company Ranks", "Character", 1, [2], "head"),
    ("Society Relations", "societyranks", "Allied Society Ranks", "Character", 1, [2], "head"),
    ("Companion Rank", "companionrank", "Chocobo Companion Ranks", "Character", 1, [2], "head"),
    ("Companion Skills", "companionskills", "Chocobo Companion Skills", "Character", 2, [4, 1], "head"),
    ("Blue Mage Log", "bluelog", "Blue Mage Log", "Character", 3, [1], "head"),
    ("The Masked Carnivale", "carnivale", "The Masked Carnivale", "Character", 2, [1], "head"),
    ("Triple Triad Opponents", "ttnpcs", "Triple Triad Opponents", "Gold Saucer", 2, [4, 1, 5], 3),
    ("Mahjong Voices", "mahjong", "Doman Mahjong Voices", "Gold Saucer", 1, [2, 3], "head"),
    ("Collection", "collection", "Portable Archive and Collections", "Collections", 2, [1, 3, 4], "head"),
    ("Adventurer Plate", "plate", "Adventurer Plate", "Collections", 1, [3, 4], 2),
    ("Portraits", "portraits", "Portraits", "Collections", 1, [3, 4], 2),
    ("Relic Weapons", "relicweapons", "Relic Weapons", "Character", 3, [1, 2, 4], "head"),
    ("Relic Tools", "relictools", "Relic Tools", "Character", 3, [1, 2, 4], "head"),
    ("Folklore Gathering Books", "folklore", "Folklore Gathering Books", "Logs", 1, [2, 3], "head"),
    ("Master Crafting Books", "masterbooks", "Master Crafting Books", "Logs", 1, [2, 3], "head"),
    ("Fishing Logs", "fishingspots", "Fishing Log: Spots", "Logs", 5, [3, 4], "head"),
    ("Eureka - Elemental Level", "eurekalevel", "Eureka: Elemental Levels", "Field Operations", 1, [2], "head"),
    ("Eureka - Aetherytes", "eurekaaeth", "Eureka: Aetherytes", "Field Operations", 1, [2], "head"),
    ("Eureka - Logos Actions", "logos", "Eureka: Logos Actions", "Field Operations", 1, [4], "head"),
    ("Eureka - Duties", "eurekaduties", "Eureka: Duties", "Field Operations", 1, [2], "head"),
    ("Bozja - Resistance Rank", "bozjarank", "Bozja: Resistance Ranks", "Field Operations", 1, [2], "head"),
    ("Bozja - Aetherytes", "bozjaaeth", "Bozja: Aetherytes", "Field Operations", 1, [2], "head"),
    ("Bozja - Lost Actions", "lostactions", "Bozja: Lost Actions", "Field Operations", 1, [4], 2),
    ("Bozja - Duties", "bozjaduties", "Bozja: Duties", "Field Operations", 1, [2], "head"),
    ("OC - Knowledge Level", "oclevel", "Occult Crescent: Knowledge Levels", "Field Operations", 1, [2], "head"),
    ("OC - Aetherytes", "ocaeth", "Occult Crescent: Aetherytes", "Field Operations", 1, [2], "head"),
    ("OC - Events", "ocevents", "Occult Crescent: Events", "Field Operations", 2, [1, 3], "head"),
    ("OC - Phantom Jobs", "phantomjobs", "Occult Crescent: Phantom Jobs", "Field Operations", 1, [4], "head"),
    ("OC - Duties", "ocduties", "Occult Crescent: Duties", "Field Operations", 1, [2], "head"),
    ("Island Sanctuary - Rank", "islerank", "Island Sanctuary: Ranks", "Island Sanctuary", 1, [3, 4], "head"),
    ("Island Sanctuary - Buildings", "islebuild", "Island Sanctuary: Buildings", "Island Sanctuary", 1, [2, 4], "head"),
    ("Island Sanctuary - Crafting", "islecraft", "Island Sanctuary: Workshop Items", "Island Sanctuary", 2, [1], "head"),
    ("Island Sanctuary - Isleventory", "isleitems", "Island Sanctuary: Isleventory", "Island Sanctuary", 1, [2, 3], "head"),
    ("Island Sanctuary - Rare Animals", "isleanimals", "Island Sanctuary: Rare Animals", "Island Sanctuary", 1, [2, 5], "head"),
]
POS = {}  # section id -> list of (group title, key) in sheet order

def build_list(sheet, sid, ttl, area, ncol, dcols, group):
    groups = collections.OrderedDict()
    pos = []
    for n, (heads, r) in enumerate(rows(sheet), 1):
        name = clean(r[ncol]) if ncol < len(r) else ""
        if not name:
            name = clean(r[1]) or f"Entry {n}"
        if group == "head":
            g = title(heads[-1]) if heads else ttl
            c = title(heads[-2]) if len(heads) > 1 else ""
        else:
            g = clean(r[group]) or "Other"
            c = ""
        e = {"i": n, "n": name}
        det = " · ".join(clean(r[d]) for d in dcols if d < len(r) and clean(r[d]) and clean(r[d]) not in ("-", "None"))
        if det:
            e["d"] = det
        if r[0] == "X":
            e["x"] = "gone"  # the checklist pre-excludes this row (not applicable or no longer obtainable)
        groups.setdefault((c, g), []).append(e)
        pos.append(((heads + [g]) if group != "head" else (heads or [g]), sid + ":" + str(n)))
    sec = {"id": sid, "t": ttl, "area": area, "src": "checklist", "g": [{"t": g, "c": c, "e": es} for (c, g), es in groups.items()]}
    data["sections"].append(sec)
    SEC[sid] = sec
    POS[sid] = pos
    report[sid] = len(pos)

for spec in LISTS:
    build_list(*spec)

# Grand Company ranks: one group per company, each rank tagged with its company (rank names carry it).
def gc_of(name):
    n = name.lower()
    return 1 if "storm" in n else 2 if "serpent" in n else 3 if "flame" in n else 0
_gcs = SEC["gcranks"]
_groups = collections.OrderedDict((t, []) for t in ("Maelstrom", "Order of the Twin Adder", "Immortal Flames"))
for g in _gcs["g"]:
    for e in g["e"]:
        k = gc_of(e["n"])
        if k:
            e["gc"] = k
        _groups[list(_groups)[k - 1] if k else "Maelstrom"].append(e)
for es in _groups.values():
    es.sort(key=lambda e: e["i"])
_gcs["g"] = [{"t": t, "e": es} for t, es in _groups.items() if es]

# Classes and jobs: a level per character (job cap from the checklist's role grouping; desynthesis has no fixed cap here).
def classes_jobs():
    groups = collections.OrderedDict()
    keys = {"jobs": [], "desynth": []}
    for n, (heads, r) in enumerate(rows("Classes-Jobs"), 1):
        name, head = clean(r[3]), heads[-1] if heads else ""
        desynth = head.upper() == "DESYNTHESIS"
        e = {"i": n, "n": ("Desynthesis: " + name) if desynth else name, "val": 1}
        if not desynth:
            e["max"] = 80 if "Blue Mage" in name else 100
        quest = clean(r[4]) if len(r) > 4 else ""
        if quest and quest != "-":
            e["d"] = quest
        groups.setdefault(title(head), []).append(e)
        keys["desynth" if desynth else "jobs"].append("levels:" + str(n))
    sec = {"id": "levels", "t": "Classes and Jobs", "area": "Character", "src": "checklist",
           "note": "Enter each character's level. A job counts as complete at its level cap.",
           "g": [{"t": g, "e": es} for g, es in groups.items()]}
    data["sections"].append(sec)
    SEC["levels"] = sec
    report["levels"] = sum(len(v) for v in keys.values())
    return keys
LV_KEYS = classes_jobs()

# Mount speed: two increases per area, one entry each.
MS_HEADS = []
def mount_speed():
    groups = collections.OrderedDict()
    pos = collections.defaultdict(list)
    for n, (heads, r) in enumerate(rows("Mount Speed"), 1):
        area = clean(r[2])
        for j, label in ((0, "1st increase"), (1, "2nd increase")):
            e = {"i": 2 * n - 1 + j, "n": f"{area}: {label}"}
            how = clean(r[3 + j])
            if how and how != "-":
                e["d"] = how
            if r[j] == "X":
                e["x"] = "gone"
            g = title(heads[-1]) if heads else "Mount Speed"
            groups.setdefault(g, []).append(e)
            pos[g].append("mountspeed:" + str(e["i"]))
            MS_HEADS.append((heads or [g], "mountspeed:" + str(e["i"])))
    sec = {"id": "mountspeed", "t": "Mount Speed Increases", "area": "Travel", "src": "checklist",
           "g": [{"t": g, "e": es} for g, es in groups.items()]}
    data["sections"].append(sec)
    SEC["mountspeed"] = sec
    report["mountspeed"] = sum(len(v) for v in pos.values())
    return pos
MS_POS = mount_speed()

# ---------------------------------------------------------------- desktop-app position map
# Each rule: save path prefix -> how the desktop app numbers that area -> tracker keys.
rules = []

def global_rule(prefix, sid):
    rules.append({"p": prefix, "s": "global", "k": [k for _, k in POS[sid]]})

def leaf_rule(prefix, sid, groups=None):
    """Index the rows under every heading level, so the desktop app's area name (expansion, region or
    zone) finds its rows whatever level it names."""
    by = collections.OrderedDict()
    for heads, k in POS[sid] if groups is None else groups:
        for h in dict.fromkeys(norm(x) for x in heads):
            by.setdefault(h, []).append(k)
    rules.append({"p": prefix, "s": "leaf", "g": by})

global_rule("travel/porters", "porters")
leaf_rule("travel/shared-fate", "sharedfate")
leaf_rule("duty/hall-of-the-novice", "novice")
global_rule("character/character/grand-company-rank", "gcranks")
global_rule("character/character/societal-relations", "societyranks")
global_rule("character/companion/companion-rank", "companionrank")
global_rule("character/companion/companion-skills", "companionskills")
leaf_rule("character/blue-mage/log", "bluelog")
global_rule("character/blue-mage/the-masked-carnivale", "carnivale")
global_rule("character/gold-saucer/triple-triad-opponents", "ttnpcs")
global_rule("duty/collection", "collection")
leaf_rule("duty/collection/portable-archive", "collection")
leaf_rule("duty/collection/yo-kai-medallium", "collection")
global_rule("character/adventure-plate", "plate")
leaf_rule("character/relic-gear", "relicweapons", POS["relicweapons"] + POS["relictools"])
global_rule("logs/gathering/folklore-gathering-books", "folklore")
global_rule("logs/crafting-log/master-crafting-books", "masterbooks")
leaf_rule("logs/gathering/fishing-log", "fishingspots")
global_rule("duty/exploratory-missions/eureka/aetherytes", "eurekaaeth")
global_rule("duty/exploratory-missions/bozja/aetherytes", "bozjaaeth")
global_rule("duty/island-sanctuary/buildings", "islebuild")
global_rule("duty/island-sanctuary/rank", "islerank")
global_rule("duty/island-sanctuary/crafting", "islecraft")
global_rule("duty/island-sanctuary/isleventory", "isleitems")
global_rule("duty/island-sanctuary/animals", "isleanimals")
POS["mountspeed"] = MS_HEADS
leaf_rule("travel/mount-speed", "mountspeed")

# Aetherytes: numbered across the whole list; matched to the game-data aetherytes by name.
ae = by_name(["aetherytes"])
rules.append({"p": "travel/aetherytes", "s": "global", "k": [ae.get(norm(r[3])) for _, r in rows("Aetherytes")]})

# Aether currents: the desktop app keeps the legacy layout (10 field spots, then the quest currents).
ac_rows = collections.defaultdict(list)
for heads, r in rows("Aether Currents"):
    ac_rows[norm(heads[-1])].append(clean(r[4]))
ac = {}
for g in SEC["aethercurrents"]["g"]:
    quests = {norm(e["n"][7:]): f"aethercurrents:{e['i']}" for e in g["e"] if e["n"].startswith("Quest: ")}
    fields = [f"aethercurrents:{e['i']}" for e in g["e"] if e["n"].startswith("Field current")]
    qorder = [quests.get(norm(q)) for q in ac_rows.get(norm(g["t"]), []) if q and q != "-"]
    ac[norm(g["t"])] = {"q": qorder, "f": fields, "n": len(ac_rows.get(norm(g["t"]), []))}
rules.append({"p": "travel/aether-currents", "s": "currents", "z": ac})

# Gathering log: tab / page kind / page -> row order within that tab (Mining, Quarrying, Logging, Harvesting).
gn = by_name([s for s in SEC if s.startswith("gather-")])
TABS = {"mining": ("Miner Logs", "Mining"), "quarrying": ("Miner Logs", "Quarrying"),
        "logging": ("Botanist Logs", "Logging"), "harvesting": ("Botanist Logs", "Harvesting")}
gl = collections.defaultdict(lambda: collections.defaultdict(lambda: collections.OrderedDict()))
for tab, (sheet, typ) in TABS.items():
    for heads, r in rows(sheet):
        if clean(r[1]) != typ:
            continue
        top = max(i for i, h in enumerate(heads) if h.startswith("LEVEL BASED") or h.startswith("SPECIAL"))
        sub = heads[top + 1:]
        if heads[top].startswith("LEVEL BASED"):
            kind = "level"
        else:
            kind = {"COLLECTABLES": "collectables", "REGIONAL FOLKLORE": "regional-folklore", "SIDEQUESTS": "sidequests"}.get(
                next((h for h in reversed(sub) if h in ("COLLECTABLES", "REGIONAL FOLKLORE", "SIDEQUESTS")), ""), "special")
        page = norm(sub[-1]).removeprefix("levels")
        gl[tab][kind].setdefault(page, []).append(gn.get(norm(r[3])))
rules.append({"p": "logs/gathering/gathering-log", "s": "gather", "t": gl})

# Areas stored by game FATE id in the desktop app (Eureka notorious monsters, Bozja events).
rules.append({"p": "duty/exploratory-missions/eureka/notorious-monsters", "s": "id", "sec": "fates"})
rules.append({"p": "duty/exploratory-missions/bozja/events", "s": "id", "sec": "fates"})
# Level values (the desktop app stores a number, not "Y").
rules.append({"p": "character/character/classes--jobs", "s": "global", "k": LV_KEYS["jobs"], "val": 1})
rules.append({"p": "character/character/desynthesis", "s": "global", "k": LV_KEYS["desynth"], "val": 1})

# ---------------------------------------------------------------- content added after the workbook's edition
# The workbook is the 7.45 edition; the game sheets are pinned at 7.57h1. Rows the game added after 7.45 (compared with
# the game sheets at the 7.45h2 commit) that the workbook lists do not contain are appended from the game data, each
# marked as added after the workbook. Existing rows keep their ids, so the desktop-app import map is unaffected.
OLD_COMMIT = "d67201a2a27933a444bf249d900f7afd2840f6ff"  # xivapi/ffxiv-datamining "7.45h2"
after_745 = collections.Counter()
if DM:
    import subprocess, csv as _csv
    def gsheet(name, commit=None):
        if commit:
            txt = subprocess.run(["git", "-C", DM, "show", f"{commit}:csv/en/{name}.csv"], capture_output=True, text=True).stdout
            rr = list(_csv.reader(txt.splitlines()))
        else:
            with open(os.path.join(DM, "csv", "en", name + ".csv"), encoding="utf-8-sig") as fh:
                rr = list(_csv.reader(fh))
        hh = rr[0]
        return {int(x[0]): dict(zip(hh, x)) for x in rr[1:] if x and x[0].isdigit()}
    def added_rows(name):
        old = gsheet(name, OLD_COMMIT)
        return [(k, v) for k, v in sorted(gsheet(name).items()) if k not in old]
    NOTE = "Added after the checklist's 7.45 edition (from the game data, 7.57)"
    def append(sid, group, items, base):
        sec = SEC[sid]
        have = {norm(e["n"]) for g in sec["g"] for e in g["e"]}
        es = []
        for rid, name, det in items:
            if not name or norm(name) in have:
                continue
            have.add(norm(name))
            es.append({"i": base + rid, "n": name, "d": (det + " · " if det else "") + NOTE})
        if es:
            tgt = next((g for g in sec["g"] if g["t"] == group), None)
            if tgt:
                tgt["e"].extend(es)
            else:
                sec["g"].append({"t": group, "e": es})
            after_745[sid] += len(es)
    # adventurer plate parts and portrait parts
    deco_kind = {}
    for sheet_, label in (("CharaCardBase", "Base plate"), ("CharaCardHeader", "Top and bottom border"), ("CharaCardDecoration", "Decoration"), ("CharaCardDesignPreset", "Design preset")):
        append("plate", "Added after 7.45", [(k, v.get("Name", "").strip(), label) for k, v in added_rows(sheet_)],
               {"CharaCardBase": 100000, "CharaCardHeader": 200000, "CharaCardDecoration": 300000, "CharaCardDesignPreset": 400000}[sheet_])
    for sheet_, label, base in (("BannerBg", "Background", 100000), ("BannerFrame", "Frame", 200000), ("BannerDecoration", "Accent", 300000)):
        append("portraits", "Added after 7.45", [(k, v.get("Name", "").strip(), label) for k, v in added_rows(sheet_)], base)
    # Occult Crescent: phantom jobs, records, critical engagements and duties
    append("phantomjobs", "Phantom Jobs", [(k, v["Name"].strip(), "") for k, v in added_rows("MKDSupportJob")], 100000)
    append("collection", "Occult Record", [(k, v["Name"].strip(), "") for k, v in added_rows("MKDLore")], 100000)
    de_all = gsheet("DynamicEvent")
    oc_first = min((k for k, v in de_all.items() if v.get("Name", "").strip() == "Calamity Bound"), default=None)
    if oc_first is not None:
        ces = [(k, v["Name"].strip(), "Critical engagement") for k, v in sorted(de_all.items()) if k >= oc_first and v.get("Name", "").strip() and not v["Name"].startswith("The Forked Tower")]
        append("ocevents", "The Occult Crescent: North Horn Events", ces, 100000)
        towers = [(k, v["Name"].strip(), "") for k, v in sorted(de_all.items()) if v.get("Name", "").startswith("The Forked Tower")]
        append("ocduties", "Added after 7.45", towers, 100000)
    # relic weapons: new stages of the Dawntrail (phantom) weapons
    items_new = added_rows("Item")
    rw = SEC["relicweapons"]
    dt = next(g for g in rw["g"] if "Dawntrail" in g["t"])
    # A new stage is a final word that the existing rows do not use and that ends many new "Phantom ..." items (one per
    # job; weapons and shields only); replicas are left out, and the Paladin shield joins the sword in one row, as the workbook writes it.
    prefix = collections.Counter(e["n"].split()[0] for e in dt["e"]).most_common(1)[0][0]
    old_stages = {w.strip() for e in dt["e"] for part in e["n"].split("&") for w in part.split()[-1:]}
    cand = [(k, v) for k, v in items_new if v["Name"].startswith(prefix + " ") and "Replica" not in v["Name"] and v.get("EquipSlotCategory") in ("1", "2", "13") and len(v["Name"].split()) > 2
            and v["Name"].split()[-1] not in old_stages]
    stage_n = collections.Counter(v["Name"].split()[-1] for k, v in cand)
    cand = [(k, v) for k, v in cand if stage_n[v["Name"].split()[-1]] >= 10]
    shields = {v["Name"].split()[-1]: v["Name"].strip() for k, v in cand if v["Name"].split()[1] == "Shield"}
    cjc = gsheet("ClassJobCategory")
    rows_ = []
    for k, v in cand:
        nm, stage = v["Name"].strip(), v["Name"].split()[-1]
        if nm.split()[1] == "Shield":
            continue
        job = (clean(cjc.get(int(v.get("ClassJobCategory") or 0), {}).get("Name")).split() or [""])[-1]
        if job == "PLD" and stage in shields:
            nm += " & " + shields[stage]
        rows_.append((k, nm, job + " · item level " + v.get("LevelItem", "")))
    append("relicweapons", dt["t"], rows_, 100000)
    # relic tools: new Dawntrail (cosmic) tool stages are crafter or gatherer main-hand items above the highest item
    # level the workbook lists for them; replicas are left out
    dtt = next(g for g in SEC["relictools"]["g"] if "Dawntrail" in g["t"])
    top_il = max(int(m.group(1)) for e in dtt["e"] for m in [re.search(r" · (\d+)(?: · |$)", e.get("d", ""))] if m)
    cjn = {v["Abbreviation"]: clean(v["Name"]).title() for v in gsheet("ClassJob").values() if v.get("Abbreviation")}
    hand = {"CRP", "BSM", "ARM", "GSM", "LTW", "WVR", "ALC", "CUL", "MIN", "BTN", "FSH"}
    tools_ = []
    for k, v in items_new:
        job = clean(cjc.get(int(v.get("ClassJobCategory") or 0), {}).get("Name"))
        if (v.get("EquipSlotCategory") in ("1", "13") and job in hand and "Replica" not in v["Name"]
                and int(v.get("LevelItem") or 0) > top_il):
            tools_.append((k, v["Name"].strip(), cjn.get(job, job) + " · " + v["LevelItem"]))
    append("relictools", dtt["t"], tools_, 100000)
    # Triple Triad opponents (only those the game data names) and fishing spots (only those placed in a zone; the
    # zoneless rows are Cosmic Exploration mission spots, which the workbook does not list)
    npc = gsheet("ENpcResident")
    tt_new = added_rows("TripleTriadResident")
    append("ttnpcs", "Added after 7.45", [(k, clean(npc.get(k, {}).get("Singular")).title(), "") for k, v in tt_new], 0)
    unnamed_tt = sum(1 for k, v in tt_new if not clean(npc.get(k, {}).get("Singular")))
    place, terr = gsheet("PlaceName"), gsheet("TerritoryType")
    append("fishingspots", "Added after 7.45", [(k, clean(place.get(int(v.get("PlaceName") or 0), {}).get("Name")),
                                                 "Ocean fishing" if v.get("TerritoryType") == "900" else clean(place.get(int(terr.get(int(v.get("TerritoryType") or 0), {}).get("PlaceName") or 0), {}).get("Name")))
                                                for k, v in added_rows("FishingSpot") if (v.get("TerritoryType") or "0") != "0"], 100000)
    # Limited jobs the game data adds after 7.45 (Beastmaster, 7.56; level cap 50 per the 7.56 notes and guides; its job
    # quests and the Crucible of the Unbroken are already in the game-data quest and duty lists)
    LIMITED_CAP = {"BST": 50}
    cj_old = gsheet("ClassJob", OLD_COMMIT)
    quests = gsheet("Quest")
    for k, v in sorted(gsheet("ClassJob").items()):
        if v.get("Abbreviation") in LIMITED_CAP and not (cj_old.get(k, {}).get("Abbreviation")):
            q = clean(quests.get(int(v.get("UnlockQuest") or 0), {}).get("Name"))
            lv = SEC["levels"]
            grp = next((g for g in lv["g"] if g["t"] == "Limited Jobs"), None)
            if not grp:
                grp = {"t": "Limited Jobs", "e": []}
                lv["g"].insert(next(i for i, g in enumerate(lv["g"]) if g["t"].startswith("Disciples of the Hand")), grp)
            grp["e"].append({"i": 100000 + k, "n": clean(v["Name"]).title() + " (Limited Job)", "val": 1, "max": LIMITED_CAP[v["Abbreviation"]],
                             "d": ("Quest: " + q + " · " if q else "") + NOTE})
            after_745["levels"] += 1
    # Occult Crescent knowledge levels: the cap rose from 20 to 40 with North Horn (7.55); the game's experience table
    # keeps growing past 20 (to level 39), where the 7.45 table went flat at 20; the cap itself is from the 7.55 notes
    grow, grow_old = gsheet("MKDGrowData"), gsheet("MKDGrowData", OLD_COMMIT)
    assert grow[21]["Unknown0"] != grow[20]["Unknown0"] and grow_old[21]["Unknown0"] == grow_old[20]["Unknown0"], "knowledge table changed again"
    new_cap = 40
    ocl = SEC["oclevel"]
    have_lv = {e["n"] for g in ocl["g"] for e in g["e"]}
    extra = [{"i": 100000 + n, "n": str(n), "d": "North Horn · " + NOTE} for n in range(1, new_cap + 1) if str(n) not in have_lv]
    if extra:
        ocl["g"][-1]["e"].extend(extra)
        after_745["oclevel"] += len(extra)
    if unnamed_tt:
        after_745["ttnpcs (not named in the game data, left out)"] = unnamed_tt
    for sid, n in [(s_, n_) for s_, n_ in after_745.items() if s_ in SEC]:
        report[sid] += n

credit = ("Extra lists and the desktop-app import map: FFXIV 100% Completion Checklist " + WB_VERSION +
          " by its volunteer team (same team as the FFXIV Completionist app), used with credit.")
data["meta"]["sources"]["checklist"] = credit
with open(DATA, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
with open(MAP_OUT, "w", encoding="utf-8") as f:
    json.dump({"source": credit, "rules": rules}, f, ensure_ascii=False, separators=(",", ":"))
print(json.dumps({"added": report, "after_745": dict(after_745), "total_entries": sum(len(g["e"]) for s in data["sections"] for g in s["g"])}, indent=1))
