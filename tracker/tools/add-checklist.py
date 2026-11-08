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

WB_PATH = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "..", "data", "tracker-data.json")
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

credit = ("Extra lists and the desktop-app import map: FFXIV 100% Completion Checklist " + WB_VERSION +
          " by its volunteer team (same team as the FFXIV Completionist app), used with credit.")
data["meta"]["sources"]["checklist"] = credit
with open(DATA, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
with open(MAP_OUT, "w", encoding="utf-8") as f:
    json.dump({"source": credit, "rules": rules}, f, ensure_ascii=False, separators=(",", ":"))
print(json.dumps({"added": report, "total_entries": sum(len(g["e"]) for s in data["sections"] for g in s["g"])}, indent=1))
