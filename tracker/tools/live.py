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
with open(os.path.join(T, "data", "live.json"), "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
print(json.dumps({"big fish": len(big), "big fish with a window": sum(1 for b in big if "a" in b), "big fish in the fishing log": sum(1 for b in big if b["k"]),
                  "ocean routes": len(routes), "ocean achievements": len(ach_keys), "field zones": {z: len(v) for z, v in FM.items()}, "challenge entries": len(chal),
                  "bytes": os.path.getsize(os.path.join(T, "data", "live.json"))}, indent=1))
