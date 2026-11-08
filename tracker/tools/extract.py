#!/usr/bin/env python3
"""Build data/tracker-data.json for the Eveniunt Completionist Tracker.

Usage:
  python3 -I tools/extract.py <ffxiv-datamining checkout> <teamcraft json dir> [--out data/tracker-data.json]

Inputs (both pinned, see data/SOURCES.md):
  * xivapi/ffxiv-datamining (English CSVs) - every entry, name, and in-game grouping.
  * FFXIV Teamcraft data files (MIT): item-patch.json, patch-content.json, patch-names.json - the patch
    each item, quest, achievement or duty arrived in; used for grouping and labelled as community data.

Nothing is typed by hand: every entry comes from a game sheet row. Rows without a name, and collectibles
with no way to obtain them in the game data (no unlock item, no guide order), are dropped and counted
in the report.
"""
import csv, json, os, re, sys, collections

DM_COMMIT = "44948e4cda5846eab0baa9872122a888fcc4f1b1"
TC_COMMIT = "c1ede0a03c0072c830e0a1b3b8e7a20ea539e3b3"  # files: item-patch, patch-content, patch-names, gathering-log-pages, fates

args = [a for a in sys.argv[1:] if not a.startswith("--")]
if len(args) < 2:
    sys.exit(__doc__)
DM, TC = args
OUT = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "data", "tracker-data.json")

_cache = {}
def sheet(name):
    """Return {row_id(int): {column: value}} for an English sheet."""
    if name not in _cache:
        _p = os.path.join(DM, "csv", "en", name + ".csv")
        if not os.path.exists(_p) and os.environ.get("DM_RAW"): _p = os.path.join(os.environ["DM_RAW"], name + ".csv")  # same commit, fetched
        with open(_p, encoding="utf-8-sig") as f:
            rows = list(csv.reader(f))
        head = rows[0]
        _cache[name] = {int(r[0]): dict(zip(head, r)) for r in rows[1:] if r and r[0].isdigit()}
    return _cache[name]

def i(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return 0

def clean(s):
    return " ".join((s or "").replace(" ", " ").split())

def tc(name):
    with open(os.path.join(TC, name + ".json"), encoding="utf-8") as f:
        return json.load(f)

# ---------------------------------------------------------------- patches
PATCH_NAMES = tc("patch-names")
ITEM_PATCH = {int(k): v for k, v in tc("item-patch").items()}
CONTENT_PATCH = collections.defaultdict(dict)  # kind -> id -> patch id
for pid, kinds in tc("patch-content").items():
    for kind, ids in kinds.items():
        for x in ids:
            CONTENT_PATCH[kind][int(x)] = int(pid)
EXPANSIONS = [clean(r["Name"]) for _, r in sorted(sheet("ExVersion").items())]

def patch_of(pid):
    p = PATCH_NAMES.get(str(pid))
    return (p["version"], p["ex"]) if p else (None, None)

problems = collections.Counter()
report = collections.OrderedDict()

def by_expansion(entries, title_suffix=""):
    """Group entries (dicts with optional 'ex') by expansion, in release order; unknown patch last."""
    groups = collections.OrderedDict((n, []) for n in EXPANSIONS)
    unknown = []
    for e in entries:
        ex = e.pop("ex", None)
        (groups[EXPANSIONS[ex]] if ex is not None and ex < len(EXPANSIONS) else unknown).append(e)
    out = [{"t": k + title_suffix, "e": v} for k, v in groups.items() if v]
    if unknown:
        out.append({"t": "Patch not recorded", "e": unknown})
    return out

def entry(id_, name, patch_id=None, **extra):
    e = {"i": id_, "n": name}
    v, ex = patch_of(patch_id) if patch_id is not None else (None, None)
    if v == "4.31" and extra.get("_kind") == "quest":
        # Teamcraft files every quest that existed by 4.31 under 4.31 (its baseline), so the label would be wrong
        problems["quest patch not recorded (4.31 or earlier)"] += 1
        v = None
    if v:
        e["p"] = v
        e["ex"] = ex
    else:
        problems["no patch: " + extra.get("_kind", "?")] += 1
    extra.pop("_kind", None)
    e.update({k: v for k, v in extra.items() if v not in (None, "", 0)})
    return e

# ---------------------------------------------------------------- unlock items
ITEM = sheet("Item")
IA = sheet("ItemAction")
UNLOCK = collections.defaultdict(dict)  # action type -> data0 or AdditionalData -> item id
for iid, it in ITEM.items():
    a = i(it["ItemAction"])
    if a and a in IA and it["Name"]:
        act = IA[a]
        key = i(act["Data[0]"]) or i(it["AdditionalData"])
        UNLOCK[i(act["Action"])].setdefault(key, iid)
        UNLOCK[(i(act["Action"]), "add")].setdefault(i(it["AdditionalData"]), iid)

def item_patch(iid):
    return ITEM_PATCH.get(iid)

sections = []

def section(sid, title, area, groups, note=None):
    n = sum(len(g["e"]) if "e" in g else sum(len(s["e"]) for s in g["g"]) for g in groups)
    s = {"id": sid, "t": title, "area": area, "g": groups}
    if note:
        s["note"] = note
    sections.append(s)
    report[sid] = n
    return s

# ---------------------------------------------------------------- collections
def mounts():
    out = []
    for mid, r in sorted(sheet("Mount").items()):
        name = clean(r["Singular"])
        if not name:
            continue
        item = UNLOCK[1322].get(mid)
        gone = i(r["Order"]) <= 0 and not item
        if gone:
            problems["mount in game files with no guide order or item (kept, marked not obtainable)"] += 1
        pid = item_patch(item) if item else None
        out.append(entry(mid, name.title() if name.islower() else name, pid, _kind="mount", it=item,
                         seats=i(r["ExtraSeats"]) + 1 if i(r["ExtraSeats"]) else 0, o=i(r["Order"]) if not gone else 99999,
                         x="gone" if gone else None))
    out.sort(key=lambda e: (e.get("o", 0)))
    return out

def minions():
    out = []
    races = sheet("MinionRace")
    for cid, r in sorted(sheet("Companion").items()):
        name = clean(r["Singular"])
        if not name:
            continue
        item = UNLOCK[853].get(cid)
        if i(r["Order"]) <= 0 and not item:
            problems["minion without guide order or item"] += 1
            continue
        out.append(entry(cid, name[0].upper() + name[1:], item_patch(item) if item else None, _kind="minion",
                         it=item, race=clean(races.get(i(r["MinionRace"]), {}).get("Name")), o=i(r["Order"])))
    out.sort(key=lambda e: e.get("o", 0))
    seen, uniq = set(), []
    for e in out:  # a few minions have several rows under one name (one per starting city); keep one
        if e["n"] in seen:
            problems["minion duplicate name (dropped)"] += 1
            continue
        seen.add(e["n"]); uniq.append(e)
    return uniq

def orchestrion():
    cats = sheet("OrchestrionCategory")
    ui = sheet("OrchestrionUiparam")
    groups = collections.OrderedDict()
    order = {}
    for oid, r in sorted(sheet("Orchestrion").items()):
        name = clean(r["Name"])
        if not name:
            continue
        u = ui.get(oid, {})
        cat = i(u.get("OrchestrionCategory"))
        item = UNLOCK[(25183, "add")].get(oid)
        e = entry(oid, name, item_patch(item) if item else None, _kind="orchestrion", it=item,
                  no=i(u.get("Order")) if i(u.get("Order")) and i(u.get("Order")) < 65535 else 0)
        e.pop("ex", None)
        cname = clean(cats.get(cat, {}).get("Name")) or "Other"
        order[cname] = i(cats.get(cat, {}).get("Order")) if cat else 999
        groups.setdefault(cname, []).append(e)
    out = []
    for k in sorted(groups, key=lambda k: order[k]):
        out.append({"t": k, "e": sorted(groups[k], key=lambda e: e.get("no") or 99999)})
    return out

def emotes():
    cats = sheet("EmoteCategory")
    tcmd = sheet("TextCommand")
    groups = collections.OrderedDict()
    for eid, r in sorted(sheet("Emote").items(), key=lambda kv: i(kv[1]["Order"])):
        name = clean(r["Name"])
        if not name or not i(r["UnlockLink"]):
            continue  # learned by default: nothing to collect
        item = UNLOCK[2633].get(i(r["UnlockLink"]))
        cmd = clean(tcmd.get(i(r["TextCommand"]), {}).get("Command"))
        e = entry(eid, name, item_patch(item) if item else None, _kind="emote", it=item, cmd=cmd)
        e.pop("ex", None)
        groups.setdefault(clean(cats.get(i(r["EmoteCategory"]), {}).get("Name")) or "Other", []).append(e)
    # the sheet has a second row for a few emotes (same name, same unlock item, or no item at all): one emote to the
    # player, so the later row becomes an alias of the first (FFXIV Collect lists the lower id; ticks on either count)
    for es in groups.values():
        first, keep = {}, []
        for e in es:
            k = (e["n"], e.get("it"))
            if k in first:
                first[k].setdefault("al", []).append(e["i"])
                problems["emote duplicate row (merged into the first)"] += 1
                continue
            first[k] = e
            keep.append(e)
        es[:] = keep
    return [{"t": k, "e": v} for k, v in groups.items()]

def hairstyles():
    seen = {}
    for cid, r in sorted(sheet("CharaMakeCustomize").items()):
        item = i(r["HintItem"])
        if r["IsPurchasable"] == "True" and item and item in seen:
            seen[item].setdefault("al", []).append(cid)  # other race/gender rows of the same style
            continue
        if r["IsPurchasable"] != "True" or not item:
            continue
        name = clean(ITEM.get(item, {}).get("Name"))
        if not name:
            continue
        for pre in ("Modern Aesthetics - ", "Modern Cosmetics - "):
            name = name[len(pre):] if name.startswith(pre) else name
        seen[item] = entry(item, name, item_patch(item), _kind="hairstyle", it=item)
        seen[item]["al"] = [cid]
    return list(seen.values())

def cards():
    res = sheet("TripleTriadCardResident")
    rar = sheet("TripleTriadCardRarity")
    typ = sheet("TripleTriadCardType")
    groups = collections.OrderedDict()
    for cid, r in sorted(sheet("TripleTriadCard").items()):
        name = clean(r["Name"])
        rr = res.get(cid, {})
        if not name or not i(rr.get("Order")):
            continue
        item = UNLOCK[3357].get(cid)
        stars = i(rar.get(i(rr.get("TripleTriadCardRarity")), {}).get("Stars"))
        e = entry(cid, name, item_patch(item) if item else None, _kind="card", it=item, no=i(rr.get("Order")),
                  stars=stars, type=clean(typ.get(i(rr.get("TripleTriadCardType")), {}).get("Name")),
                  sides=[i(rr.get(k)) for k in ("Top", "Right", "Bottom", "Left")])
        e.pop("ex", None)
        kind = "Ex cards" if i(rr.get("UIPriority")) else "Standard cards"
        groups.setdefault(kind, []).append(e)
    out = []
    for k in ("Standard cards", "Ex cards"):
        if k in groups:
            lst = sorted(groups[k], key=lambda e: e["no"])
            for start in range(0, len(lst), 50):
                chunk = lst[start:start + 50]
                out.append({"t": f"{k} No. {chunk[0]['no']}–{chunk[-1]['no']}", "e": chunk})
    return out

def blue_magic():
    tr = sheet("AozActionTransient")
    act = sheet("Action")
    out = []
    for aid, r in sorted(sheet("AozAction").items()):
        a = i(r["Action"])
        if not a:
            continue
        t = tr.get(aid, {})
        name = clean(act.get(a, {}).get("Name"))
        if not name:
            continue
        out.append(entry(aid, name, CONTENT_PATCH["action"].get(a), _kind="blue magic", no=i(t.get("Number")),
                         rank=i(r["Rank"]), where=clean(t.get("Location"))))
    out.sort(key=lambda e: e["no"])
    for e in out:
        e.pop("ex", None)
    return [{"t": f"Spells No. {c[0]['no']}–{c[-1]['no']}", "e": c} for c in
            (out[k:k + 25] for k in range(0, len(out), 25))]

def simple_items(sheet_name, action, kind, name_col="Singular", require_item=True, order_col="Order"):
    out = []
    for rid, r in sorted(sheet(sheet_name).items()):
        name = clean(r.get(name_col) or r.get("Singular"))
        if not name:
            continue
        item = UNLOCK[action].get(rid) or UNLOCK[(action, "add")].get(rid)
        if require_item and not item and not i(r.get(order_col)):
            problems[f"{kind} without item"] += 1
            continue
        out.append(entry(rid, name[0].upper() + name[1:], item_patch(item) if item else None, _kind=kind, it=item,
                         o=i(r.get(order_col))))
    out.sort(key=lambda e: (e.get("o") or 99999, e["i"]))
    return out

def facewear():
    """One entry per facewear unlock item (its AdditionalData is the first Glasses row it teaches)."""
    glasses = sheet("Glasses")
    out = []
    for gid, item in sorted(UNLOCK[(37312, "add")].items()):
        name = clean(glasses.get(gid, {}).get("Name"))
        if not name:
            continue
        style = i(glasses[gid].get("Style"))
        alias = sorted(k for k, g in glasses.items() if i(g.get("Style")) == style and k != gid and clean(g.get("Name")))
        out.append(entry(gid, name, item_patch(item), _kind="facewear", it=item, al=alias))
    return out

def barding():
    out = []
    for bid, r in sorted(sheet("BuddyEquip").items()):
        name = clean(r["Name"])
        if not name:
            continue
        item = UNLOCK[1013].get(bid)
        if not item and not i(r["Order"]):
            problems["barding without item"] += 1
            continue
        out.append(entry(bid, name, item_patch(item) if item else None, _kind="barding", it=item, o=i(r["Order"])))
    out.sort(key=lambda e: e.get("o") or 99999)
    return out

section("mounts", "Mounts", "Collections", by_expansion(mounts()))
section("minions", "Minions", "Collections", by_expansion(minions()))
section("orchestrion", "Orchestrion Rolls", "Collections", orchestrion())
section("emotes", "Emotes", "Collections", emotes(), note="Only emotes that must be unlocked; default emotes are left out.")
section("hairstyles", "Hairstyles", "Collections", by_expansion(hairstyles()))
section("cards", "Triple Triad Cards", "Collections", cards())
section("bluemagic", "Blue Magic Spells", "Collections", blue_magic())
def fashion():
    # Spectacles were moved from fashion accessories to facewear in patch 7.0; their old rows remain.
    out = []
    for e in simple_items("Ornament", 20086, "fashion accessory"):
        if "Spectacles" in e["n"]:
            problems["fashion accessory now facewear (dropped)"] += 1
        else:
            out.append(e)
    return out

section("fashion", "Fashion Accessories", "Collections", by_expansion(fashion()))
section("facewear", "Facewear", "Collections", by_expansion(facewear()))
section("barding", "Chocobo Barding", "Collections", by_expansion(barding()))

# ---------------------------------------------------------------- quests
def quests():
    secs, cats, gens = sheet("JournalSection"), sheet("JournalCategory"), sheet("JournalGenre")
    tree = collections.OrderedDict()
    for qid, r in sorted(sheet("Quest").items()):
        name = clean(r["Name"])
        g = i(r["JournalGenre"])
        if not name or not g or g not in gens:
            continue
        c = i(gens[g]["JournalCategory"])
        s = i(cats.get(c, {}).get("JournalSection"))
        e = entry(qid, name, CONTENT_PATCH["quest"].get(qid), _kind="quest", lv=i(r.get("ClassJobLevel[0]")))
        e.pop("ex", None)
        # seasonal event quests (the journal genres "... Events", and any quest the sheet ties to a festival) can only be
        # done while their event runs and each year brings new ones: time-limited, left out of totals unless counted
        if clean(gens[g]["Name"]).endswith(" Events") or i(r.get("Festival")):
            e["x"] = "lim"
            problems["quest: seasonal event (marked time-limited)"] += 1
        tree.setdefault(s, collections.OrderedDict()).setdefault(c, collections.OrderedDict()).setdefault(g, []).append(e)
    out = []
    for s in sorted(tree):
        groups = []
        for c in sorted(tree[s], key=lambda c: i(cats[c].get("Order") or c) if "Order" in cats[c] else c):
            for g in sorted(tree[s][c]):
                groups.append({"t": clean(gens[g]["Name"]), "c": clean(cats[c]["Name"]), "e": tree[s][c][g]})
        out.append((clean(secs[s]["Name"]), groups))
    return out

for title, groups in quests():
    sid = "quests-" + "".join(ch for ch in title.lower() if ch.isalnum())[:24]
    section(sid, title, "Quests", groups)

# ---------------------------------------------------------------- achievements
def achievements():
    kinds, cats = sheet("AchievementKind"), sheet("AchievementCategory")
    tree = collections.OrderedDict()
    for aid, r in sorted(sheet("Achievement").items(), key=lambda kv: (i(kv[1]["Order"]), kv[0])):
        name = clean(r["Name"])
        c = i(r["AchievementCategory"])
        if not name or not c or c not in cats:
            continue
        k = i(cats[c]["AchievementKind"])
        e = entry(aid, name, CONTENT_PATCH["achievement"].get(aid), _kind="achievement", pts=i(r["Points"]),
                  d=clean(r["Description"]))
        e.pop("ex", None)
        tree.setdefault(k, collections.OrderedDict()).setdefault(c, []).append(e)
    for k in sorted(tree, key=lambda k: i(kinds[k].get("Order")) or k):
        groups = [{"t": clean(cats[c]["Name"]), "e": tree[k][c]}
                  for c in sorted(tree[k], key=lambda c: (i(cats[c]["Order"]), c))]
        yield clean(kinds[k]["Name"]), groups

for title, groups in achievements():
    sid = "ach-" + "".join(ch for ch in title.lower() if ch.isalnum())
    section(sid, "Achievements: " + title, "Achievements", groups)


# ---------------------------------------------------------------- logs
JOBS8 = ["Carpenter", "Blacksmith", "Armorer", "Goldsmith", "Leatherworker", "Weaver", "Alchemist", "Culinarian"]

def crafting_log():
    rec, rlt = sheet("Recipe"), sheet("RecipeLevelTable")
    nd, ndc = sheet("NotebookDivision"), sheet("NotebookDivisionCategory")
    pages = {}
    for row, r in sheet("RecipeNotebookList").items():
        if row < 1000:
            job, div = divmod(row, 40)
        else:
            q, job = divmod(row - 1000, 8)
            div = 1000 + q
        ids = [i(v) for k, v in r.items() if k.startswith("Recipe[") and i(v) > 0]
        if ids:
            pages[(job, div)] = ids
    def order(d):
        return (0, d) if d < 1000 else (1, i(ndc.get(i(nd.get(d, {}).get("NotebookDivisionCategory")), {}).get("Index")) or 99, d)
    for job in range(8):
        groups = []
        for div in sorted({d for (j, d) in pages if j == job}, key=order):
            dname = clean(nd.get(div, {}).get("Name"))
            if not dname or dname.startswith("["):
                problems["recipes outside the crafting log (kept as their own group)"] += 1
                dname, div_hidden = "Recipes not shown in the crafting log (Cosmic Exploration and others)", True
            else:
                div_hidden = False
            if div < 1000 and not div_hidden:
                dname = "Level " + dname
            cat = clean(ndc.get(i(nd.get(div, {}).get("NotebookDivisionCategory")), {}).get("Name")) if div >= 1000 else ""
            es = []
            for rid in pages[(job, div)]:
                r = rec.get(rid)
                if not r:
                    continue
                item = i(r["ItemResult"])
                name = clean(ITEM.get(item, {}).get("Name"))
                if not name:
                    continue
                e = entry(rid, name, item_patch(item), _kind="recipe", it=item,
                          lv=i(rlt.get(i(r["RecipeLevelTable"]), {}).get("ClassJobLevel")),
                          stars=i(rlt.get(i(r["RecipeLevelTable"]), {}).get("Stars")))
                e.pop("ex", None)
                es.append(e)
            if es:
                if div_hidden and groups and groups[-1]["t"] == dname:
                    groups[-1]["e"].extend(es)
                else:
                    groups.append({"t": dname, "c": "Other" if div_hidden else (cat or "By level"), "e": es})
        section("craft-" + JOBS8[job].lower(), "Crafting Log: " + JOBS8[job], "Logs", groups)

TC_LOG_TAB = {}
for _tab, _pages in enumerate(tc("gathering-log-pages")):
    for _pg in _pages:
        for _x in _pg["items"]:
            TC_LOG_TAB.setdefault(_x["itemId"], (_tab, _pg["startLevel"]))

def gathering_log():
    gi, gpb, gp = sheet("GatheringItem"), sheet("GatheringPointBase"), sheet("GatheringPoint")
    lvl, sub = sheet("GatheringItemLevelConvertTable"), sheet("GatheringSubCategory")
    in_log = set()
    for r in sheet("GatheringNotebookList").values():
        in_log.update(i(v) for k, v in r.items() if k.startswith("GatheringItem[") and i(v) > 0)
    gtype, gsub = {}, {}
    base_sub = {}
    for p in gp.values():
        if i(p["GatheringSubCategory"]):
            base_sub[i(p["GatheringPointBase"])] = i(p["GatheringSubCategory"])
    for bid, b in gpb.items():
        for k in range(8):
            x = i(b.get(f"Item[{k}]"))
            if x:
                gtype.setdefault(x, i(b["GatheringType"]))
                if bid in base_sub:
                    gsub.setdefault(x, base_sub[bid])
    jobs = {"Miner": {}, "Botanist": {}}
    for gid in sorted(in_log):
        r = gi.get(gid)
        if not r:
            continue
        item = i(r["Item"])
        name = clean(ITEM.get(item, {}).get("Name"))
        t = gtype.get(gid)
        if not name:
            continue
        if t is None and item in TC_LOG_TAB:
            t, tc_page_lv = TC_LOG_TAB[item]
            problems["gathering item placed by Teamcraft log pages (no node in the game data)"] += 1
        if t is None:
            problems["gathering log item with no known spot (kept, counted, own group)"] += 1
            e = entry(gid, name, item_patch(item), _kind="gathering", it=item)
            e.pop("ex", None)
            jobs.setdefault("Unplaced", {}).setdefault("In the gathering log, spot not in the data", []).append(e)
            continue
        job = "Miner" if t in (0, 1) else "Botanist"
        L = lvl.get(i(r["GatheringItemLevel"]), {})
        lv, stars = i(L.get("GatheringItemLevel")), i(L.get("Stars"))
        sc = gsub.get(gid)
        if sc and clean(sub.get(sc, {}).get("FolkloreBook")):
            g = clean(sub[sc]["FolkloreBook"])
        else:
            lo = max(1, (lv - 1) // 5 * 5 + 1)
            g = f"Level {lo}–{lo + 4}" + ("★" * stars if stars else "")
        e = entry(gid, name, item_patch(item), _kind="gathering", it=item, lv=lv, stars=stars)
        e.pop("ex", None)
        jobs[job].setdefault(g, []).append(e)
    unplaced = jobs.pop("Unplaced", {})
    for job, groups in list(jobs.items()) + ([("Other", unplaced)] if unplaced else []):
        keys = sorted(groups, key=lambda k: (not k.startswith("Level"), groups[k][0].get("lv", 0), k))
        title = "Gathering Log: " + job if job != "Other" else "Gathering Log: Other Items"
        section("gather-" + job.lower(), title, "Logs", [{"t": k, "e": groups[k]} for k in keys])

def fishing_log():
    spots, place, terr = sheet("FishingSpot"), sheet("PlaceName"), sheet("TerritoryType")
    spot_of_item = {}  # the game lists each spot's fish on the spot (Item[0..9]); FishParameter rarely names its spot
    for sid_, sp_ in sorted(spots.items(), key=lambda kv: (i(kv[1].get("Order")) or 9999, kv[0])):
        for k in range(10):
            it_ = i(sp_.get(f"Item[{k}]"))
            if it_ and i(sp_.get("TerritoryType")):
                spot_of_item.setdefault(it_, sp_)
    groups = collections.OrderedDict()
    for fid, r in sorted(sheet("FishParameter").items()):
        item = i(r["Item"])
        name = clean(ITEM.get(item, {}).get("Name"))
        if not name or r["IsInLog"] != "True":
            continue
        sp = spots.get(i(r["FishingSpot"])) or spot_of_item.get(item) or {}
        t = terr.get(i(sp.get("TerritoryType")), {})
        region = clean(place.get(i(t.get("PlaceNameRegion")), {}).get("Name")) or clean(place.get(i(sp.get("PlaceNameMain")), {}).get("Name"))
        zone = clean(place.get(i(t.get("PlaceName")), {}).get("Name")) or clean(place.get(i(sp.get("PlaceNameSub")), {}).get("Name"))
        if not zone:
            region, zone = "Other waters", "Ocean fishing and waters without a fixed spot"
        e = entry(fid, name, item_patch(item), _kind="fish", it=item, spot=clean(place.get(i(sp.get("PlaceName")), {}).get("Name")),
                  big=1 if "Big" in clean(r["Text"]) else 0)
        e["ex2"] = e.pop("ex", None)
        groups.setdefault((region, zone), []).append(e)
    out = collections.OrderedDict((n, []) for n in EXPANSIONS)
    out["Other"] = []
    for (region, zone), es in groups.items():
        exs = [e.pop("ex2") for e in es]
        ex = min((x for x in exs if x is not None), default=None)
        out[EXPANSIONS[ex] if ex is not None else "Other"].append({"t": zone or region, "c": region, "e": es})
    return out

def spearfishing_log():
    nb, place, terr = sheet("SpearfishingNotebook"), sheet("PlaceName"), sheet("TerritoryType")
    groups = collections.OrderedDict()
    for sid, r in sorted(sheet("SpearfishingItem").items()):
        item = i(r["Item"])
        name = clean(ITEM.get(item, {}).get("Name"))
        if not name:
            continue
        n = nb.get(i(r["SpearfishingNotebook"]), {})
        zone = clean(place.get(i(terr.get(i(n.get("TerritoryType")), {}).get("PlaceName")), {}).get("Name")) or "Other"
        e = entry(sid, name, item_patch(item), _kind="spearfish", it=item, spot=clean(place.get(i(n.get("PlaceName")), {}).get("Name")))
        e.pop("ex", None)
        groups.setdefault((i(r["Expansion"]), zone), []).append(e)
    return [{"t": z, "c": EXPANSIONS[x] if x < len(EXPANSIONS) else "", "e": es} for (x, z), es in sorted(groups.items(), key=lambda kv: kv[0][0])]

def hunting_log():
    mn, tgt, bn = sheet("MonsterNote"), sheet("MonsterNoteTarget"), sheet("BNpcName")
    sections_ = collections.OrderedDict()
    for nid, r in sorted(mn.items()):
        name = clean(r["Name"])
        if not name:
            continue
        who, _, num = name.rpartition(" ")
        rank = (i(num) - 1) // 10 + 1
        es = []
        for k in range(4):
            t = i(r[f"MonsterNoteTarget[{k}]"])
            if not t:
                continue
            mob = clean(tgt.get(t, {}).get("BNpcName") and bn.get(i(tgt[t]["BNpcName"]), {}).get("Singular"))
            if mob:
                es.append({"i": nid * 10 + k, "n": mob[0].upper() + mob[1:], "cnt": i(r[f"Count[{k}]"]), "pg": i(num)})
        if es:
            sections_.setdefault(who, collections.OrderedDict()).setdefault(rank, []).extend(es)
    groups = []
    for who, ranks in sections_.items():
        for rank, es in ranks.items():
            groups.append({"t": f"{who}: Rank {rank}", "c": who, "e": es})
    return groups

def sightseeing_log():
    terr = sheet("TerritoryType")
    zone_ex = {}
    for t in terr.values():
        for col in ("PlaceName", "PlaceNameZone"):
            zone_ex.setdefault(i(t[col]), i(t["ExVersion"]))
    groups = collections.OrderedDict((n, []) for n in EXPANSIONS)
    last = 0
    for k, (aid, r) in enumerate(sorted(sheet("Adventure").items()), 1):
        name = clean(r["Name"])
        if not name:
            continue
        ex = zone_ex.get(i(r["PlaceName"]), last)
        last = ex
        groups[EXPANSIONS[ex]].append({"i": aid, "n": name.replace("*", ""), "no": len([1 for g in groups.values() for _ in g]) + 1})
    return [{"t": k, "e": v} for k, v in groups.items() if v]

crafting_log()
gathering_log()
fl = fishing_log()
section("fishing", "Fishing Log", "Logs", [g for ex, gs in fl.items() for g in [dict(x, c=ex + ": " + x["c"]) for x in gs]])
section("spearfishing", "Spearfishing Log", "Logs", spearfishing_log())
section("hunting", "Hunting Log", "Logs", hunting_log(), note="Each entry is one target; the number is how many to defeat.")
section("sightseeing", "Sightseeing Log", "Logs", sightseeing_log())


# ---------------------------------------------------------------- duties and travel
def duties():
    cfc, ct, terr = sheet("ContentFinderCondition"), sheet("ContentType"), sheet("TerritoryType")
    keep = {2: "Dungeons", 3: "Guildhests", 4: "Trials", 5: "Raids", 28: "Ultimate Raids", 21: "Deep Dungeons",
            30: "Variant and Criterion Dungeons", 37: "Chaotic Alliance Raids", 7: "Quest Battles", 6: "PvP",
            9: "Treasure Dungeons", 39: "Quantum Duties", 22: "Event Duties"}
    tree = collections.OrderedDict()
    pvp_first = {}
    for did, r in sorted(cfc.items(), key=lambda kv: (i(kv[1]["SortKey"]), kv[0])):
        name = clean(r["Name"])
        t = i(r["ContentType"])
        if not name or t not in keep or i(r["ContentLinkType"]) not in (1,):
            continue
        ex = i(terr.get(i(r["TerritoryType"]), {}).get("ExVersion"))
        e = entry(did, name[0].upper() + name[1:], CONTENT_PATCH["instancecontent"].get(i(r["Content"])), _kind="duty",
                  lv=i(r["ClassJobLevelRequired"]), il=i(r["ItemLevelRequired"]))
        e.pop("ex", None)
        if t == 6:  # PvP: the game's member type is the mode
            e["grp"] = {7: "Frontline", 18: "Rival Wings", 29: "Crystalline Conflict", 30: "Crystalline Conflict: custom matches"}.get(i(r["ContentMemberType"]), "Other PvP")
            # the sheet repeats each arena once per match type (casual, ranked, seasonal rules): one arena to the player,
            # so later rows of the same arena in the same mode become aliases of the first (ticks on any of them count)
            k = (e["grp"], e["n"])
            if k in pvp_first:
                pvp_first[k].setdefault("al", []).append(did)
                problems["PvP: repeated arena row (merged into the first)"] += 1
                continue
            pvp_first[k] = e
        tree.setdefault(t, collections.OrderedDict()).setdefault(ex, []).append(e)
    for t in keep:
        if t in tree:
            groups = [{"t": EXPANSIONS[ex], "e": es} for ex, es in sorted(tree[t].items())]
            if t == 22:  # seasonal event duties (the Haunted Manor and others) only open while their event runs
                for g in groups:
                    for e in g["e"]:
                        e["x"] = "lim"
            section("duty-" + keep[t].split()[0].lower(), "Duties: " + keep[t], "Duties", groups)

def aetherytes():
    place, terr = sheet("PlaceName"), sheet("TerritoryType")
    groups = collections.OrderedDict()
    for aid, r in sorted(sheet("Aetheryte").items(), key=lambda kv: (i(kv[1]["Order"]), kv[0])):
        shard = r["IsAetheryte"] != "True"
        if r["Invisible"] == "True":
            continue
        name = clean(place.get(i(r["AethernetName"] if shard else r["PlaceName"]), {}).get("Name"))
        if shard and (not name or not i(r["AethernetGroup"])):
            continue
        t = terr.get(i(r["Territory"]), {})
        zone = clean(place.get(i(t.get("PlaceNameZone")), {}).get("Name")) or clean(place.get(i(t.get("PlaceName")), {}).get("Name"))
        region = clean(place.get(i(t.get("PlaceNameRegion")), {}).get("Name"))
        if not name or not region:
            continue
        groups.setdefault((i(t.get("ExVersion")), region), []).append({"i": aid, "n": name, "zone": zone, "kind": "Shard" if shard else "Crystal"})
    return [{"t": region, "c": EXPANSIONS[ex], "e": es} for (ex, region), es in sorted(groups.items(), key=lambda kv: kv[0][0])]

def aether_currents():
    place, terr, cur, q = sheet("PlaceName"), sheet("TerritoryType"), sheet("AetherCurrent"), sheet("Quest")
    groups = []
    for sid, r in sorted(sheet("AetherCurrentCompFlgSet").items()):
        t = terr.get(i(r["Territory"]), {})
        zone = clean(place.get(i(t.get("PlaceName")), {}).get("Name"))
        if not zone:
            continue
        es = []
        n_field = 0
        for k in range(15):
            c = i(r[f"AetherCurrents[{k}]"])
            if not c:
                continue
            quest = i(cur.get(c, {}).get("Quest"))
            if quest:
                es.append({"i": c, "n": "Quest: " + clean(q.get(quest, {}).get("Name"))})
            else:
                n_field += 1
                es.append({"i": c, "n": f"Field current {n_field}"})
        if es:
            groups.append({"t": zone, "c": EXPANSIONS[i(t.get("ExVersion"))], "e": es})
    return groups

def leves():
    cats = sheet("ClassJobCategory") if os.path.exists(os.path.join(DM, "csv", "en", "ClassJobCategory.csv")) else {}
    tree = collections.OrderedDict()
    for lid, r in sorted(sheet("Leve").items(), key=lambda kv: (i(kv[1]["ClassJobLevel"]), kv[0])):
        name = clean(r["Name"])
        if not name:
            continue
        who = clean(cats.get(i(r["ClassJobCategory"]), {}).get("Name")) or "Other"
        e = entry(lid, name, CONTENT_PATCH["leve"].get(lid), _kind="leve", lv=i(r["ClassJobLevel"]))
        e.pop("ex", None)
        tree.setdefault(who, collections.OrderedDict()).setdefault((i(r["ClassJobLevel"]) - 1) // 10 * 10 + 1, []).append(e)
    groups = []
    for who, bands in tree.items():
        for lo, es in sorted(bands.items()):
            groups.append({"t": f"{who}: Level {max(1, lo)}–{lo + 9}", "c": who, "e": es})
    return groups

duties()
section("aetherytes", "Aetherytes", "Travel", aetherytes())
section("aethercurrents", "Aether Currents", "Travel", aether_currents())
section("leves", "Levequests", "Quests", leves())



# ---------------------------------------------------------------- titles, FATEs, the Hunt, quests outside the journal
def titles():
    ach_by_title = {i(r["Title"]): aid for aid, r in sheet("Achievement").items() if i(r["Title"])}
    out = []
    for tid, r in sorted(sheet("Title").items(), key=lambda kv: (i(kv[1]["Order"]), kv[0])):
        m, f = clean(r["Masculine"]), clean(r["Feminine"])
        if not m:
            continue
        aid = ach_by_title.get(tid)
        e = entry(tid, m if m == f or not f else m + " / " + f, CONTENT_PATCH["achievement"].get(aid) if aid else None,
                  _kind="title", ach=aid)
        out.append(e)
    return out

TC_FATES = tc("fates")  # Teamcraft: each FATE's zone (the game's Fate sheet stores only a layout id)

def fates():
    terr, place, maps = sheet("TerritoryType"), sheet("PlaceName"), sheet("Map")
    terr_by_place = {}
    for t in terr.values():
        terr_by_place.setdefault(i(t["PlaceName"]), t)
    tree = collections.OrderedDict()
    for fid, r in sorted(sheet("Fate").items(), key=lambda kv: (i(kv[1]["ClassJobLevel"]), kv[0])):
        name = clean(r["Name"])
        if not name:
            continue
        pos = (TC_FATES.get(str(fid)) or {}).get("position") or {}
        zid = i(pos.get("zoneid"))
        t = terr_by_place.get(zid, {})
        zone = clean(place.get(zid, {}).get("Name"))
        mp = maps.get(i(pos.get("map")), {})
        region = clean(place.get(i(mp.get("PlaceNameRegion")), {}).get("Name")) or clean(place.get(i(t.get("PlaceNameRegion")), {}).get("Name"))
        e = entry(fid, name, CONTENT_PATCH["fate"].get(fid), _kind="fate", lv=i(r["ClassJobLevel"]))
        e.pop("ex", None)
        if not zone:
            problems["FATE not placed in any zone (kept, marked availability unknown)"] += 1
            e["x"] = "unk"
            tree.setdefault((99, "", "Not placed in any zone (special areas or unused)"), []).append(e)
            continue
        tree.setdefault((i(t.get("ExVersion")), region, zone), []).append(e)
    return [{"t": z, "c": (EXPANSIONS[ex] + ": " + reg) if ex < len(EXPANSIONS) else "Other", "e": es}
            for (ex, reg, z), es in sorted(tree.items(), key=lambda kv: kv[0])]

def hunt():
    bn = sheet("BNpcName")
    ranks = {1: "B rank", 2: "A rank", 3: "S rank", 4: "SS rank"}
    tree = collections.OrderedDict()
    seen = set()
    def add(bid, rank):
        name = clean(bn.get(bid, {}).get("Singular"))
        if not name or bid in seen:
            return
        seen.add(bid)
        e = entry(bid, name[0].upper() + name[1:], CONTENT_PATCH["bnpcname"].get(bid), _kind="hunt mark",
                  al=[b for b in same_name[name.lower()] if b != bid][:8])  # same monster under other game ids
        ex = e.pop("ex", None)
        tree.setdefault((ex if ex is not None else 99, rank), []).append(e)
    same_name = collections.defaultdict(list)
    for b, r in bn.items():
        if clean(r.get("Singular")):
            same_name[clean(r["Singular"]).lower()].append(b)
    for nid, r in sorted(sheet("NotoriousMonster").items()):
        add(i(r["BNpcName"]), ranks.get(i(r["Rank"]), "Elite marks"))
    for mid, r in sorted(sheet("MobHuntTarget").items()):
        add(i(r["Name"]), "Hunt bill marks")
    # an alias names the same monster under another game id; an id that is itself a tracked mark is not an alias
    for es in tree.values():
        for e in es:
            if e.get("al"):
                e["al"] = [b for b in e["al"] if b not in seen]
                if not e["al"]:
                    del e["al"]
    order = ["SS rank", "S rank", "A rank", "B rank", "Hunt bill marks", "Elite marks"]
    return [{"t": rank, "c": EXPANSIONS[ex] if ex < len(EXPANSIONS) else "Patch not recorded", "e": es}
            for (ex, rank), es in sorted(tree.items(), key=lambda kv: (kv[0][0], order.index(kv[0][1])))]

def quests_outside_journal():
    out = []
    for qid, r in sorted(sheet("Quest").items()):
        name = clean(r["Name"])
        if not name or i(r["JournalGenre"]):
            continue
        e = entry(qid, name, CONTENT_PATCH["quest"].get(qid), _kind="quest")
        e["ex"] = i(r["Expansion"])  # the game's own expansion field
        out.append(e)
    return out

section("titles", "Titles", "Collections", by_expansion(titles()))
section("fates", "FATEs", "Duties", fates())
section("hunt", "The Hunt", "Duties", hunt())
section("quests-other", "Quests Outside the Journal", "Quests", by_expansion(quests_outside_journal()),
        note="Quests the game does not file under a journal section (quasi-quests, retired and special quests).")

# ---------------------------------------------------------------- community status and sources (FFXIV Collect)
FCDIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "ffxivcollect")
# Armoire and Outfit Glamours: FFXIV Collect's lists (its own ids; the game item is found by name for its details)
_item_by_name = {}
for _k, _r in sheet("Item").items():
    if clean(_r.get("Name")): _item_by_name.setdefault(clean(_r["Name"]).lower(), _k)
def fc_list(kind, group_of):
    with open(os.path.join(FCDIR, kind + ".json"), encoding="utf-8") as f:
        rows = json.load(f)["items"]
    groups = collections.OrderedDict()
    for r in sorted(rows, key=lambda r: (str(r.get("patch") or "9"), r["name"])):
        e = {"i": r["id"], "n": r["name"]}
        if r.get("patch"): e["p"] = str(r["patch"])
        it = r.get("item_id") or _item_by_name.get(r["name"].lower())
        if it: e["it"] = it
        groups.setdefault(group_of(r), []).append(e)
    return [{"t": t, "e": es} for t, es in groups.items()]
# Gold Saucer: Lord of Verminion and chocobo racing goals (the game's ChocoboRaceChallenge sheet; the rest are fixed goals)
try:
    _crc = sheet("ChocoboRaceChallenge")
except FileNotFoundError:
    _crc = {}
_verm = [{"i": n, "n": "Verminion Challenge %d" % n, "d": "Single-player challenge %d of 24" % n} for n in range(1, 25)]
_verm += [{"i": 101, "n": "Clockwork Twintania (all 24 challenges)", "d": "Minion reward for clearing all 24 Verminion Challenges"},
          {"i": 111, "n": "Master Battle: Easy"}, {"i": 112, "n": "Master Battle: Normal"}, {"i": 113, "n": "Master Battle: Hard"},
          {"i": 121, "n": "Shalloweye (50 Player Battle (RP) wins)", "d": "Minion reward for 50 ranked wins"}]
_race = [{"i": k, "n": clean(r["Name"]), "d": "Needs a racing rating of " + r.get("RatingRequirement", "?")} for k, r in sorted(_crc.items()) if clean(r.get("Name"))]
_rank = [{"i": 1000 + n, "n": "Race chocobo rank %d" % n} for n in (10, 20, 30, 40, 50)] + [{"i": 1100 + n, "n": "Pedigree %d chocobo" % n} for n in range(2, 10)]
section("verminion", "Lord of Verminion", "Gold Saucer", [{"t": "Verminion Challenges", "e": _verm[:24]}, {"t": "Rewards and battles", "e": _verm[24:]}],
        note="Lord of Verminion goals: the 24 challenges (all of them give Clockwork Twintania), the Master Battles and the ranked-win minion.")
section("chocoboracing", "Chocobo Racing", "Gold Saucer", [{"t": "Chocobo Challenge races", "e": _race}, {"t": "Ranks and breeding", "e": _rank}],
        note="Chocobo racing goals: the Chocobo Challenge races (first clears pay MGP and unlock ability manuals), race chocobo ranks and breeding pedigrees.")
if os.path.exists(os.path.join(FCDIR, "armoires.json")):
    section("armoire", "Armoire", "Collections", fc_list("armoires", lambda r: r.get("category") or "Armoire"),
            note="Items the Armoire can store (FFXIV Collect's list). Grouped by the Armoire's own categories, each under the expansion it came out in.")
    section("outfits", "Outfit Glamours", "Collections", fc_list("outfits", lambda r: (lambda s: (s.get("text") if s.get("type") == "Other" and s.get("text") else s.get("type")) or "Unlisted source")((r.get("sources") or [{}])[0])),
            note="Outfit glamours that can be stored in the glamour dresser as one set (FFXIV Collect's list).")
FC_MAP = {"mounts": ("mounts", "id"), "minions": ("minions", "id"), "orchestrion": ("orchestrions", "id"),
          "emotes": ("emotes", "id"), "hairstyles": ("hairstyles", "item"), "barding": ("bardings", "id"),
          "fashion": ("fashions", "id"), "facewear": ("facewear", "item"), "bluemagic": ("spells", "id"), "cards": ("triad-cards", "id"), "titles": ("titles", "id"), "armoire": ("armoires", "id"), "outfits": ("outfits", "id")}
fc_stats = collections.Counter()

def apply_ffxivcollect():
    secs = {x["id"]: x for x in sections}
    for sid, (kind, key) in FC_MAP.items():
        with open(os.path.join(FCDIR, kind + ".json"), encoding="utf-8") as f:
            fc = json.load(f)
        limited_only = set(fc["with_limited_source"]) - set(fc["with_permanent_source"])
        idx = {(x["id"] if key == "id" else x.get("item_id")): x for x in fc["items"]}
        for g in secs[sid]["g"]:
            for e in g["e"]:
                x = idx.get(e["i"] if key == "id" else e.get("it"))
                if not x:
                    fc_stats[sid + ": not in FFXIV Collect"] += 1
                    continue
                if x["id"] != e["i"]:
                    e["fc"] = x["id"]  # FFXIV Collect's own id, used by the online import
                if x.get("sources"):
                    e["src"] = [(s["type"] + ": " + s["text"]) if s.get("text") and s.get("text") != s.get("type") else s.get("type") for s in x["sources"]][:4]
                if x["id"] in limited_only and not e.get("x"):
                    e["x"] = "lim"
                    fc_stats[sid + ": time-limited only"] += 1
    with open(os.path.join(FCDIR, "achievements-time-limited.json"), encoding="utf-8") as f:
        tl = json.load(f)
    ids, cats = set(tl["time_limited_ids"]), set(tl["time_limited_category_ids"])
    ach_cat = {aid: i(r["AchievementCategory"]) for aid, r in sheet("Achievement").items()}
    for sec in sections:
        if not sec["id"].startswith("ach-"):
            continue
        for g in sec["g"]:
            for e in g["e"]:
                if sec["id"] == "ach-legacy":
                    e["x"] = "gone"
                    fc_stats["achievements: legacy (no longer obtainable)"] += 1
                elif e["i"] in ids or ach_cat.get(e["i"]) in cats:
                    e["x"] = "lim"
                    fc_stats["achievements: time-limited"] += 1

apply_ffxivcollect()

# A title comes only from its achievements: when every achievement that grants it is time-limited (or Legacy), the
# title cannot be obtained either and takes the same mark, so the two lists agree.
def mark_titles():
    secs = {x["id"]: x for x in sections}
    ach_mark = {}
    for sid, sec in secs.items():
        if sid.startswith("ach-"):
            for g in sec["g"]:
                for e in g["e"]:
                    ach_mark[e["i"]] = e.get("x")
    by_title = collections.defaultdict(list)
    for aid, r in sheet("Achievement").items():
        if i(r["Title"]) and aid in ach_mark:
            by_title[i(r["Title"])].append(ach_mark[aid])
    for g in secs["titles"]["g"]:
        for e in g["e"]:
            marks = by_title.get(e["i"])
            if marks and all(m == "lim" for m in marks):
                e["x"] = "lim"; fc_stats["titles: time-limited (from their achievements)"] += 1
            elif marks and all(m == "gone" for m in marks):
                e["x"] = "gone"; fc_stats["titles: no longer obtainable (Legacy achievements)"] += 1
mark_titles()

def regroup(sid, keyfn, order=None):
    sec = next(x for x in sections if x["id"] == sid)
    es = [e for g in sec["g"] for e in g["e"]]
    groups = collections.OrderedDict()
    for e in es:
        groups.setdefault(keyfn(e), []).append(e)
    keys = sorted(groups, key=(lambda k: order.index(k) if k in order else len(order))) if order else list(groups)
    sec["g"] = [{"t": k, "e": groups[k]} for k in keys]

regroup("facewear", lambda e: (e.get("src") or ["Other"])[0].split(":")[0])
regroup("duty-pvp", lambda e: e.pop("grp", "Other PvP"), ["Crystalline Conflict", "Frontline", "Rival Wings", "Crystalline Conflict: custom matches", "Other PvP"])

# ---------------------------------------------------------------- starting city and Grand Company
# Each starting city's story begins at its own quest ("Coming to Gridania / Limsa Lominsa / Ul'dah"). Following the game's
# quest prerequisites (PreviousQuest, with PreviousQuestJoin: all-of or any-of) gives, for every quest, the set of
# starting cities that can reach it; a quest only one city can reach belongs to that city. Grand Company quests come from
# Quest.GrandCompany, the "(Maelstrom|Twin Adder|Immortal Flames)" variants and the three officer quests.
CITY_ROOT = {"lim": 65643, "gri": 65575, "uld": 66130}
def city_and_gc():
    q = sheet("Quest")
    preds = {k: [i(v[f"PreviousQuest[{n}]"]) for n in range(3) if i(v[f"PreviousQuest[{n}]"]) in q] for k, v in q.items()}
    ALL = frozenset(CITY_ROOT)
    reach = {root: frozenset([c]) for c, root in CITY_ROOT.items()}
    changed, rounds = True, 0
    while changed and rounds < 300:
        changed, rounds = False, rounds + 1
        for k in q:
            if k in CITY_ROOT.values():
                continue
            ps = preds[k]
            if not ps:
                new = ALL
            else:
                sets = [reach.get(p) for p in ps]
                if any(s is None for s in sets):
                    continue
                new = frozenset.union(*sets) if q[k].get("PreviousQuestJoin") == "2" else frozenset.intersection(*sets)
            if reach.get(k) != new:
                reach[k] = new
                changed = True
    city = {k: next(iter(s)) for k, s in reach.items() if len(s) == 1}
    gcname = {"maelstrom": 1, "twin adder": 2, "immortal flames": 3}
    officer = {"till sea swallows all": 1, "wood's will be done": 2, "for coin and country": 3}
    gc = {}
    for k, v in q.items():
        n = clean(v["Name"]).lower()
        m = re.search(r"\((maelstrom|twin adder|immortal flames)\)\s*$", n)
        g = i(v.get("GrandCompany")) or (gcname[m.group(1)] if m else 0) or officer.get(n, 0)
        if g:
            gc[k] = g
    return city, gc

# ---------------------------------------------------------------- custom deliveries and cosmic exploration
PUA = re.compile("[-]")

def custom_deliveries():
    """One row per client; the value is the character's satisfaction rank, complete at the client's top rank."""
    npc, q, out = sheet("ENpcResident"), sheet("Quest"), []
    for k, r in sorted(sheet("SatisfactionNpc").items()):
        name = clean(npc.get(i(r.get("Npc")), {}).get("Singular"))
        if not name:
            continue
        steps = sum(1 for n in range(6) if i(r.get(f"SatisfactionNpcParams[{n}].SatisfactionRequired")))
        quest = clean(q.get(i(r.get("QuestRequired")), {}).get("Name"))
        out.append({"i": k, "n": name, "val": 1, "max": steps + 1, "unit": "rank",
                    "d": ("Quest: " + quest + " · " if quest else "") + "from level " + str(i(r.get("LevelUnlock")) or i(r.get("Level")))})
    section("deliveries", "Custom Deliveries", "Ranks", [{"t": "Custom Delivery Clients", "e": out}],
            note="Enter each character's satisfaction rank with each client. A client counts as complete at their top rank.")

def cosmic():
    place = sheet("PlaceName")
    planets = [clean(place.get(i(r.get("Name")), {}).get("Name")) for k, r in sorted(sheet("WKSPlanetSelect").items())]
    planets = [p for p in planets if p]
    cjc = sheet("ClassJobCategory")
    cj = {r["Abbreviation"]: clean(r["Name"]).title() for r in sheet("ClassJob").values() if r.get("Abbreviation")}
    rows = [(k, r) for k, r in sorted(sheet("WKSMissionUnit").items()) if clean(PUA.sub("", r.get("Name", "")))]
    # The sheet lists each planet's missions class by class (Carpenter first, a few dozen each), followed by short runs
    # of extra missions; a new planet starts where a long Carpenter run begins.
    runs, cur = [], None
    for k, r in rows:
        c = r["ClassJobCategory[0]"]
        if not cur or cur[0] != c:
            cur = [c, []]
            runs.append(cur)
        cur[1].append((k, r))
    first_cat = rows[0][1]["ClassJobCategory[0]"]
    starts = [n for n, (c, rs) in enumerate(runs) if c == first_cat and len(rs) >= 20]
    assert len(starts) == len(planets), ("cosmic planets", len(starts), planets)
    groups = collections.OrderedDict()
    pidx = -1
    for n, (c, rs) in enumerate(runs):
        if n in starts:
            pidx += 1
        job = cj.get(clean(cjc.get(i(c), {}).get("Name")), clean(cjc.get(i(c), {}).get("Name")))
        for k, r in rs:
            groups.setdefault((planets[pidx], job), []).append({"i": k, "n": clean(PUA.sub("", r["Name"])), "d": job + " · " + planets[pidx]})
    section("cosmicmissions", "Cosmic Exploration: Missions", "Cosmic Exploration",
            [{"t": p + ": " + j, "e": es} for (p, j), es in groups.items()],
            note="Tick a mission once the character has completed it.")
    # Records (the Cosmic Exploration achievement list, with credit rewards), grouped by planet from their wording.
    keys = [("the moon", planets[0])] + [(p, p) for p in planets[1:]]
    rec = collections.OrderedDict((t, []) for t in ["General"] + planets)
    for k, r in sorted(sheet("WKSAchievement").items()):
        text = clean(r.get("Description"))
        if not text:
            continue
        where = next((p for w, p in keys if ("on " + w) in text or ("in " + w) in text), "General")
        rec[where].append({"i": k, "n": text})
    section("cosmicrecords", "Cosmic Exploration: Records", "Cosmic Exploration", [{"t": t, "e": es} for t, es in rec.items() if es])

custom_deliveries()
cosmic()

# ---------------------------------------------------------------- Dawntrail additions (2026-11-08 sweep)
def beastmaster():
    """The Beastmaster limited job (7.56): the beasts of the Master's Bestiary (XBMPet, names from Pet) and the
    Crucible of the Unbroken's boards (duty finder type 40)."""
    pet, place = sheet("Pet"), sheet("PlaceName")
    beasts = []
    for k, r in sorted(sheet("XBMPet").items()):
        name = clean(pet.get(i(r["Pet"]), {}).get("Name"))
        if not k or not name:
            continue
        where = clean(place.get(i(r["Location"]), {}).get("Name"))
        beasts.append({"i": k, "n": name[0].upper() + name[1:], "p": "7.56", "d": where or "Location not in the game data"})
    boards = []
    for cid, r in sorted(sheet("ContentFinderCondition").items()):
        if i(r["ContentType"]) == 40 and clean(r["Name"]) and i(r["ContentLinkType"]) == 1:
            boards.append({"i": cid, "n": clean(r["Name"]), "p": "7.56", "lv": i(r["ClassJobLevelRequired"]), "d": "Crucible of the Unbroken · Beastmaster level " + str(i(r["ClassJobLevelRequired"]))})
    assert len(beasts) >= 50 and len(boards) >= 5, ("beastmaster", len(beasts), len(boards))
    section("beastmaster", "Beastmaster", "Character",
            [{"t": "Master's Bestiary", "e": beasts}, {"t": "Crucible of the Unbroken", "e": boards}],
            note="Tick a beast once the character has befriended it, and a board once it is cleared. Beastmaster quests are under Class and Job Quests; the level is under Classes and Jobs.")

def treasure_maps():
    """One row per kind of treasure map (TreasureHuntRank): tick once the character has dug one up."""
    seen, out = set(), []
    item = sheet("Item")
    for k, r in sorted(sheet("TreasureHuntRank").items()):
        iid = i(r["ItemName"])
        name = clean(item.get(iid, {}).get("Name"))
        if not iid or not name or iid in seen:
            continue
        seen.add(iid)
        out.append(entry(iid, name, item_patch(iid), _kind="treasure map", party=i(r["MaxPartySize"])))
    for e in out:
        e.pop("ex", None)
        e["d"] = "Party map (up to 8)" if e.pop("party", 1) > 1 else "Solo map"
    section("treasuremaps", "Treasure Hunt: Maps", "Duties", [{"t": "Treasure Maps", "e": out}],
            note="Tick a map once the character has found the treasure of that kind of map at least once.")

def occult_lore():
    """The Occult Crescent's lore entries (MKDLore), South Horn and North Horn."""
    south, north = [], []
    for k, r in sorted(sheet("MKDLore").items()):
        name = clean(r["Name"])
        if not k or not name:
            continue
        (north if north or name == "North Horn Base Camp" else south).append({"i": k, "n": name})
    section("oclore", "Occult Crescent: Lore", "Field Operations",
            [{"t": "South Horn", "e": south}, {"t": "North Horn", "e": north}],
            note="Tick a lore entry once the character has unlocked it.")

# Trust levels: the avatars each expansion lets a character level (the in-game Trust menu; member lists and level
# ranges as in the FFXIV Completionist desktop app's Trust page, checked against the game's Trust achievements).
TRUST = [("Shadowbringers", 71, 80, "5.0", ["Alphinaud", "Alisaie", "Thancred", "Urianger", "Y'shtola", "Ryne"]),
         ("Endwalker", 81, 90, "6.0", ["Alphinaud", "Alisaie", "Thancred", "Urianger", "Y'shtola", "Estinien", "G'raha Tia"]),
         ("Dawntrail", 91, 100, "7.0", ["Alphinaud", "Alisaie", "Thancred", "Urianger", "Y'shtola", "Estinien", "G'raha Tia", "Krile"])]
def trust():
    groups = []
    for gi, (ex, lo, hi, patch, names) in enumerate(TRUST, 1):
        groups.append({"t": ex, "e": [{"i": gi * 100 + n, "n": nm, "val": 1, "max": hi, "unit": "level", "p": patch,
                                         "d": ex + " · levels " + str(lo) + " to " + str(hi)} for n, nm in enumerate(names, 1)]})
    section("trust", "Trust", "Duties", groups,
            note="Enter each avatar's trust level. An avatar counts as complete at the expansion's top level.")

def variant_records():
    """The records of each variant dungeon (VVDNotebookSeries / VVDNotebookContents): one per route's ending."""
    cfc, contents = sheet("ContentFinderCondition"), sheet("VVDNotebookContents")
    dungeon, dpatch = {}, {}
    for k, r in sheet("VVDData").items():
        if i(r["Sequence"]) == 1:
            row = cfc.get(i(r["ContentFinderCondition"]), {})
            dungeon[i(r["Series"])] = clean(row.get("Name"))
            dpatch[i(r["Series"])] = str(i(sheet("TerritoryType").get(i(row.get("TerritoryType")), {}).get("ExVersion")) + 2) + ".0"  # its expansion (the map's)
    groups = []
    for k, r in sorted(sheet("VVDNotebookSeries").items()):
        es = [dict({"i": c, "n": clean(contents[c]["Name"]), "d": dungeon.get(k, "")}, **({"p": dpatch[k]} if dpatch.get(k) else {})) for c in [i(r[f"Contents[{n}]"]) for n in range(13)] if c and clean(contents.get(c, {}).get("Name"))]
        if es:
            groups.append({"t": clean(r["Name"]), "c": dungeon.get(k, ""), "e": es})
    section("variantrecords", "Variant Dungeon Records", "Duties", groups,
            note="Each variant dungeon has a record for every route through it; tick a record once the character has finished that route. Hover over a name for the dungeon and a link to a route guide.")

beastmaster()
treasure_maps()
variant_records()
occult_lore()
trust()

CITY, GCQ = city_and_gc()
# Outside the quest sheet: the introductory levequest of each region and the three "leaving the city" achievements
# (FFXIV Collect marks the achievements and these leves as limited to characters who started in that city).
LEVE_CITY = {556: "lim", 546: "gri", 566: "uld"}
ACH_CITY = {310: "lim", 311: "gri", 312: "uld"}
city_stats = collections.Counter()
for sec in sections:
    for g in sec["g"]:
        for e in g["e"]:
            c = None
            if sec["id"].startswith("quests-"):
                c = CITY.get(e["i"])
                if GCQ.get(e["i"]):
                    e["gc"] = GCQ[e["i"]]
                    city_stats["quest: Grand Company"] += 1
            elif sec["id"] == "leves":
                c = LEVE_CITY.get(e["i"])
            elif sec["id"].startswith("ach-"):
                c = ACH_CITY.get(e["i"])
            elif sec["id"] == "hunting":
                gcmap = {"Maelstrom": 1, "Order of the Twin Adder": 2, "Immortal Flames": 3}
                if g.get("c") in gcmap:
                    e["gc"] = gcmap[g["c"]]
            if c:
                e["city"] = c
                city_stats[sec["id"].split("-")[0] + ": " + c] += 1
# A city's opening quests come in one variant per starting class (several "Close to Home" rows); a character does only
# one of them, so the variants are merged into one entry (the other ids become aliases, so a tick on any variant counts).
for sec in sections:
    if not sec["id"].startswith("quests-"):
        continue
    for g in sec["g"]:
        first, keep = {}, []
        for e in g["e"]:
            k = (e["n"], e.get("city"))
            if e.get("city") and k in first:
                first[k].setdefault("al", []).append(e["i"])
                city_stats["quest variants merged"] += 1
                continue
            first[k] = e
            keep.append(e)
        g["e"] = keep
# The first class quests exist twice for each starting class: once for characters who started as that class (its own
# "Way of the ..." with no prerequisite, and the level 10 quest after it) and once for characters who joined it later
# (the guild's "So You Want to Be ..." quest, a second "Way of the ...", "My First ...", and a second level 10 quest).
# A character does only one route, set by the starting class: "sc" marks the starter route (applies only to starters of
# that class), "jc" the joiner route (does not apply to them). Quests after level 10 need either route and stay unmarked.
START_CLS = {"mrd", "acn", "lnc", "arc", "cnj", "gla", "pgl", "thm"}
def class_routes():
    q = sheet("Quest")
    abbr = {clean(r["Name"]).lower(): r["Abbreviation"].lower() for r in sheet("ClassJob").values() if r.get("Abbreviation")}
    prev = lambda k: [i(q[k][f"PreviousQuest[{n}]"]) for n in range(3) if i(q.get(k, {}).get(f"PreviousQuest[{n}]"))]
    sec = next(x for x in sections if x["id"] == "quests-classjobquests")  # before the split below
    tag = {}
    for g in sec["g"]:
        cls = abbr.get(re.sub(r" quests$", "", g["t"].lower()))
        if cls not in START_CLS:
            continue
        ways = [e["i"] for e in g["e"] if e["n"].startswith("Way of the ") and i(q[e["i"]].get("ClassJobLevel[0]")) == 1]
        starter = [k for k in ways if not prev(k)]
        joiner = [k for k in ways if prev(k)]
        assert len(starter) == 1 and len(joiner) == 1, ("class routes", g["t"], ways)
        route = {starter[0]: "sc", joiner[0]: "jc"}
        for p_ in prev(joiner[0]):
            route[p_] = "jc"  # the guild's "So You Want to Be ..." quest
        changed = True
        while changed:
            changed = False
            for e in g["e"]:
                if e["i"] in route:
                    continue
                ps = prev(e["i"])
                if q[e["i"]].get("PreviousQuestJoin") == "2" and len(ps) > 1:
                    continue
                rs = {route[p_] for p_ in ps if p_ in route}
                if len(rs) == 1:
                    route[e["i"]] = rs.pop()
                    changed = True
        for k, v in route.items():
            tag[k] = (v, cls)
    for sec_ in sections:
        if sec_["id"].startswith("quests-"):
            for g in sec_["g"]:
                for e in g["e"]:
                    if e["i"] in tag:
                        v, cls = tag[e["i"]]
                        e[v] = cls
                        city_stats["quest: " + ("starter" if v == "sc" else "joiner") + " route of a class"] += 1
class_routes()
CITY_STATS = dict(city_stats)

CJ_SPLIT = [("Disciple of War Quests", "quests-cj-war"), ("Disciple of Magic Quests", "quests-cj-magic"),
            ("Disciple of the Hand Quests", "quests-cj-hand"), ("Disciple of the Land Quests", "quests-cj-land"),
            ("Crystalline Mean Quests", "quests-cj-crystallinemean"), ("Studium Quests", "quests-cj-studium"),
            ("Wachumeqimeqi Quests", "quests-cj-wachumeqimeqi"), ("Disciple of War Job Quests", "quests-cj-warjob"),
            ("Disciple of Magic Job Quests", "quests-cj-magicjob"), ("Role Quests", "quests-cj-role")]
def split_class_job():
    at = next(n for n, x in enumerate(sections) if x["id"] == "quests-classjobquests")
    old = sections.pop(at)
    by = collections.OrderedDict((c, []) for c, _ in CJ_SPLIT)
    for g in old["g"]:
        assert g.get("c") in by, ("class and job quest page", g["t"], g.get("c"))
        for e in g["e"]:
            e["mv"] = old["id"]  # saved before the split as quests-classjobquests:<id>
        by[g["c"]].append({"t": g["t"], "e": g["e"]})
    del report[old["id"]]
    for n, (c, sid) in enumerate(CJ_SPLIT):
        s_ = {"id": sid, "t": c, "area": old["area"], "g": by[c]}
        sections.insert(at + n, s_)
        report[sid] = sum(len(g["e"]) for g in by[c])
split_class_job()

# ---------------------------------------------------------------- output
meta = {
    "sources": {
        "game": f"xivapi/ffxiv-datamining {DM_COMMIT[:8]} (game version 7.57h1)",
        "patches": f"ffxiv-teamcraft/ffxiv-teamcraft {TC_COMMIT[:8]} (MIT) - community data, patch labels only",
        "status": "FFXIV Collect public API snapshot " + json.load(open(os.path.join(FCDIR, "SNAPSHOT.json")))["fetched"] + " - community data: how to get it, time-limited flags",
    },
    "expansions": EXPANSIONS,
    "copyright": "Game data © SQUARE ENIX CO., LTD. All rights reserved.",
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump({"meta": meta, "sections": sections}, f, ensure_ascii=False, separators=(",", ":"))
marks = collections.Counter(e.get("x") for sec in sections for g in sec["g"] for e in g["e"] if e.get("x"))
rep = {"counts": report, "problems": dict(problems), "status": dict(fc_stats), "marked": dict(marks), "city_and_gc": CITY_STATS, "total": sum(report.values())}
with open(os.path.splitext(OUT)[0] + "-report.json", "w", encoding="utf-8") as f:
    json.dump(rep, f, indent=1)
print(json.dumps(rep, indent=1))
