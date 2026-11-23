#!/usr/bin/env python3
"""Build data/lists.json for the Command Center's Lists module (work item W1 of docs/lists-spec.md, section 3).

Usage:
  python3 -I tools/lists-data.py [--cache DIR] [--out data/lists.json] [--expect-recipes N]

Every input is fetched from a pinned commit on raw.githubusercontent.com (or read from --cache, where each file is kept
under its own commit). Files are read as data; nothing from another repository is run. Sources (see data/SOURCES.md,
section "Lists"):

  * Game data: xivapi/ffxiv-datamining (English CSVs, game 7.57h1): Item, Recipe, RecipeLevelTable, PlaceName, Map,
    GatheringPointName, GatheringPoint, GatheringPointBase, GatheringSubCategory, ExportedGatheringPoint,
    SpearfishingNotebook, FishingSpot, SecretRecipeBook, CompanyCraftSequence, CompanyCraftPart, CompanyCraftProcess,
    CompanyCraftSupplyItem.
    Game data (c) SQUARE ENIX CO., LTD.
  * FFXIV Teamcraft (MIT): shops.json (offers), nodes.json, gathering-items.json, fishing-sources.json,
    fishing-spots.json, npcs.json, aetherytes.json; the 11 job icons of the same commit (apps/client/src/assets/icons/classjob).

Output tables (all ids are game row ids; compact arrays):
  stamp   "<game version> <8 of sheet commit> <8 of Teamcraft commit>", at most 40 characters
  items   {id: [name, flags, merchantSells]}   flags: 1 can be sold on the market board (the Item sheet's ItemSearchCategory
          above 0; the engine's "market" way reads this bit), 2 can be HQ, 4 always collectable, 8 crystal, 16 tradable (not
          untradable; the meaning bit 1 had before 2026-11-23: a tradable currency is 16 without 1).
          merchantSells: the Item sheet's PriceMid, the gil price a merchant asks (0 = none).
  recipes {id: [item, yield, job 0-7, level, stars, [[item, amount]...], flags]}
          job: CraftType (0 CRP, 1 BSM, 2 ARM, 3 GSM, 4 LTW, 5 WVR, 6 ALC, 7 CUL).
          flags: 1 can be HQ, 2 expert, 4 specialist, 8 collectable, 16 quick synthesis, 32 master book.
  gather  {item: [[job, nameRow, level, zone, x, y, aetheryte, hours, minutes, folklore, hidden]...]}  every spot of an item,
          best first (lowest level, then the shortest distance to its aetheryte, then the lowest node id).
          job: 0 miner, 1 botanist, 2 fisher. nameRow: the row of the game sheet GatheringPointName (see nodeNames), 0 for a
          fishing spot. level: the node's level. zone: the name of the map the position is on (the zone the game's map shows;
          for a node without a map position the gathering area the node is in, when known). x, y: the position as the game's map shows it, one
          decimal (0 and 0 when the game data holds no position). aetheryte: id of the nearest aetheryte on the same map
          (see aetherytes), 0 for none. hours: the sorted Eorzea start hours of a timed node, minutes how long it stays
          (0 and 0 when untimed). folklore: the name of the folklore book the node needs, or 0. hidden: 1 when the item is a
          hidden item of the node. A fishing spot (fish, not spearfishing) has a twelfth entry, the spot's name, and the
          node's name row 0. An item whose nodes have no map position has one entry with x and y 0 and the zone if known.
  gatherLegacy  {item: [job, level, zone, hours or 0, minutes or 0]}   the former shape of gather (the page of
          work item W6 still reads it until B3 and B5 of docs/lists-look-spec.md move it to gather); the build puts it back
          under the name gather in the page's data and offers the new table as spots.
  nodeNames  {row: "Rocky Outcrop"}   the names of the rows used, from the game sheet GatheringPointName.
  aetherytes  {id: name}   the aetherytes named in gather (Teamcraft aetherytes.json, type 0; names from PlaceName).
  crafters  {item: [[recipe, job, level]...]}   every recipe of an item, lowest level then lowest recipe id first (the
          counted recipe of the engine is the first).
  trades  {item: [[gives, [[currency, amount]...], hq 0/1, gcRank or 0, npc]...]}   gil-only offers first.
  npcs    {npc: [name, zone]}   sellers named in trades whose name or place is known.
  currencies  [item...]   the items that are the non-gil price of a kept trade and are not on the market board (flag 1 off):
          tomestones, scrips, seals, tokens. Sorted ids.
  sellers {item: [[npc, price]...]}   every gil seller of an item (an offer whose only currency is gil, normal quality, no
          Grand Company rank, giving whole units: the gil per unit, only when the offer's gil divides by what it gives, and a
          known seller), cheapest first, then lowest npc id; the planned offer in `trades` is unchanged.
  books   {recipe: bookItem}   the master book a recipe needs (Recipe.SecretRecipeBook, via the sheet SecretRecipeBook);
          exactly the recipes with flag 32. bookNames {bookItem: "Master Carpenter I"}.
  projects  {resultItem: [kind, [part...]]}   Free Company workshop parts from the company-craft sheets. kind 0 submarine
          part (CompanyCraftSequence.Category 7), 1 airship part (Category 5). A part is a list of phases in order (the
          three CompanyCraftProcess rows of a CompanyCraftPart); a phase is [[item, amountPerSet, sets]...] with the item
          of CompanyCraftSupplyItem, SetQuantity and SetsRequired (the phase needs amountPerSet x sets of each).
  changes [{from, to, recipes: {id: [old row or null, new row]}, gone: {id: old row}}]   (the `log` table is added by W6)

Closure: the file holds every item that is a recipe's result or ingredient and every currency of a kept offer, and for
each of those its own offers and nodes, repeated until nothing new is added.

The build stops, writing nothing, when: a fetch fails; a recipe names an item missing from Item; a yield or an amount is
below 1; a trade gives fewer than 1 or has no currency; the recipes form a loop; the stamp is longer than 40
characters; or the recipe count differs from EXPECT_RECIPES; a node with a map position has no GatheringPoint row, a different
gathering type or point type in the sheets, or a position that the sheets' own X and Z do not give in the game's map
scale; a node that is written has a name that cannot be derived; a spot's folklore book differs from the sheet's; a job
icon is missing, not a PNG or over 16 kB; a master book that is not in SecretRecipeBook or has no name; a submarine or airship part
whose sequence has no part, whose part has no phases or a phase with no supply item, or whose supply item, amount or sets cannot be
read; or the count of submarine parts differs from EXPECT_SUBMARINE (40) or of airship parts from EXPECT_AIRSHIP (28).
"""
import csv, io, json, os, re, sys, tempfile, urllib.request

DM_COMMIT = "44948e4cda5846eab0baa9872122a888fcc4f1b1"  # xivapi/ffxiv-datamining, game 7.57h1, 2026-10-20
TC_COMMIT = "70429e214dc952be23114df514a18223dc429449"  # ffxiv-teamcraft/ffxiv-teamcraft, 2026-11-07 (MIT)
GAME_VERSION = "7.57h1"
EXPECT_RECIPES = 13892  # the count of the first run (2026-11-22), see data/SOURCES.md
EXPECT_SUBMARINE = 40  # submarine parts (CompanyCraftSequence.Category 7): 10 classes x 4 parts, 2026-11-23
EXPECT_AIRSHIP = 28  # airship parts (Category 5): 7 hull types x 4 parts

DM_URL = "https://raw.githubusercontent.com/xivapi/ffxiv-datamining/%s/csv/en/%%s.csv" % DM_COMMIT
TC_URL = "https://raw.githubusercontent.com/ffxiv-teamcraft/ffxiv-teamcraft/%s/libs/data/src/lib/json/%%s.json" % TC_COMMIT

args = sys.argv[1:]
def opt(name, default):
    return args[args.index(name) + 1] if name in args else default
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = opt("--out", os.path.join(ROOT, "data", "lists.json"))
CACHE = opt("--cache", "") or tempfile.mkdtemp(prefix="lists-data-")
EXPECT = int(opt("--expect-recipes", EXPECT_RECIPES))
EXPECT_SUB = int(opt("--expect-submarine", EXPECT_SUBMARINE))
EXPECT_AIR = int(opt("--expect-airship", EXPECT_AIRSHIP))


def stop(msg):
    sys.exit("lists-data.py: STOP - " + msg)


def fetch(url, key):
    """Return the text at url, kept in the cache under key (which names the commit)."""
    path = os.path.join(CACHE, key)
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        req = urllib.request.Request(url, headers={"User-Agent": "eveniunt-data-snapshot"})
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                body = r.read()
        except Exception as e:
            stop("cannot fetch %s (%s)" % (url, e))
        with open(path + ".part", "wb") as f:
            f.write(body)
        os.replace(path + ".part", path)
    with open(path, encoding="utf-8-sig") as f:
        return f.read()


def fetch_bytes(url, key):
    """The bytes at url, kept in the cache under key."""
    path = os.path.join(CACHE, key)
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        req = urllib.request.Request(url, headers={"User-Agent": "eveniunt-data-snapshot"})
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                body = r.read()
        except Exception as e:
            stop("cannot fetch %s (%s)" % (url, e))
        with open(path + ".part", "wb") as f:
            f.write(body)
        os.replace(path + ".part", path)
    with open(path, "rb") as f:
        return f.read()


JOB_ICONS = ["carpenter", "blacksmith", "armorer", "goldsmith", "leatherworker", "weaver", "alchemist", "culinarian",
             "miner", "botanist", "fisher"]
ICON_URL = "https://raw.githubusercontent.com/ffxiv-teamcraft/ffxiv-teamcraft/%s/apps/client/src/assets/icons/classjob/%%s.png" % TC_COMMIT


def icons():
    """{job: PNG bytes} for the 8 crafters and 3 gatherers; stops on a missing file, a file that is not a PNG, or one over 16 kB."""
    out = {}
    for j in JOB_ICONS:
        b = fetch_bytes(ICON_URL % j, "tc-%s/classjob/%s.png" % (TC_COMMIT[:8], j))
        if not b.startswith(b"\x89PNG\r\n\x1a\n"):
            stop("the icon of %s is not a PNG" % j)
        if len(b) > 16 * 1024:
            stop("the icon of %s is %d bytes, over 16 kB" % (j, len(b)))
        out[j] = b
    return out


def map_coord(raw, size, offset):
    """The game's map coordinate of a world position; the conversion of tools/info.py (coord)."""
    c = size / 100.0
    return 41.0 / c * ((raw + offset) * c + 1024.0) / 2048.0 + 1.0


def f(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def sheet(name):
    """{row id: {column: text}} for a pinned English game sheet."""
    csv.field_size_limit(1 << 30)
    rows = list(csv.reader(io.StringIO(fetch(DM_URL % name, "dm-%s/%s.csv" % (DM_COMMIT[:8], name)))))
    head = rows[0]
    return {int(r[0]): dict(zip(head, r)) for r in rows[1:] if r and r[0].isdigit()}


def tc(name):
    return json.loads(fetch(TC_URL % name, "tc-%s/%s.json" % (TC_COMMIT[:8], name)))


def i(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return 0


def clean(s):
    return " ".join(re.sub(r"[-]", "", re.sub(r"<[^>]+>", "", str(s or ""))).split())


def find_loop(recipes):
    """First loop through recipes alone (an item that needs itself), as a list of item ids, or None."""
    graph = {}
    for r in recipes.values():
        graph.setdefault(r[0], set()).update(a for a, _ in r[5])
    state = {}  # 1 on the path, 2 done
    for root in sorted(graph):
        if state.get(root):
            continue
        path, stack = [root], [iter(sorted(graph.get(root, ())))]
        state[root] = 1
        while stack:
            nxt = next(stack[-1], None)
            if nxt is None:
                state[path.pop()] = 2
                stack.pop()
            elif state.get(nxt) == 1:
                return path[path.index(nxt):] + [nxt]
            elif not state.get(nxt):
                state[nxt] = 1
                path.append(nxt)
                stack.append(iter(sorted(graph.get(nxt, ()))))
    return None


def compare(old, recipes, old_stamp, new_stamp):
    """The `changes` entry from the previous file to this one, or None when neither the stamp nor any recipe differs.
    `recipes` holds [old row, new row] for a changed recipe and [null, new row] for an added one; `gone` the old row of a removed one.
    A stamp change with no recipe difference still gives an entry (empty), so a list's stamp always chains to the newest."""
    changed = {}
    for k in sorted(recipes):
        key = str(k)
        if key not in old:
            changed[key] = [None, recipes[k]]
        elif old[key] != recipes[k]:
            changed[key] = [old[key], recipes[k]]
    gone = {k: old[k] for k in sorted(old, key=int) if int(k) not in recipes}
    if not changed and not gone and old_stamp == new_stamp:
        return None
    return {"from": old_stamp, "to": new_stamp, "recipes": changed, "gone": gone}


def build():
    ITEM, RECIPE, RLT, PLACE = sheet("Item"), sheet("Recipe"), sheet("RecipeLevelTable"), sheet("PlaceName")
    place = {k: clean(r.get("Name")) for k, r in PLACE.items()}
    PNAME, GTYPE, GPOINT, GBASE, GSUB = (sheet("GatheringPointName"), sheet("GatheringType"), sheet("GatheringPoint"),
                                         sheet("GatheringPointBase"), sheet("GatheringSubCategory"))
    BOOK, CSEQ, CPART, CPROC, CSUP = (sheet("SecretRecipeBook"), sheet("CompanyCraftSequence"), sheet("CompanyCraftPart"),
                                      sheet("CompanyCraftProcess"), sheet("CompanyCraftSupplyItem"))
    EXPORT, MAP, SPEAR, FSHEET = sheet("ExportedGatheringPoint"), sheet("Map"), sheet("SpearfishingNotebook"), sheet("FishingSpot")

    # ---- recipes
    recipes, books, book_names = {}, {}, {}
    for rid, r in sorted(RECIPE.items()):
        res = i(r.get("ItemResult"))
        if not res:
            continue
        if res not in ITEM:
            stop("recipe %d makes item %d, which is not in Item" % (rid, res))
        yld = i(r.get("AmountResult"))
        if yld < 1:
            stop("recipe %d has yield %d" % (rid, yld))
        ing = []
        for n in range(8):
            it = i(r.get("Ingredient[%d]" % n))
            if it <= 0:  # 0 and -1 both mean "no ingredient in this slot"
                continue
            amt = i(r.get("AmountIngredient[%d]" % n))
            if it not in ITEM:
                stop("recipe %d needs item %d, which is not in Item" % (rid, it))
            if amt < 1:
                stop("recipe %d needs item %d x %d" % (rid, it, amt))
            ing.append([it, amt])
        t = RLT.get(i(r.get("RecipeLevelTable")), {})
        coll = i(r.get("CollectableMetadataKey")) or ITEM[res].get("AlwaysCollectable") == "True"
        flags = sum(b for b, on in ((1, r.get("CanHq") == "True"), (2, r.get("IsExpert") == "True"),
                                    (4, r.get("IsSpecializationRequired") == "True"), (8, coll),
                                    (16, r.get("CanQuickSynth") == "True"), (32, i(r.get("SecretRecipeBook")) > 0)) if on)
        bk = i(r.get("SecretRecipeBook"))
        if bk > 0:  # a master book: the sheet must name it and its item
            b = BOOK.get(bk)
            if not b or not clean(b.get("Name")) or i(b.get("Item")) not in ITEM or i(b.get("Item")) <= 0:
                stop("recipe %d needs master book %d, which SecretRecipeBook does not name with an item" % (rid, bk))
            books[rid] = i(b["Item"])
            book_names[i(b["Item"])] = clean(b["Name"])
        recipes[rid] = [res, yld, i(r.get("CraftType")), i(t.get("ClassJobLevel")), i(t.get("Stars")), ing, flags]
    if EXPECT and len(recipes) != EXPECT:
        stop("%d recipes, the first run recorded %d" % (len(recipes), EXPECT))
    loop = find_loop(recipes)
    if loop:
        stop("the recipes form a loop: " + " -> ".join(str(x) for x in loop))

    # ---- offers (every distinct one), indexed by the item they give
    offers = {}  # item -> {key: [gives, currencies, hq, rank, npc]}
    gil_sellers = {}  # item -> {(npc, gil per unit)}: every seller of a gil-only, normal-quality, rank-free offer that gives whole units
    for shop in tc("shops"):
        npc = min([n for n in shop.get("npcs") or [] if n], default=0)
        for tr in shop.get("trades") or []:
            cur = tr.get("currencies") or []
            if not cur:
                stop("shop %s has a trade without a currency" % shop.get("id"))
            cur = sorted([[c["id"], c["amount"]] for c in cur])
            for it in tr.get("items") or []:
                if it.get("amount", 0) < 1:
                    stop("shop %s gives %s x %s" % (shop.get("id"), it.get("id"), it.get("amount")))
                rank = tr.get("requiredGCRank") or 0
                hq = 1 if it.get("hq") else 0
                key = (it["amount"], json.dumps(cur), hq, rank)
                if len(cur) == 1 and cur[0][0] == 1 and not hq and not rank and cur[0][1] % it["amount"] == 0:
                    for n in shop.get("npcs") or []:
                        if n:
                            gil_sellers.setdefault(it["id"], set()).add((n, cur[0][1] // it["amount"]))
                slot = offers.setdefault(it["id"], {})
                if key in slot:
                    old = slot[key][4]
                    slot[key][4] = npc if not old else (min(old, npc) if npc else old)
                else:
                    slot[key] = [it["amount"], cur, hq, rank, npc]

    # ---- Free Company workshop projects: submarine (Category 7) and airship (Category 5) parts
    projects, n_kind = {}, {0: 0, 1: 0}
    for sid, r in sorted(CSEQ.items()):
        kind = {7: 0, 5: 1}.get(i(r.get("Category")))
        res = i(r.get("ResultItem"))
        if kind is None or not res:
            continue
        if res not in ITEM:
            stop("company craft %d makes item %d, which is not in Item" % (sid, res))
        part_ids = [i(r.get("CompanyCraftPart[%d]" % n)) for n in range(8)]
        part_ids = [p for p in part_ids if p]
        if not part_ids:
            stop("company craft %d (%s) has no part" % (sid, clean(ITEM[res].get("Name"))))
        parts = []
        for pid in part_ids:
            if pid not in CPART:
                stop("company craft %d: part %d is not in CompanyCraftPart" % (sid, pid))
            phases = []
            for n in range(3):
                proc = i(CPART[pid].get("CompanyCraftProcess[%d]" % n))
                if not proc:
                    continue
                if proc not in CPROC:
                    stop("company craft %d: process %d is not in CompanyCraftProcess" % (sid, proc))
                sup = []
                for m in range(12):
                    sref = i(CPROC[proc].get("SupplyItem[%d]" % m))
                    per, sets = i(CPROC[proc].get("SetQuantity[%d]" % m)), i(CPROC[proc].get("SetsRequired[%d]" % m))
                    if not sref:
                        continue
                    it = i((CSUP.get(sref) or {}).get("Item"))
                    if it <= 0 or it not in ITEM or per < 1 or sets < 1:
                        stop("company craft %d: supply %d of process %d reads as item %d x %d x %d" % (sid, sref, proc, it, per, sets))
                    sup.append([it, per, sets])
                if not sup:
                    stop("company craft %d: process %d has no supply item" % (sid, proc))
                phases.append(sup)
            if not phases:
                stop("company craft %d (%s): part %d has no phase" % (sid, clean(ITEM[res].get("Name")), pid))
            parts.append(phases)
        if res in projects:
            stop("company craft %d: item %d is the result of two sequences" % (sid, res))
        projects[res] = [kind, parts]
        n_kind[kind] += 1
    if EXPECT_SUB and n_kind[0] != EXPECT_SUB:
        stop("%d submarine parts, expected %d" % (n_kind[0], EXPECT_SUB))
    if EXPECT_AIR and n_kind[1] != EXPECT_AIR:
        stop("%d airship parts, expected %d" % (n_kind[1], EXPECT_AIR))

    # ---- closure
    closure = set()
    for r in recipes.values():
        closure.add(r[0])
        closure.update(a for a, _ in r[5])
    for res, (_, parts) in projects.items():
        closure.add(res)
        for phases in parts:
            for sup in phases:
                closure.update(a for a, _, _ in sup)
    todo = sorted(closure)
    while todo:
        it = todo.pop()
        for o in offers.get(it, {}).values():
            for c, _ in o[1]:
                if c not in closure:
                    closure.add(c)
                    todo.append(c)
    for it in closure:
        if it not in ITEM:
            stop("item %d is needed by the file but is not in Item" % it)

    items = {}
    for it in sorted(closure):
        r = ITEM[it]
        flags = sum(b for b, on in ((1, i(r.get("ItemSearchCategory")) > 0), (2, r.get("CanBeHq") == "True"),
                                    (4, r.get("AlwaysCollectable") == "True"), (8, 2 <= it <= 19),
                                    (16, r.get("IsUntradable") != "True")) if on)
        items[it] = [clean(r.get("Name")), flags, i(r.get("PriceMid"))]

    # ---- trades: gil-only offers first
    trades, sellers = {}, set()
    for it in sorted(closure):
        lst = list(offers.get(it, {}).values())
        if not lst:
            continue
        lst.sort(key=lambda o: (0 if (len(o[1]) == 1 and o[1][0][0] == 1) else 1, o[1], o[0], o[2], o[3], o[4]))
        trades[it] = lst
        sellers.update(o[4] for o in lst if o[4])
    currencies = sorted({c for lst in trades.values() for o in lst for c, _ in o[1] if c != 1 and not items[c][1] & 1})
    sellers_of = {it: [[n, p] for p, n in sorted((p, n) for n, p in found)] for it, found in sorted(gil_sellers.items()) if it in closure}
    sellers.update(n for lst in sellers_of.values() for n, _ in lst)
    NPC = tc("npcs")
    npcs = {}
    for n in sorted(sellers):
        r = NPC.get(str(n)) or {}
        name = clean((r.get("en") or "")) if isinstance(r.get("en"), str) else ""
        zone = place.get(i((r.get("position") or {}).get("zoneid")), "")
        if name or zone:
            npcs[n] = [name, zone]

    # ---- gather: nodes first, then fishing
    NODES, GITEMS = tc("nodes"), tc("gathering-items")
    by_item = {}
    for nid, n in NODES.items():
        for it in (n.get("items") or []) + (n.get("hiddenItems") or []):
            by_item.setdefault(it, []).append((int(nid), n))
    level_of = {}
    for gi in GITEMS.values():
        level_of.setdefault(gi.get("itemId"), gi.get("level") or 0)
    sublime_of = {gi["sublimeVariant"]: gi["itemId"] for gi in GITEMS.values() if gi.get("sublimeVariant")}
    FSRC = tc("fishing-sources")
    SPOTS = {s["id"]: s for s in tc("fishing-spots")}

    # the legacy shape, exactly as the page of work item W6 reads it
    legacy = {}
    for it in sorted(closure):
        ns = by_item.get(it) or by_item.get(sublime_of.get(it)) or []
        if ns:
            ns = sorted(ns, key=lambda p: (bool(p[1].get("spawns")), p[1].get("level", 0), p[0]))
            n0 = ns[0][1]
            hours = 0
            minutes = 0
            if all(n.get("spawns") for _, n in ns):
                hours = sorted(set(h for _, n in ns for h in n["spawns"]))
                minutes = max(n.get("duration") or 120 for _, n in ns)
            legacy[it] = [0 if n0.get("type") in (0, 1) else 1, level_of.get(it) or n0.get("level", 0),
                          place.get(i(n0.get("zoneid")), ""), hours, minutes]
            continue
        spots = sorted((SPOTS[s["spot"]] for s in FSRC.get(str(it)) or [] if s.get("spot") in SPOTS), key=lambda s: (s.get("level", 0), s["id"]))
        if spots:
            legacy[it] = [2, spots[0].get("level", 0), place.get(i(spots[0].get("placeId")), ""), 0, 0]

    # the map position of every Teamcraft node, proved against the game sheets: the sheet's own world X and Z
    # (ExportedGatheringPoint, keyed by the node id) through the map's size factor and offsets must give Teamcraft's
    # x and y (the game's map scale); the node id must be a GatheringPointBase with GatheringPoint rows of one point type
    # that the exported point shares; the gathering type must agree in the node, the base and the export.
    points_of = {}
    for pid, r in GPOINT.items():
        points_of.setdefault(i(r.get("GatheringPointBase")), []).append(pid)
    placed = {}  # node id -> (x, y, the map's zone name), only nodes on a real map (map 0 and zone 0 are the sheet's placeholder rows)
    for nid, n in NODES.items():
        nid = int(nid)
        if "x" not in n:
            continue
        if nid not in GBASE or nid not in points_of:
            stop("Teamcraft node %d (with a position) is no GatheringPointBase with GatheringPoint rows" % nid)
        ex = EXPORT.get(nid)
        if not ex:
            stop("node %d has no row in ExportedGatheringPoint" % nid)
        if not (n.get("type") == i(GBASE[nid].get("GatheringType")) == i(ex.get("GatheringType"))):
            stop("node %d: the gathering type differs (Teamcraft %s, base %s, export %s)" % (nid, n.get("type"), GBASE[nid].get("GatheringType"), ex.get("GatheringType")))
        types = set(i(GPOINT[p].get("Type")) for p in points_of[nid])
        if types != {i(ex.get("GatheringPointType"))}:
            stop("node %d: the point type of its GatheringPoint rows %s differs from the export's %s" % (nid, sorted(types), ex.get("GatheringPointType")))
        if not n.get("map") or not n.get("zoneid"):
            continue
        m = MAP.get(i(n["map"]))
        if not m:
            stop("node %d is on map %s, which is not in Map" % (nid, n.get("map")))
        size = f(m.get("SizeFactor")) or 100.0
        x, y = map_coord(f(ex.get("X")), size, f(m.get("OffsetX"))), map_coord(f(ex.get("Y")), size, f(m.get("OffsetY")))
        if abs(x - n["x"]) > 0.06 or abs(y - n["y"]) > 0.06:
            stop("node %d: the sheets give (%.2f, %.2f), Teamcraft (%s, %s): not the game's map scale" % (nid, x, y, n["x"], n["y"]))
        placed[nid] = (round(x, 1), round(y, 1), place.get(i(m.get("PlaceName")), ""))

    # the nearest aetheryte of a map (type 0 of Teamcraft's aetherytes.json), named by PlaceName
    AE = [a for a in tc("aetherytes") if a.get("type") == 0]
    aeth_used = {}

    def nearest(map_id, x, y):
        best = None
        for a in AE:
            if a.get("map") != map_id:
                continue
            d = (a["x"] - x) ** 2 + (a["y"] - y) ** 2
            if best is None or (d, a["id"]) < best[:2]:
                best = (d, a["id"], place.get(i(a.get("nameid")), ""))
        if not best or not best[2]:
            return 1e18, 0
        aeth_used[best[1]] = best[2]
        return best[0], best[1]

    used_rows = set()

    def name_row(nid, n):
        """The GatheringPointName row of a node, or stop."""
        ex = EXPORT[nid]
        gtype, ptype = i(ex.get("GatheringType")), i(ex.get("GatheringPointType"))
        if gtype not in GTYPE:
            stop("node %d: gathering type %d is not in GatheringType" % (nid, gtype))
        if gtype == 5:  # spearfishing: the notebook says whether it is a shadow
            nb = [r for r in SPEAR.values() if i(r.get("GatheringPointBase")) == nid]
            if len(nb) != 1 or ptype not in (1, 6) or (ptype == 6) != (nb[0].get("IsShadowNode") == "True"):
                stop("node %d: no spearfishing notebook row agrees with its point type" % nid)
            row = 22 if ptype == 6 else 21
        elif 0 <= gtype <= 3 and ptype in (1, 3):
            row = 1 + gtype  # an ordinary node
        elif 0 <= gtype <= 3 and ptype in (2, 4, 5):
            row = {2: 5, 4: 9, 5: 13}[ptype] + gtype  # unspoiled, ephemeral, legendary
        else:
            stop("node %d: no name row for gathering type %d and point type %d" % (nid, gtype, ptype))
        if row not in PNAME or not clean(PNAME[row].get("Singular")):
            stop("GatheringPointName has no row %d (node %d)" % (row, nid))
        used_rows.add(row)
        return row

    def folklore_of(nid, n):
        """The folklore book's name or 0; Teamcraft's book must be the one the sheet gives."""
        subs = set(i(GPOINT[p].get("GatheringSubCategory")) for p in points_of[nid])
        books = set(i(GSUB[x].get("Item")) for x in subs if x and x in GSUB) - {0}
        tcb = n.get("folklore") or 0
        if (books and books != {tcb}) or (tcb and not books):
            stop("node %d: Teamcraft's folklore %s differs from the sheet's %s" % (nid, tcb, sorted(books)))
        if not tcb:
            return 0
        if tcb not in ITEM:
            stop("folklore item %s is not in Item" % tcb)
        return clean(ITEM[tcb].get("Name"))

    gather = {}
    for it in sorted(closure):
        ns = by_item.get(it) or by_item.get(sublime_of.get(it)) or []
        rows = []
        if ns:
            for nid, n in sorted(dict(ns).items()):
                if nid not in placed:
                    continue
                x, y, zone = placed[nid]
                job = 0 if n["type"] in (0, 1) else (1 if n["type"] in (2, 3) else 2)
                dist, aid = nearest(n["map"], x, y)
                timed = bool(n.get("spawns"))
                hidden = 1 if (it in (n.get("hiddenItems") or []) and it not in (n.get("items") or [])) else 0
                rows.append(((n.get("level", 0), dist, nid), [job, name_row(nid, n), n.get("level", 0), zone or place.get(i(n["zoneid"]), ""), x, y, aid,
                             sorted(set(n["spawns"])) if timed else 0, (n.get("duration") or 120) if timed else 0, folklore_of(nid, n), hidden]))
            rows.sort(key=lambda p: p[0])
            if rows:
                gather[it] = [r for _, r in rows]
            else:  # nodes without a map position: one entry that keeps the job, the level and the zone when known
                n0 = sorted(ns, key=lambda p: (p[1].get("level", 0), p[0]))[0][1]
                gather[it] = [[0 if n0.get("type") in (0, 1) else (1 if n0.get("type") in (2, 3) else 2), 0,
                               level_of.get(it) or n0.get("level", 0), place.get(i(n0.get("zoneid")), ""), 0, 0, 0, 0, 0, 0, 0]]
            continue
        for sp in (SPOTS[s["spot"]] for s in FSRC.get(str(it)) or [] if s.get("spot") in SPOTS):
            c = sp.get("coords") or {}
            x, y = round(f(c.get("x")), 1), round(f(c.get("y")), 1)
            fr = FSHEET.get(sp["id"])
            if fr and f(fr.get("X")) and c:  # the sheet's pixel position must give Teamcraft's
                size = f(MAP.get(i(sp.get("mapId")), {}).get("SizeFactor")) or 100.0
                sx, sy = 41.0 / (size / 100.0) * f(fr["X"]) / 2048 + 1, 41.0 / (size / 100.0) * f(fr["Z"]) / 2048 + 1
                if abs(sx - c["x"]) > 0.1 or abs(sy - c["y"]) > 0.1:
                    stop("fishing spot %s: the sheet gives (%.2f, %.2f), Teamcraft (%s, %s)" % (sp["id"], sx, sy, c["x"], c["y"]))
            dist, aid = nearest(sp.get("mapId"), x, y) if c else (1e18, 0)
            rows.append(((sp.get("level", 0), dist, sp["id"]), [2, 0, sp.get("level", 0), place.get(i(sp.get("placeId")), ""), x, y, aid, 0, 0, 0, 0,
                         place.get(i(sp.get("zoneId")), "")]))
        if rows:
            rows.sort(key=lambda p: p[0])
            gather[it] = [r for _, r in rows]

    crafters = {}
    for rid in sorted(recipes, key=lambda r: (recipes[r][3], r)):
        crafters.setdefault(recipes[rid][0], []).append([rid, recipes[rid][2], recipes[rid][3]])
    node_names = {r: " ".join(w.capitalize() for w in clean(PNAME[r].get("Singular")).split()) for r in sorted(used_rows)}

    stamp = "%s %s %s" % (GAME_VERSION, DM_COMMIT[:8], TC_COMMIT[:8])
    if len(stamp) > 40:
        stop("the stamp is %d characters" % len(stamp))
    return {"stamp": stamp, "items": items, "recipes": recipes, "crafters": crafters, "gather": gather,
            "gatherLegacy": legacy, "nodeNames": node_names, "aetherytes": aeth_used, "trades": trades, "npcs": npcs,
            "currencies": currencies, "sellers": sellers_of, "books": books, "bookNames": book_names, "projects": projects}


def main():
    out = build()
    changes = []
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as f:
            prev = json.load(f)
        changes = list(prev.get("changes") or [])
        entry = compare(prev.get("recipes") or {}, out["recipes"], prev.get("stamp", ""), out["stamp"])
        if entry:
            changes.append(entry)
    out["changes"] = changes
    pngs = icons()
    text = json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n"
    os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
    with open(OUT + ".part", "w", encoding="utf-8") as f:
        f.write(text)
    os.replace(OUT + ".part", OUT)
    icon_dir = os.path.join(os.path.dirname(os.path.abspath(OUT)), "classjob")
    os.makedirs(icon_dir, exist_ok=True)
    for j, b in pngs.items():
        with open(os.path.join(icon_dir, j + ".png"), "wb") as fh:
            fh.write(b)
    gil = other = 0
    for lst in out["trades"].values():
        for o in lst:
            if len(o[1]) == 1 and o[1][0][0] == 1:
                gil += 1
            else:
                other += 1
    print("lists-data.py: wrote %s: %d recipes, %d items, %d gil offers, %d other offers, %d bytes" % (
        OUT, len(out["recipes"]), len(out["items"]), gil, other, len(text.encode("utf-8"))))
    print("lists-data.py: %d market items, %d currencies, %d items with several gil sellers, %d master-book recipes, %d books, "
          "%d submarine and %d airship parts, %d phases, %d supply items" % (
              sum(1 for v in out["items"].values() if v[1] & 1), len(out["currencies"]),
              sum(1 for v in out["sellers"].values() if len(v) > 1), len(out["books"]), len(out["bookNames"]),
              sum(1 for v in out["projects"].values() if v[0] == 0), sum(1 for v in out["projects"].values() if v[0] == 1),
              sum(len(pt) for _, parts in out["projects"].values() for pt in parts),
              sum(len(ph) for _, parts in out["projects"].values() for pt in parts for ph in pt)))


if __name__ == "__main__":
    main()
