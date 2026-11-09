#!/usr/bin/env python3
"""Build data/live.json for the Live pages (Up Now, Big Fish, Ocean Fishing, Timers & Events, Field Monsters, Gold Saucer).

  DM_RAW=<raw sheets dir> python3 -I tools/live.py <ffxiv-datamining checkout> <ffxiv-teamcraft libs/data/src/lib/json dir>

Run after tools/info.py (it reads data/conditions.json). Sources: the game sheets (IKDRoute, IKDRouteTable, IKDSpot,
FishingSpot, ContentsNote, Achievement), ff14-fish-tracker-app (data/fish-tracker.json), FFXIV Teamcraft monster
positions, and the facts files data/big-fish.json, data/field-monsters.json, data/ocean-fishing.json, data/timers.json,
data/guides.json.
"""
import collections, csv, json, os, re, sys
DM, TC = sys.argv[1:3]
RAW = os.environ.get("DM_RAW", "")
T = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
D = lambda n: json.load(open(os.path.join(T, "data", n), encoding="utf-8"))
def sheet(name):
    p = os.path.join(DM, "csv", "en", name + ".csv")
    if not os.path.exists(p) and RAW: p = os.path.join(RAW, name + ".csv")
    with open(p, encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    return {int(r[0]): dict(zip(rows[0], r)) for r in rows[1:] if r and r[0].isdigit()}
def i(v):
    try: return int(v)
    except (TypeError, ValueError): return 0
clean = lambda s: " ".join(re.sub(r"[-]", "", re.sub(r"<[^>]+>", "", str(s or ""))).split())
norm = lambda s: re.sub(r"[^a-z0-9]+", "", str(s or "").lower().replace("’", "'"))
data, cond = D("tracker-data.json"), D("conditions.json")
PLACE = {k: clean(r["Name"]) for k, r in sheet("PlaceName").items()}
ITEM = {k: clean(r["Name"]) for k, r in sheet("Item").items()}
keys_by_item, keys_by_name, entry = collections.defaultdict(list), {}, {}
for s in data["sections"]:
    for g in s["g"]:
        for e in g["e"]:
            k = s["id"] + ":" + str(e["i"]); entry[k] = e
            if s["id"] in ("fishing", "spearfishing"):
                if e.get("it"): keys_by_item[e["it"]].append(k)
                keys_by_name.setdefault(norm(e["n"]), k)
out = {}

# ---------------------------------------------------------------- big fish
FT = D("fish-tracker.json"); FTF, FTI = FT.get("FISH", {}), FT.get("ITEMS", {})
ft_name = lambda x: (FTI.get(str(x)) or {}).get("name_en") or ITEM.get(i(x), "")
FSRC, SPOTS = json.load(open(os.path.join(TC, "fishing-sources.json"))), {s["id"]: s for s in json.load(open(os.path.join(TC, "fishing-spots.json")))}
TUG, HOOK = {1: "medium", 2: "heavy", 3: "light"}, {1: "Precision", 2: "Powerful"}
WNAME = {k: clean(r["Name"]) for k, r in sheet("Weather").items()}
WID = {}
for k_ in sorted(WNAME):  # the first (ordinary) weather of each name
    if WNAME[k_]: WID.setdefault(norm(WNAME[k_]), k_)
FSP, TTY = sheet("FishingSpot"), sheet("TerritoryType")
spot_zone = lambda sid: PLACE.get(i(TTY.get(i(FSP.get(i(sid), {}).get("TerritoryType")), {}).get("PlaceName")), "")
big = []
for f in D("big-fish.json")["fish"]:
    k = keys_by_name.get(norm(f["n"]))
    e = entry.get(k, {})
    it = e.get("it")
    ft = FTF.get(str(it), {})
    c = cond["cond"].get(k)
    row = {"k": k, "n": f["n"], "kind": f["kind"], "ex": f["ex"]}
    if c: row.update({"z": c[0], "a": c[1], "b": c[2], "w": c[3], "pw": c[4]})
    src = (FSRC.get(str(it)) or [{}])[0] if it else {}
    sp = SPOTS.get(src.get("spot"), {})
    if sp:
        row["spot"] = PLACE.get(i(sp.get("placeId")), "")
        if sp.get("coords"): row["xy"] = [round(sp["coords"]["x"], 1), round(sp["coords"]["y"], 1)]
        if not row.get("z"): row["z"] = spot_zone(src.get("spot")) or PLACE.get(i(sp.get("zoneId")), "")
    if src.get("tug") in TUG: row["tug"] = TUG[src["tug"]]
    if src.get("hookset") in HOOK: row["hook"] = HOOK[src["hookset"]]
    path = [ft_name(x) for x in ft.get("bestCatchPath") or []]
    if path: row["bait"] = path
    pred = [[ft_name(x), n] for x, n in (ft.get("predators") or [])]
    if pred: row["pred"] = pred
    if ft.get("fishEyes") is True: row["eyes"] = 1
    if ft.get("folklore"): row["folk"] = ((FT.get("FOLKLORE", {}).get(str(ft["folklore"])) or {}).get("book_en") or "")
    wk = f.get("wiki") or {}
    if wk and not c:  # the fish-tracker data gives no window (no limit, or newest fish): the wiki's table row does
        a, b = wk.get("time-start"), wk.get("time-end")
        ws = [WID.get(norm(x)) for x in (wk.get("weather-current") or "").split(",") if WID.get(norm(x))]
        pws = [WID.get(norm(x)) for x in (wk.get("weather-previous") or "").split(",") if WID.get(norm(x))]
        if a is not None or ws or pws:
            row.update({"a": float(a or 0), "b": float(24 if b in (None, 0) and not a else (b or 24)), "w": ws, "pw": pws})
        if wk.get("zone") and not row.get("z"): row["z"] = wk["zone"]
        if wk.get("spot"): row["spot"] = wk["spot"]
        if wk.get("xy") and not row.get("xy"): row["xy"] = wk["xy"]
        if wk.get("req") and not row.get("pred"): row["req"] = wk["req"]
    if "a" not in row and ft:  # in the fish-tracker data without any time or weather: no limit
        row.update({"a": 0.0, "b": 24.0, "w": [], "pw": []})
        if wk.get("bait") and not row.get("bait"): row["bait"] = [wk["bait"].title()]
        if wk.get("lure"): row["lure"] = wk["lure"].split(";")[0].title() + " lure"
    if not row.get("z") and row.get("spot"):  # zone from the fishing hole's place
        for spx in SPOTS.values():
            if PLACE.get(i(spx.get("placeId"))) == row["spot"]: row["z"] = PLACE.get(i(spx.get("zoneId")), ""); break
    big.append(row)
out["bigfish"] = big

# ---------------------------------------------------------------- ocean fishing
OF = D("ocean-fishing.json")
ROUTE, RT, SPOT, FS = sheet("IKDRoute"), sheet("IKDRouteTable"), sheet("IKDSpot"), sheet("FishingSpot")
TOD = {1: "Night", 2: "Day", 3: "Sunset"}
def spot_fish(fs):
    r = FS.get(fs, {}); ks = []
    for n in range(12):
        it = i(r.get(f"Item[{n}]"))
        if it and keys_by_item.get(it): ks.append(keys_by_item[it][0])
    return ks
routes = {}
for rid, r in ROUTE.items():
    if not rid or not clean(r.get("Name")): continue
    stops = []
    for n in range(3):
        sp = SPOT.get(i(r.get(f"Spot[{n}]")), {})
        stops.append({"name": PLACE.get(i(sp.get("PlaceName")), ""), "time": TOD.get(i(r.get(f"Time[{n}]")), ""),
                      "fish": spot_fish(i(sp.get("SpotMain"))), "spectral": spot_fish(i(sp.get("SpotSub")))})
    routes[str(rid)] = {"name": clean(r["Name"]), "stops": stops, "targets": OF["targets"].get(str(rid), []),
                        "line": "Ruby" if rid >= 13 else "Indigo"}
ACH = sheet("Achievement")
ach_keys = []
for s in data["sections"]:
    if not s["id"].startswith("ach-"): continue
    for g in s["g"]:
        for e in g["e"]:
            dsc = clean(ACH.get(e["i"], {}).get("Description"))
            if "ocean fishing" in dsc.lower() or "spectral current" in dsc.lower(): ach_keys.append([s["id"] + ":" + str(e["i"]), e["n"], dsc])
out["ocean"] = {"offset": OF["offset"], "period": OF["period"], "table": [[i(RT[n]["IndigoRoute"]), i(RT[n]["RubyRoute"])] for n in sorted(RT)],
                "routes": routes, "ach": ach_keys}

# ---------------------------------------------------------------- field monsters and the challenge log
FM = D("field-monsters.json")["zones"]
MON = json.load(open(os.path.join(TC, "monsters.json")))
BN = {k: clean(r.get("Singular")) for k, r in sheet("BNpcName").items()}
WEATHER_ZONE = {"Eureka Anemos": "Eureka Anemos", "Eureka Pagos": "Eureka Pagos", "Eureka Pyros": "Eureka Pyros", "Eureka Hydatos": "Eureka Hydatos",
                "The Bozjan Southern Front": "Bozjan Southern Front", "Zadnor": "Zadnor", "The Occult Crescent: South Horn": "South Horn",
                "The Occult Crescent: North Horn": "North Horn"}
for z, wz in WEATHER_ZONE.items():  # add every monster Teamcraft places there that the wiki does not list
    have = {norm(m["n"]) for m in FM.get(z, [])}
    for bid, m in MON.items():
        for p in m.get("positions") or []:
            if PLACE.get(i(p.get("zoneid"))) in (z, wz) and BN.get(i(bid)) and norm(BN[i(bid)]) not in have:
                nm = BN[i(bid)]; nm = nm[:1].upper() + nm[1:]
                FM.setdefault(z, []).append({"n": nm, "lv": str(p.get("level") or ""), "x": round(p["x"], 1), "y": round(p["y"], 1)})
                have.add(norm(nm)); break
NOTE = sheet("ContentsNote")
chal = [[k, clean(r["Name"]), clean(r["Description"]).split("※")[0].strip()] for k, r in sorted(NOTE.items()) if i(r.get("ContentType")) == 13 and clean(r.get("Name"))]
ORDER = ["Eureka Anemos", "Eureka Pagos", "Eureka Pyros", "Eureka Hydatos", "The Bozjan Southern Front", "Zadnor", "The Occult Crescent: South Horn", "The Occult Crescent: North Horn"]
FM = {z: FM[z] for z in ORDER if z in FM}
out["field"] = {"zones": FM, "weatherZone": WEATHER_ZONE, "challenge": chal,
                "events": D("field-events.json")["events"]}

# ---------------------------------------------------------------- timers, guides, Gold Saucer
out["timers"] = D("timers.json")
out["guides"] = {k: v for k, v in D("guides.json").items() if not k.startswith("_")}
out["gate"] = [[0, ["Air Force One (the Cieldalaes)", "Cliffhanger", "Leap of Faith"]], [20, ["Any Way the Wind Blows", "The Slice Is Right", "Air Force One (the Gold Saucer)"]],
               [40, ["The Slice Is Right", "Leap of Faith", "Air Force One (the Cieldalaes)"]]]
# ---------------------------------------------------------------- S-rank elite marks: condition text, and a computable window where weather, time or moon decide
EM = D("elite-marks.json")["marks"]
SPEC = {  # facts from each mark's spawn condition (data/elite-marks.json), in a form the page can forecast
    "Laideronnette": {"zone": "Central Shroud", "w": ["Rain"], "pw": ["Rain"], "note": "appears about 6 minutes into the second Rain in a row"},
    "Kirlirger the Abhorrent": {"zone": "Urqopacha", "w": ["Fog"], "moon": "new"},
    "Burfurlur the Canny": {"zone": "Labyrinthos", "w": ["Clear Skies", "Fair Skies"], "h": [6, 18]},
    "Okina": {"zone": "The Ruby Sea", "moon": "full", "h": [12, 24]},
    "Croakadile": {"zone": "Lower La Noscea", "moon": "full"},
    "Mindflayer": {"zone": "South Shroud", "moon": "new", "h": [0, 1]},
    "Croque-Mitaine": {"zone": "Middle La Noscea", "h": [19, 22]},
    "Bonnacon": {"zone": "Western La Noscea", "h": [8, 11]},
    "Thousand-cast Theda": {"zone": "North Shroud", "h": [17, 21]},
    "The Garlok": {"zone": "Eastern La Noscea", "dry": 200},
}
out["srank"] = [dict({"n": n, "area": v.get("area"), "spawn": v.get("spawn"), "respawn": v.get("respawn")}, **({"spec": {k: ([WID[norm(x)] for x in s] if k in ("w", "pw") else s) for k, s in SPEC[n].items()}} if n in SPEC else {}))
                for n, v in EM.items() if v.get("rank") == "S"]
# ---------------------------------------------------------------- Island Sanctuary: rare animals and the workshop planner
ISL = D("island.json")
THEME = {k: clean(r["Name"]) for k, r in sheet("MJICraftworksObjectTheme").items()}
CW = json.load(open(os.path.join(TC, "island-craftworks.json")))
out["island"] = {"animals": ISL["animals"], "multiplier": ISL["multiplier"], "supply": ISL["supply"],
                 "crafts": sorted([{"n": re.sub(r"^Isleworks ", "", ITEM.get(c["itemId"], "")), "v": c["value"], "t": c["craftingTime"], "th": [THEME.get(x, "") for x in c.get("themes") or []], "lvl": c.get("lvl", 1)}
                                   for c in CW.values() if ITEM.get(c.get("itemId"))], key=lambda x: (x["lvl"], x["n"]))}
# ---------------------------------------------------------------- PvP series rewards and seasonal event rewards (from the FFXIV Collect sources on collection entries)
series, events = collections.defaultdict(list), collections.defaultdict(list)
for s in data["sections"]:
    for g in s["g"]:
        for e in g["e"]:
            for src in e.get("src") or []:
                m = re.match(r"PvP: PvP Series (\d+) - Level (\d+)", src)
                if m: series[int(m.group(1))].append([int(m.group(2)), s["id"] + ":" + str(e["i"]), e["n"]])
                m = re.match(r"Event: (.+)$", src)
                if m: events[m.group(1).strip()].append(s["id"] + ":" + str(e["i"]))
out["pvp"] = {str(k): sorted(v) for k, v in sorted(series.items())}
out["eventRewards"] = dict(events)
out["dc"] = {"Japan": {"dcs": ["Elemental", "Gaia", "Mana", "Meteor"], "day": 6, "utc": 12}, "North America": {"dcs": ["Aether", "Crystal", "Dynamis", "Primal"], "day": 0, "utc": 2},
             "Europe": {"dcs": ["Chaos", "Light", "Shadow"], "day": 6, "utc": 19}, "Oceania": {"dcs": ["Materia"], "day": 6, "utc": 9}}
# ---------------------------------------------------------------- worlds by data center (market board, housing and hunt records)
WDC = {k: clean(r["Name"]) for k, r in sheet("WorldDCGroupType").items()}
worlds = collections.defaultdict(list)
for k, r in sheet("World").items():
    if r.get("IsPublic") == "True" and WDC.get(i(r["DataCenter"])) and "Cloud" not in WDC[i(r["DataCenter"])]:
        worlds[WDC[i(r["DataCenter"])]].append([k, clean(r["Name"])])
out["worlds"] = {dc: sorted(v, key=lambda x: x[1]) for dc, v in sorted(worlds.items())}
# ---------------------------------------------------------------- hunts: every S, SS and A rank with its respawn window, spawn points per zone, world boss FATEs
EXV = {0: "A Realm Reborn", 1: "Heavensward", 2: "Stormblood", 3: "Shadowbringers", 4: "Endwalker", 5: "Dawntrail"}
TT = sheet("TerritoryType"); MAPS = sheet("Map")
zone_tt = {}
for k, r in TT.items():
    if i(r["TerritoryIntendedUse"]) == 1 and PLACE.get(i(r["PlaceName"])):
        zone_tt.setdefault(norm(PLACE[i(r["PlaceName"])]), k)
SP = D("spawn-points.json")["zones"]
def hours(t):
    t = t.strip()
    m = re.match(r"^(\d+):(\d+)$", t)
    return round(int(m.group(1)) + int(m.group(2)) / 60, 3) if m else float(t)
def respawn(txt):
    t = (txt or "").lower().replace(",", ";")
    nums = re.findall(r"\d+(?::\d+)?", t)
    if not nums: return None
    m = re.match(r"^\s*([\d:]+)(?:\s*(?:-|to)\s*([\d:]+))?", t)
    lo, hi = hours(m.group(1)), hours(m.group(2) or m.group(1))
    mm = re.search(r"maintenance:\s*([\d:]+)(?:\s*-\s*([\d:]+))?", t)
    return [lo, hi] + ([hours(mm.group(1)), hours(mm.group(2) or mm.group(1))] if mm else [])
hunts, spawn_zones = [], {}
SS_AREA = {"Norvrandt": "Shadowbringers", "Endwalker areas": "Endwalker", "Dawntrail areas": "Dawntrail"}
for n, v in EM.items():
    if v.get("rank") not in ("S", "A"): continue
    area = v.get("area") or ""
    tt = zone_tt.get(norm(area))
    ss = area in SS_AREA
    ex = SS_AREA[area] if ss else EXV.get(i(TT[tt]["ExVersion"])) if tt else None
    if not ex: print("hunt mark without a zone:", n, area); continue
    h = {"n": n, "r": "SS" if ss else v["rank"], "z": area, "ex": ex, "spawn": v.get("spawn") if v.get("spawn") not in (None, "None") else "", "rs": respawn(v.get("respawn"))}
    if tt:
        h["tt"] = tt
        if str(tt) in SP and str(tt) not in spawn_zones:
            sf = i(MAPS.get(i(TT[tt]["Map"]), {}).get("SizeFactor")) or 100
            spawn_zones[str(tt)] = {"n": area, "max": round(41 * 100 / sf + 1, 1), "pts": SP[str(tt)]["pts"]}
    hunts.append(h)
ORDER_EX = list(EXV.values())
hunts.sort(key=lambda h: (ORDER_EX.index(h["ex"]), h["z"], {"S": 0, "SS": 1, "A": 2}[h["r"]], h["n"]))
out["hunts"] = {"marks": hunts, "spawn": spawn_zones, "bosses": D("boss-fates.json")["bosses"]}
with open(os.path.join(T, "data", "live.json"), "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
print(json.dumps({"big fish": len(big), "big fish with a window": sum(1 for b in big if "a" in b), "big fish in the fishing log": sum(1 for b in big if b["k"]),
                  "ocean routes": len(routes), "ocean achievements": len(ach_keys), "field zones": {z: len(v) for z, v in FM.items()}, "challenge entries": len(chal),
                  "bytes": os.path.getsize(os.path.join(T, "data", "live.json"))}, indent=1))
