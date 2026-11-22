#!/usr/bin/env python3
"""Build data/lists.json for the Command Center's Lists module (work item W1 of docs/lists-spec.md, section 3).

Usage:
  python3 -I tools/lists-data.py [--cache DIR] [--out data/lists.json] [--expect-recipes N]

Every input is fetched from a pinned commit on raw.githubusercontent.com (or read from --cache, where each file is kept
under its own commit). Files are read as data; nothing from another repository is run. Sources (see data/SOURCES.md,
section "Lists"):

  * Game data: xivapi/ffxiv-datamining (English CSVs, game 7.57h1): Item, Recipe, RecipeLevelTable, PlaceName.
    Game data (c) SQUARE ENIX CO., LTD.
  * FFXIV Teamcraft (MIT): shops.json (offers), nodes.json, gathering-items.json, fishing-sources.json,
    fishing-spots.json, npcs.json.

Output tables (all ids are game row ids; compact arrays):
  stamp   "<game version> <8 of sheet commit> <8 of Teamcraft commit>", at most 40 characters
  items   {id: [name, flags, merchantSells]}   flags: 1 tradable, 2 can be HQ, 4 always collectable, 8 crystal.
          merchantSells: the Item sheet's PriceMid, the gil price a merchant asks (0 = none).
  recipes {id: [item, yield, job 0-7, level, stars, [[item, amount]...], flags]}
          job: CraftType (0 CRP, 1 BSM, 2 ARM, 3 GSM, 4 LTW, 5 WVR, 6 ALC, 7 CUL).
          flags: 1 can be HQ, 2 expert, 4 specialist, 8 collectable, 16 quick synthesis, 32 master book.
  gather  {item: [job, level, zone, hours or 0, minutes or 0]}   job: 0 miner, 1 botanist, 2 fisher.
          hours: the sorted Eorzea spawn hours and minutes: how long a node stays, when EVERY node of the item is timed
          (the rule of tools/info.py for conditions.json); otherwise 0 and 0. Fish carry no window (the pinned files
          hold none).
  trades  {item: [[gives, [[currency, amount]...], hq 0/1, gcRank or 0, npc]...]}   gil-only offers first.
  npcs    {npc: [name, zone]}   sellers named in trades whose name or place is known.
  changes [{from, to, recipes: {id: [old row or null, new row]}, gone: {id: old row}}]   (the `log` table is added by W6)

Closure: the file holds every item that is a recipe's result or ingredient and every currency of a kept offer, and for
each of those its own offers and nodes, repeated until nothing new is added.

The build stops, writing nothing, when: a fetch fails; a recipe names an item missing from Item; a yield or an amount is
below 1; a trade gives fewer than 1 or has no currency; the recipes form a loop; the stamp is longer than 40
characters; or the recipe count differs from EXPECT_RECIPES.
"""
import csv, io, json, os, re, sys, tempfile, urllib.request

DM_COMMIT = "44948e4cda5846eab0baa9872122a888fcc4f1b1"  # xivapi/ffxiv-datamining, game 7.57h1, 2026-10-20
TC_COMMIT = "70429e214dc952be23114df514a18223dc429449"  # ffxiv-teamcraft/ffxiv-teamcraft, 2026-11-07 (MIT)
GAME_VERSION = "7.57h1"
EXPECT_RECIPES = 13892  # the count of the first run (2026-11-22), see data/SOURCES.md

DM_URL = "https://raw.githubusercontent.com/xivapi/ffxiv-datamining/%s/csv/en/%%s.csv" % DM_COMMIT
TC_URL = "https://raw.githubusercontent.com/ffxiv-teamcraft/ffxiv-teamcraft/%s/libs/data/src/lib/json/%%s.json" % TC_COMMIT

args = sys.argv[1:]
def opt(name, default):
    return args[args.index(name) + 1] if name in args else default
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = opt("--out", os.path.join(ROOT, "data", "lists.json"))
CACHE = opt("--cache", "") or tempfile.mkdtemp(prefix="lists-data-")
EXPECT = int(opt("--expect-recipes", EXPECT_RECIPES))


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

    # ---- recipes
    recipes = {}
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
        recipes[rid] = [res, yld, i(r.get("CraftType")), i(t.get("ClassJobLevel")), i(t.get("Stars")), ing, flags]
    if EXPECT and len(recipes) != EXPECT:
        stop("%d recipes, the first run recorded %d" % (len(recipes), EXPECT))
    loop = find_loop(recipes)
    if loop:
        stop("the recipes form a loop: " + " -> ".join(str(x) for x in loop))

    # ---- offers (every distinct one), indexed by the item they give
    offers = {}  # item -> {key: [gives, currencies, hq, rank, npc]}
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
                slot = offers.setdefault(it["id"], {})
                if key in slot:
                    old = slot[key][4]
                    slot[key][4] = npc if not old else (min(old, npc) if npc else old)
                else:
                    slot[key] = [it["amount"], cur, hq, rank, npc]

    # ---- closure
    closure = set()
    for r in recipes.values():
        closure.add(r[0])
        closure.update(a for a, _ in r[5])
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
        flags = sum(b for b, on in ((1, r.get("IsUntradable") != "True"), (2, r.get("CanBeHq") == "True"),
                                    (4, r.get("AlwaysCollectable") == "True"), (8, 2 <= it <= 19)) if on)
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
    gather = {}
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
            gather[it] = [0 if n0.get("type") in (0, 1) else 1, level_of.get(it) or n0.get("level", 0),
                          place.get(i(n0.get("zoneid")), ""), hours, minutes]
            continue
        spots = sorted((SPOTS[s["spot"]] for s in FSRC.get(str(it)) or [] if s.get("spot") in SPOTS), key=lambda s: (s.get("level", 0), s["id"]))
        if spots:
            gather[it] = [2, spots[0].get("level", 0), place.get(i(spots[0].get("placeId")), ""), 0, 0]

    stamp = "%s %s %s" % (GAME_VERSION, DM_COMMIT[:8], TC_COMMIT[:8])
    if len(stamp) > 40:
        stop("the stamp is %d characters" % len(stamp))
    return {"stamp": stamp, "items": items, "recipes": recipes, "gather": gather, "trades": trades, "npcs": npcs}


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
    text = json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n"
    os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
    with open(OUT + ".part", "w", encoding="utf-8") as f:
        f.write(text)
    os.replace(OUT + ".part", OUT)
    gil = other = 0
    for lst in out["trades"].values():
        for o in lst:
            if len(o[1]) == 1 and o[1][0][0] == 1:
                gil += 1
            else:
                other += 1
    print("lists-data.py: wrote %s: %d recipes, %d items, %d gil offers, %d other offers, %d bytes" % (
        OUT, len(out["recipes"]), len(out["items"]), gil, other, len(text.encode("utf-8"))))


if __name__ == "__main__":
    main()
