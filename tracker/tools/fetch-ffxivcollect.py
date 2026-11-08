#!/usr/bin/env python3
"""Snapshot the FFXIV Collect public API (MIT-licensed project, community data) into data/ffxivcollect/.

For each collection it saves: id, name, patch, item id and "how to get it" sources, plus two id lists
taken with the API's own filters: items with at least one time-limited source, and items with at least
one source that is not time-limited. An item in the first list but not the second can only be obtained
from time-limited sources (events, seasonal content, ended promotions); the Tracker marks it with an X
and leaves it out of totals unless the user chooses to count it.

Usage: python3 -I tools/fetch-ffxivcollect.py   (needs network access to ffxivcollect.com)
"""
import json, os, sys, time, urllib.request, datetime

API = "https://ffxivcollect.com/api/"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "ffxivcollect")
KINDS = ["mounts", "minions", "orchestrions", "emotes", "hairstyles", "bardings", "fashions", "facewear", "spells",
         "achievements", "titles", "frames", "triad/cards", "armoires", "outfits"]
if len(sys.argv) > 1: KINDS = [k for k in KINDS if k in sys.argv[1:]]  # refresh only the named collections

def get(path):
    req = urllib.request.Request(API + path, headers={"User-Agent": "eveniunt-tracker-data-snapshot"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)

os.makedirs(OUT, exist_ok=True)
_sp = os.path.join(OUT, "SNAPSHOT.json")
summary = json.load(open(_sp)) if len(sys.argv) > 1 and os.path.exists(_sp) else {"fetched": datetime.date.today().isoformat(), "api": API, "counts": {}}
if len(sys.argv) > 1: summary.setdefault("refreshed", {}).update({k: datetime.date.today().isoformat() for k in KINDS})
for kind in KINDS:
    rows = get(f"{kind}?limit=10000")["results"]
    keep = []
    for r in rows:
        k = {x: r.get(x) for x in ("id", "name", "patch", "item_id", "tradeable", "category", "type", "points", "reward", "achievement", "number") if r.get(x) not in (None, "")}
        if isinstance(k.get("category"), dict):
            k["category"] = k["category"].get("name")
        if isinstance(k.get("type"), dict):
            k["type"] = k["type"].get("name")
        if r.get("sources"):
            k["sources"] = [{"type": s.get("type"), "text": s.get("text")} for s in r["sources"]]
        keep.append(k)
    lim = nonlim = []
    if any("sources" in r for r in rows):
        lim = sorted(x["id"] for x in get(f"{kind}?sources_limited_eq=true&limit=10000")["results"])
        nonlim = sorted(x["id"] for x in get(f"{kind}?sources_limited_eq=false&limit=10000")["results"])
    data = {"kind": kind, "items": keep, "with_limited_source": lim, "with_permanent_source": nonlim}
    with open(os.path.join(OUT, kind.replace("/", "-") + ".json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    only = sorted(set(lim) - set(nonlim))
    summary["counts"][kind] = {"items": len(keep), "time_limited_only": len(only)}
    print(kind, summary["counts"][kind], file=sys.stderr)
with open(os.path.join(OUT, "SNAPSHOT.json"), "w") as f:
    json.dump(summary, f, indent=1)
