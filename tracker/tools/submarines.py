#!/usr/bin/env python3
"""Build data/submarines.json for the Command Center's Submersibles module (design step S1).

Usage:
  python3 -I tools/submarines.py [--cache DIR] [--out data/submarines.json]

Every input is fetched from a pinned commit on raw.githubusercontent.com (or read from --cache, where each file is kept
under its own commit). Files are read as data; nothing from another repository is run. Sources (see data/SOURCES.md):

  * Game data: xivapi/ffxiv-datamining (English CSVs, game 7.57h1). Sectors, seas, parts, ranks, stat names, voyage
    report lines and item names. Game data (c) SQUARE ENIX CO., LTD.
  * FFXIV Teamcraft (MIT): submarine-parts.json (each part's item id) and voyage-sources.json (which items each sector
    can bring back; no quantities or odds), checked against submarine-voyages.json (sector names).
  * Submarine Tracker (Infiziert90/SubmarineTracker, MIT): which sector reveals which, which visits grant submarine
    slots 2 to 4 and open the next sea (Data/Unlocks.cs); the travel-time and range formula (SubExplPretty.cs,
    Data/Voyage.cs); the community's named routes (Data/Voyage.cs). Community data, labelled as such.

Nothing is typed by hand and no value is guessed. The build stops with a message when a count differs from the design
(143 sectors, 7 seas, 40 parts, 145 ranks), when Teamcraft's parts differ from the game's, when the unlock table does
not line up with the game's sector names, or when a source file no longer says what this tool expects.
"""
import csv, io, json, os, re, sys, tempfile, urllib.request

DM_COMMIT = "44948e4cda5846eab0baa9872122a888fcc4f1b1"  # xivapi/ffxiv-datamining, game 7.57h1 (data/SOURCES.md)
TC_COMMIT = "70429e214dc952be23114df514a18223dc429449"  # ffxiv-teamcraft/ffxiv-teamcraft, 2026-11-07 (MIT)
ST_COMMIT = "04c54d770f815cd416bbade1ac5b178b551a32b5"  # Infiziert90/SubmarineTracker, 2026-10-03 (MIT)

DM_URL = "https://raw.githubusercontent.com/xivapi/ffxiv-datamining/%s/csv/en/%%s.csv" % DM_COMMIT
TC_URL = "https://raw.githubusercontent.com/ffxiv-teamcraft/ffxiv-teamcraft/%s/%%s" % TC_COMMIT
ST_URL = "https://raw.githubusercontent.com/Infiziert90/SubmarineTracker/%s/%%s" % ST_COMMIT
TC_JSON = "libs/data/src/lib/json/%s.json"

EXPECT = {"sectors": 143, "seas": 7, "parts": 40, "ranks": 145, "per_sea": [30, 20, 20, 20, 20, 20, 13]}
EXP_TO_MAX = 1829558717  # design section 3.5: experience from rank 1 to 145 by the game table

args = sys.argv[1:]
def opt(name, default):
    return args[args.index(name) + 1] if name in args else default
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = opt("--out", os.path.join(ROOT, "data", "submarines.json"))
CACHE = opt("--cache", "") or tempfile.mkdtemp(prefix="submarines-")


def stop(msg):
    sys.exit("submarines.py: STOP - " + msg)


def fetch(url, key):
    """Return the text at url, kept in the cache under key (which names the commit)."""
    path = os.path.join(CACHE, key)
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        req = urllib.request.Request(url, headers={"User-Agent": "eveniunt-data-snapshot"})
        with urllib.request.urlopen(req, timeout=120) as r:
            body = r.read()
        with open(path, "wb") as f:
            f.write(body)
    with open(path, encoding="utf-8-sig") as f:
        return f.read()


def sheet(name):
    """{row id: {column: text}} for a pinned English game sheet."""
    csv.field_size_limit(1 << 30)
    rows = list(csv.reader(io.StringIO(fetch(DM_URL % name, "dm-%s/%s.csv" % (DM_COMMIT[:8], name)))))
    head = rows[0]
    return {int(r[0]): dict(zip(head, r)) for r in rows[1:] if r and r[0].isdigit()}


def tc(name):
    return json.loads(fetch(TC_URL % (TC_JSON % name), "tc-%s/%s.json" % (TC_COMMIT[:8], name)))


def st(path):
    return fetch(ST_URL % path, "st-%s/%s" % (ST_COMMIT[:8], path.replace("/", "_")))


def i(v):
    return int(v) if str(v).lstrip("-").isdigit() else stop("not a whole number: %r" % (v,))


def plain(s):
    """Drop the italic markers the game export (*Headway*) and Teamcraft (<i>Headway</i>) put around ship names."""
    return re.sub(r"</?i>", "", (s or "").replace("*", ""))


def norm(s):
    """Compare names loosely: lower case, no leading 'the', no '(X)' letter, letters and digits only."""
    s = re.sub(r"\s*\([A-Z]{1,2}\)\s*$", "", (s or "").strip()).lower()
    s = re.sub(r"^the\s+", "", s)
    return re.sub(r"[^a-z0-9]+", "", s)


# ------------------------------------------------------------------ licences (checked at the pinned commits)
for label, url, key in (("Teamcraft", TC_URL % "LICENSE", "tc-%s/LICENSE" % TC_COMMIT[:8]),
                        ("Submarine Tracker", ST_URL % "LICENSE", "st-%s/LICENSE" % ST_COMMIT[:8])):
    if not fetch(url, key).lstrip().startswith("MIT License"):
        stop("%s's LICENSE at the pinned commit is not the MIT licence" % label)
MIT_PERMISSION = ("Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated "
                  "documentation files (the \"Software\"), to deal in the Software without restriction, including without "
                  "limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the "
                  "Software, and to permit persons to whom the Software is furnished to do so, subject to the following "
                  "conditions: The above copyright notice and this permission notice shall be included in all copies or "
                  "substantial portions of the Software. THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND.")
for label, url, key in (("Teamcraft", TC_URL % "LICENSE", "tc-%s/LICENSE" % TC_COMMIT[:8]),
                        ("Submarine Tracker", ST_URL % "LICENSE", "st-%s/LICENSE" % ST_COMMIT[:8])):
    if MIT_PERMISSION.split(": The above")[0].replace('\\"', '"') not in re.sub(r"\s+", " ", fetch(url, key)):
        stop("%s's LICENSE does not carry the MIT permission text" % label)
TC_NOTICE = fetch(TC_URL % "LICENSE", "tc-%s/LICENSE" % TC_COMMIT[:8]).splitlines()[2].strip()
ST_NOTICE = fetch(ST_URL % "LICENSE", "st-%s/LICENSE" % ST_COMMIT[:8]).splitlines()[2].strip()

# ------------------------------------------------------------------ seas and sectors (game data)
EXPL = sheet("SubmarineExploration")
MAPS = sheet("SubmarineMap")
seas, sectors, starts, empty_rows = [], [], {}, []
for rid, r in sorted(MAPS.items()):
    if rid and r["Name"]:
        seas.append({"id": rid, "name": r["Name"], "image": i(r["Image"])})
sea_ids = {s["id"] for s in seas}
for rid, r in sorted(EXPL.items()):
    if r["StartingPoint"] == "True":
        starts[i(r["Map"])] = {"start": rid, "x": i(r["X"]), "y": i(r["Y"]), "z": i(r["Z"])}
    elif not r["Destination"]:
        empty_rows.append(rid)
    else:
        if i(r["Map"]) not in sea_ids:
            stop("sector %d names sea %s, which is not in SubmarineMap" % (rid, r["Map"]))
        if not r["Destination"].endswith("(%s)" % r["Location"]):
            stop("sector %d: name %r does not end with its letter %r" % (rid, r["Destination"], r["Location"]))
        sectors.append({"id": rid, "sea": i(r["Map"]), "letter": r["Location"], "name": plain(r["Destination"]),
                        "rank": i(r["RankReq"]), "tanks": i(r["CeruleumTankReq"]), "survey": i(r["SurveyDurationmin"]),
                        "exp": i(r["ExpReward"]), "surveyDistance": i(r["SurveyDistance"]), "stars": i(r["Stars"]),
                        "x": i(r["X"]), "y": i(r["Y"]), "z": i(r["Z"])})
for s in seas:
    if s["id"] not in starts:
        stop("sea %d has no starting point" % s["id"])
    s.update(starts[s["id"]])
    s["sectors"] = sum(1 for x in sectors if x["sea"] == s["id"])
if len(sectors) != EXPECT["sectors"] or len(seas) != EXPECT["seas"] or [s["sectors"] for s in seas] != EXPECT["per_sea"]:
    stop("sector or sea counts differ from the design: %d sectors, %d seas, per sea %s"
         % (len(sectors), len(seas), [s["sectors"] for s in seas]))
SECTOR = {s["id"]: s for s in sectors}
START_ROWS = {s["start"] for s in seas}

# ------------------------------------------------------------------ parts and classes (game data + Teamcraft item ids)
PARTS = sheet("SubmarinePart")
ITEM = sheet("Item")
TC_PARTS = tc("submarine-parts")
STATS = ["surveillance", "retrieval", "speed", "range", "favor"]
parts = []
for rid, r in sorted(PARTS.items()):
    if not i(r["Class"]):
        continue
    p = {"id": rid, "class": i(r["Class"]), "slot": i(r["Slot"]), "rank": i(r["Rank"])}
    p.update({k: i(r[k.capitalize()]) for k in STATS})
    p["components"], p["repairMaterials"] = i(r["Components"]), i(r["RepairMaterials"])
    t = TC_PARTS.get(str(rid))
    if not t:
        stop("Teamcraft has no item id for part %d" % rid)
    for k in ["class", "slot", "rank", "components", "repairMaterials"] + STATS:
        if int(t[k]) != p[k]:
            stop("part %d: Teamcraft's %s (%s) differs from the game's (%s)" % (rid, k, t[k], p[k]))
    p["item"] = int(t["itemId"])
    if p["item"] not in ITEM or not ITEM[p["item"]]["Name"]:
        stop("part %d: item %d has no name in the game's Item sheet" % (rid, p["item"]))
    p["name"] = ITEM[p["item"]]["Name"]
    parts.append(p)
if len(parts) != EXPECT["parts"] or len(TC_PARTS) != EXPECT["parts"]:
    stop("part count differs from the design: game %d, Teamcraft %d" % (len(parts), len(TC_PARTS)))
# Slot and class names come from the item names ("Shark-class Pressure Hull" -> class Shark, slot Pressure Hull).
slot_names, class_names = {}, {}
for p in parts:
    m = re.fullmatch(r"(.+)-class (.+)", p["name"])
    if not m:
        stop("part %d: item name %r is not '<class>-class <slot>'" % (p["id"], p["name"]))
    if slot_names.setdefault(p["slot"], m.group(2)) != m.group(2):
        stop("slot %d is named both %r and %r" % (p["slot"], slot_names[p["slot"]], m.group(2)))
    if class_names.setdefault(p["class"], m.group(1)) != m.group(1):
        stop("class %d is named both %r and %r" % (p["class"], class_names[p["class"]], m.group(1)))
SLOT_KEY = {"Pressure Hull": "hull", "Stern": "stern", "Bow": "bow", "Bridge": "bridge"}
if sorted(slot_names.values()) != sorted(SLOT_KEY):
    stop("unexpected slot names %s" % sorted(slot_names.values()))
SLOT_ORDER = [next(k for k, v in slot_names.items() if v == n) for n in SLOT_KEY]  # hull, stern, bow, bridge
for p in parts:
    p["slotName"] = SLOT_KEY[slot_names[p["slot"]]]
classes = []
for cid in sorted(class_names, key=lambda c: (min(p["rank"] for p in parts if p["class"] == c), c)):
    cp = {p["slot"]: p for p in parts if p["class"] == cid}
    if sorted(cp) != sorted(SLOT_ORDER) or len({p["rank"] for p in cp.values()}) != 1:
        stop("class %d does not have one part per slot at one rank" % cid)
    classes.append({"id": cid, "name": class_names[cid], "rank": cp[SLOT_ORDER[0]]["rank"],
                    "parts": [cp[s]["id"] for s in SLOT_ORDER]})

# ------------------------------------------------------------------ ranks, stat names, report lines (game data)
RANKS = sheet("SubmarineRank")
ranks = []
for rid, r in sorted(RANKS.items()):
    if rid and i(r["Capacity"]):
        ranks.append({"rank": rid, "expToNext": i(r["ExpToNext"]), "capacity": i(r["Capacity"]),
                      **{k + "Bonus": i(r[k.capitalize() + "Bonus"]) for k in STATS}})
if [x["rank"] for x in ranks] != list(range(1, EXPECT["ranks"] + 1)):
    stop("ranks are not 1 to %d in order" % EXPECT["ranks"])
exp_to_max = sum(x["expToNext"] for x in ranks[:-1])
if exp_to_max != EXP_TO_MAX:
    stop("experience from rank 1 to %d is %d, not the design's %d" % (EXPECT["ranks"], exp_to_max, EXP_TO_MAX))
SPEC = sheet("SubmarineSpecCategory")
stat_names = {k: SPEC[n]["Unknown0"] for n, k in enumerate(STATS)}
LOG = sheet("SubmarineExplorationLog")
report_lines = {str(rid): r["Unknown0"] for rid, r in sorted(LOG.items()) if r["Unknown0"]}
if "Permission granted to register an additional submersible!" not in report_lines.get("30", ""):
    stop("voyage report line 30 is not the extra-submersible line")

# ------------------------------------------------------------------ loot (Teamcraft voyage-sources, type 1 = submarine)
TC_VOY = tc("submarine-voyages")
for sid, s in SECTOR.items():
    if plain(TC_VOY.get(str(sid), {}).get("en")) != s["name"]:
        stop("Teamcraft's sector %d is %r, the game's is %r" % (sid, TC_VOY.get(str(sid), {}).get("en"), s["name"]))
VS = tc("voyage-sources")
loot, entries, no_sector, not_sector, pairs = {}, 0, [], [], set()
for item, lst in VS.items():
    for e in lst:
        if e.get("type") != 1:
            continue
        entries += 1
        sid = e.get("id")
        if sid is None:
            no_sector.append(int(item))
        elif sid not in SECTOR:
            not_sector.append({"item": int(item), "row": sid, "why": "starting point" if sid in START_ROWS else "no such sector"})
        else:
            pairs.add((sid, int(item)))
for sid, item in sorted(pairs):
    loot.setdefault(str(sid), []).append(item)
for item in {it for _, it in pairs}:
    if item not in ITEM or not ITEM[item]["Name"]:
        stop("loot item %d has no name in the game's Item sheet" % item)
items = {str(it): ITEM[it]["Name"] for it in sorted({it for _, it in pairs} | {p["item"] for p in parts})}
sectors_without_loot = [sid for sid in sorted(SECTOR) if str(sid) not in loot]

# ------------------------------------------------------------------ unlocks (Submarine Tracker, Data/Unlocks.cs)
UNLOCKS_CS = st("SubmarineTracker/Data/Unlocks.cs")
LINE = re.compile(r"\{\s*(\d+),\s*new UnlockedFrom\(([^)]*)\)\s*\},?\s*//\s*(.*)$")
unlocks, name_checks, seen = {}, 0, set()
for line in UNLOCKS_CS.splitlines():
    m = LINE.search(line)
    if not m:
        continue
    rid, argtext, comment = int(m.group(1)), m.group(2).strip(), m.group(3).strip()
    if rid in seen:
        stop("Unlocks.cs lists row %d twice" % rid)
    seen.add(rid)
    if argtext == "SectorType.Map":
        if rid not in START_ROWS:
            stop("Unlocks.cs marks row %d as a sea's start, but it is not a starting point" % rid)
        continue
    if rid not in SECTOR:
        stop("Unlocks.cs lists row %d, which is not a sector" % rid)
    a = [x.strip() for x in argtext.split(",")]
    flags = {k: True for k in ("sub", "map", "main") if "%s: true" % k in a}
    if len(a) != 1 + len(flags):
        stop("Unlocks.cs row %d: unexpected arguments %r" % (rid, argtext))
    entry = {}
    if a[0] == "SectorType.Begin":
        entry["start"] = True
    elif a[0].isdigit() and int(a[0]) in SECTOR:
        entry["by"] = int(a[0])
    else:
        stop("Unlocks.cs row %d: unlocking sector %r is not a sector" % (rid, a[0]))
    if flags.get("sub"):
        entry["extraSub"] = True
    if flags.get("map"):
        entry["opensSea"] = True  # replaced by the sea's id below
    if flags.get("main"):
        entry["mainPath"] = True
    # The comment names the sector and, after "<-", the sector that reveals it; both must match the game's names.
    parts_c = [x.strip() for x in re.split(r"<-", comment)]
    target = re.sub(r"^[A-Z]{1,2}\s+", "", parts_c[0]).strip()
    if norm(target) != norm(SECTOR[rid]["name"]) and not (entry.get("start") and target == "Default"):
        stop("Unlocks.cs row %d is commented %r, the game's sector is %r" % (rid, target, SECTOR[rid]["name"]))
    if "by" in entry:
        if len(parts_c) != 2 or norm(parts_c[1]) != norm(SECTOR[entry["by"]]["name"]):
            stop("Unlocks.cs row %d: revealed by %r, the game's sector %d is %r"
                 % (rid, parts_c[-1], entry["by"], SECTOR[entry["by"]]["name"]))
        name_checks += 1
    unlocks[str(rid)] = entry
if sorted(int(k) for k in unlocks) != sorted(SECTOR):
    stop("Unlocks.cs does not cover every sector exactly once (missing %s)" % sorted(set(SECTOR) - {int(k) for k in unlocks}))
for k, e in unlocks.items():
    if e.get("opensSea"):
        nxt = sorted({SECTOR[int(j)]["sea"] for j, f in unlocks.items() if f.get("by") == int(k) and SECTOR[int(j)]["sea"] != SECTOR[int(k)]["sea"]})
        if len(nxt) != 1 or nxt[0] != SECTOR[int(k)]["sea"] + 1:
            stop("sector %s opens a sea, but no sector of the next sea is revealed by it" % k)
        e["opensSea"] = nxt[0]
# Every chain must lead back to a starting sector, and a sector never needs a lower-numbered sea's later sector
# except through the sea-opening sector.
def depth(k, guard=0):
    e = unlocks[str(k)]
    if guard > len(unlocks):
        stop("the unlock chain of sector %s loops" % k)
    return 0 if e.get("start") else 1 + depth(e["by"], guard + 1)
for k, e in unlocks.items():
    depth(int(k))
    if "by" in e and SECTOR[e["by"]]["sea"] != SECTOR[int(k)]["sea"] and not unlocks[str(e["by"])].get("opensSea"):
        stop("sector %s is revealed from another sea by a sector that does not open its sea" % k)
sub_sectors = sorted((int(k) for k, e in unlocks.items() if e.get("extraSub")), key=lambda k: (depth(k), k))
if len(sub_sectors) != 3:
    stop("expected three sectors that grant submarine slots 2 to 4, found %d" % len(sub_sectors))
sub_slots = [{"slot": n + 2, "sector": k} for n, k in enumerate(sub_sectors)]
for a, b in zip(sub_sectors, sub_sectors[1:]):
    chain, x = set(), b
    while not unlocks[str(x)].get("start"):
        x = unlocks[str(x)]["by"]
        chain.add(x)
    if a not in chain:
        stop("the sector for slot %d is not on the way to the sector for the next slot" % (sub_sectors.index(a) + 2))

# ------------------------------------------------------------------ formula (Submarine Tracker, SubExplPretty.cs and Voyage.cs)
PRETTY = re.sub(r"\s+", " ", st("SubmarineTracker/SubExplPretty.cs"))
VOYAGE_CS = st("SubmarineTracker/Data/Voyage.cs")
VOYAGE = re.sub(r"\s+", " ", VOYAGE_CS)
for needle, where in (
        ("Vector3.Distance(new Vector3(sheet.X, sheet.Y, sheet.Z), new Vector3(otherSheet.X, otherSheet.Y, otherSheet.Z)) * 0.035)", PRETTY),
        ("Vector3.Distance(new Vector3(sheet.X, sheet.Y, sheet.Z), new Vector3(otherSheet.X, otherSheet.Y, otherSheet.Z)) * 3990 / (speed * 100) * 60)", PRETTY),
        ("sheet.SurveyDurationmin * 7000 / (speed * 100) * 60)", PRETTY),
        ("GetVoyageTime(sheet, otherSheet, speed) + otherSheet.GetSurveyTime(speed)", PRETTY),
        ("if (speed < 1) speed = 1;", PRETTY),
        ("public const int FixedVoyageTime = 43200;", VOYAGE),
        ("return durations + FixedVoyageTime;", VOYAGE),
        ("var distance = Distances[Utils.GetUniqueId(path[0],start.RowId)] + SectorToSheet[path[0]].SurveyDistance;", VOYAGE),
        ("distance += Distances[Utils.GetUniqueId(path[i], path[i + 1])] + SectorToSheet[path[i + 1]].SurveyDistance;", VOYAGE),
        ("if (sectors.Length is 0 or > 5)", VOYAGE)):
    if needle not in where:
        stop("the formula source no longer contains: " + needle)
SECTORS_CS = re.sub(r"\s+", " ", st("SubmarineTracker/Data/Sectors.cs"))
for needle in ("1 => (uint) (exp * 1.25)", "4 => (uint) (exp * 2.00)", "guaranteed += br.Optimal <= build.Retrieval ? 1 : 0;",
               "// All data automatically calculated and taken from: // https://docs.google.com/spreadsheets/"):
    if needle not in SECTORS_CS:
        stop("Sectors.cs no longer contains: " + needle)
formula = {
    "label": "calculated, not yet confirmed",
    "fixedSeconds": 43200, "distanceFactor": 0.035, "travelFactor": 3990, "surveyFactor": 7000, "minSpeed": 1,
    "maxSectors": 5,
    "steps": [
        "A route starts at its sea's starting point and visits 1 to 5 sectors of that sea in the order chosen.",
        "Leg length: the straight-line distance between two points, from their X, Y and Z positions.",
        "Range used: for each leg, round down (leg length x 0.035), then add the destination's survey distance; add up "
        "every leg. The route is reachable if the total is no more than the build's range. There is no leg back.",
        "Speed: the build's speed (four parts plus the rank's bonus); a speed below 1 counts as 1.",
        "Travel seconds of a leg: round down (leg length x 3990 / (speed x 100) x 60).",
        "Survey seconds of a sector: round down (survey minutes x 7000 / (speed x 100) x 60).",
        "Voyage seconds: every leg's travel seconds plus every sector's survey seconds, plus a fixed 43,200 seconds (12 hours).",
        "Return time: the send time plus the voyage seconds.",
    ],
    "experienceNote": "The game table gives each sector's base experience. Submarine Tracker (Data/Sectors.cs) adds 25%, 50%, "
                      "75% or 100% to a sector's experience when its survey goes well, judged against surveillance, retrieval "
                      "and favor thresholds that it takes from a community spreadsheet with no stated licence; those thresholds "
                      "are not used here. By that source, base experience is the least a voyage gives, so a rank worked out "
                      "from it is a floor; the return sheet's rank check shows the real figure (design assumption A4).",
    "precision": "The source computes in single precision (C# float); this file's checks use double precision. The two "
                 "can differ by one second only when a value falls a hair away from a whole second; the five test "
                 "voyages give the same seconds either way.",
}

# ------------------------------------------------------------------ common routes (Submarine Tracker, Data/Voyage.cs)
common = []
for name, mp, ids in re.findall(r'\{\s*"([^"]+)",\s*new CommonRoute\((\d+),\s*([\d,\s]+)\)\s*\}', VOYAGE_CS):
    route = [int(x) for x in ids.split(",")]
    sea = int(mp) + 1  # the source counts seas from 0
    if any(r not in SECTOR or SECTOR[r]["sea"] != sea for r in route) or not 1 <= len(route) <= 5:
        stop("common route %r does not lie in sea %d" % (name, sea))
    common.append({"name": name, "sea": sea, "route": route})
if not common:
    stop("no common routes found in Voyage.cs")

# ------------------------------------------------------------------ write
src_game = {"repo": "xivapi/ffxiv-datamining", "commit": DM_COMMIT, "version": "7.57h1",
            "notice": "Game data (c) SQUARE ENIX CO., LTD.", "kind": "game data"}
src_tc = {"repo": "ffxiv-teamcraft/ffxiv-teamcraft", "commit": TC_COMMIT, "licence": "MIT", "notice": TC_NOTICE,
          "kind": "community data", "permission": MIT_PERMISSION}
src_st = {"repo": "Infiziert90/SubmarineTracker", "commit": ST_COMMIT, "licence": "MIT", "notice": ST_NOTICE,
          "kind": "community data", "permission": MIT_PERMISSION}
out = {
    "_about": "Submersibles data for the Eveniunt Command Center, built by tools/submarines.py from pinned sources "
              "(data/SOURCES.md). Ids are the game's row ids: sectors and seas from SubmarineExploration and SubmarineMap, "
              "parts from SubmarinePart, items from Item. Sector names are the game's, with the italic markers around three "
              "ship names removed. Sector fields: rank = rank required, tanks = ceruleum tanks, "
              "survey = survey minutes, exp = experience reward (base value), surveyDistance = range the survey uses, "
              "x/y/z = position. Each table names its source and commit in 'tables'.",
    "sources": {"game": src_game, "teamcraft": src_tc, "submarineTracker": src_st},
    "tables": {
        "seas": {"source": "game", "commit": DM_COMMIT, "from": ["SubmarineMap", "SubmarineExploration (starting points)"]},
        "sectors": {"source": "game", "commit": DM_COMMIT, "from": ["SubmarineExploration"]},
        "parts": {"source": "game", "commit": DM_COMMIT, "from": ["SubmarinePart", "Item (names)"],
                  "itemIds": {"source": "teamcraft", "commit": TC_COMMIT, "from": ["submarine-parts.json"]}},
        "classes": {"source": "game", "commit": DM_COMMIT, "from": ["SubmarinePart", "Item (class names from part names)"]},
        "ranks": {"source": "game", "commit": DM_COMMIT, "from": ["SubmarineRank"]},
        "statNames": {"source": "game", "commit": DM_COMMIT, "from": ["SubmarineSpecCategory"]},
        "reportLines": {"source": "game", "commit": DM_COMMIT, "from": ["SubmarineExplorationLog"]},
        "items": {"source": "game", "commit": DM_COMMIT, "from": ["Item"]},
        "loot": {"source": "teamcraft", "commit": TC_COMMIT, "from": ["voyage-sources.json"],
                 "label": "possible items only: no quantities, odds or quality",
                 "note": "Reported by Teamcraft users, so the newest sectors may list few items or none."},
        "unlocks": {"source": "submarineTracker", "commit": ST_COMMIT, "from": ["SubmarineTracker/Data/Unlocks.cs"],
                    "label": "community data",
                    "note": "by = the sector whose survey can reveal this one; start = open from the beginning; "
                            "extraSub = surveying this sector grants permission for one more submarine; opensSea = "
                            "surveying this sector opens that sea; mainPath = on the source's main line through the seas. "
                            "The source says discovery is not certain on every visit. The owner's own ticks on the return "
                            "sheet are what the app treats as true for each Free Company (design 5.4)."},
        "subSlots": {"source": "submarineTracker", "commit": ST_COMMIT, "from": ["SubmarineTracker/Data/Unlocks.cs"],
                     "label": "community data",
                     "note": "Submarine slot 2, 3 and 4 and the sector whose survey grants each, in the order they come. "
                             "The source adds that a new slot only shows once the previous one holds a submarine."},
        "formula": {"source": "submarineTracker", "commit": ST_COMMIT,
                    "from": ["SubmarineTracker/SubExplPretty.cs", "SubmarineTracker/Data/Voyage.cs", "SubmarineTracker/Data/Sectors.cs (experience note only)"],
                    "label": "calculated, not yet confirmed"},
        "commonRoutes": {"source": "submarineTracker", "commit": ST_COMMIT, "from": ["SubmarineTracker/Data/Voyage.cs"],
                         "label": "community data", "note": "Route names as the source gives them."},
    },
    "counts": {"sectors": len(sectors), "seas": len(seas), "parts": len(parts), "classes": len(classes), "ranks": len(ranks),
               "expToMaxRank": exp_to_max, "lootPairs": len(pairs), "lootSectors": len(loot),
               "lootItems": len({it for _, it in pairs}), "unlockNameChecks": name_checks},
    "statNames": stat_names,
    "seas": seas,
    "sectors": sectors,
    "classes": classes,
    "parts": parts,
    "ranks": ranks,
    "reportLines": report_lines,
    "items": items,
    "loot": loot,
    "unlocks": unlocks,
    "subSlots": sub_slots,
    "formula": formula,
    "commonRoutes": common,
    "dropped": {
        "emptySectorRows": empty_rows,
        "lootEntries": entries,
        "lootWithoutSector": sorted(no_sector),
        "lootNotOnASector": not_sector,
        "lootRepeats": entries - len(no_sector) - len(not_sector) - len(pairs),
        "sectorsWithoutLoot": sectors_without_loot,
    },
}
def compact(v):
    return json.dumps(v, ensure_ascii=False, separators=(",", ":"))
lines = ["{"]
keys = list(out)
for n, k in enumerate(keys):
    v, end = out[k], "," if n < len(keys) - 1 else ""
    if isinstance(v, list) and v and isinstance(v[0], dict):
        lines.append(" %s:[" % compact(k))
        lines += ["  " + compact(x) + ("," if j < len(v) - 1 else "") for j, x in enumerate(v)]
        lines.append(" ]" + end)
    elif isinstance(v, dict) and k != "counts":
        lines.append(" %s:{" % compact(k))
        sub = list(v.items())
        lines += ["  %s:%s" % (compact(a), compact(b)) + ("," if j < len(sub) - 1 else "") for j, (a, b) in enumerate(sub)]
        lines.append(" }" + end)
    else:
        lines.append(" %s:%s%s" % (compact(k), compact(v), end))
lines.append("}")
with open(OUT, "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")
json.load(open(OUT, encoding="utf-8"))  # the written file must read back
print("%d sectors in %d seas, %d parts in %d classes, %d ranks; loot %d pairs on %d sectors (%d items); "
      "unlocks %d (names checked %d), slots %s; %d common routes -> %s"
      % (len(sectors), len(seas), len(parts), len(classes), len(ranks), len(pairs), len(loot), out["counts"]["lootItems"],
         len(unlocks), name_checks, [s["sector"] for s in sub_slots], len(common), os.path.relpath(OUT)))
