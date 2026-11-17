#!/usr/bin/env python3
"""Snapshot the hunt-mark spawn points from Hunt Helper (img02/HuntHelper, MIT licence) into data/spawn-points.json.

Hunt Helper's SpawnPointData.json lists, for every hunt zone, the map positions where elite marks can appear and
which ranks (S, A, B) use each one. Only those facts are kept: zone id, zone name and [x, y, ranks] per point,
with ranks as a bit mask (1 = S, 2 = A, 4 = B). The file is read as data; nothing from the repository is run.

Usage: python3 -I tools/fetch-spawnpoints.py   (needs network access to raw.githubusercontent.com)
"""
import json, os, urllib.request

COMMIT = "0c07d87a1e951f9dce7a17e500d41bbc752bee94"  # img02/HuntHelper, 2026-08-07
URL = f"https://raw.githubusercontent.com/img02/HuntHelper/{COMMIT}/HuntHelper/Data/SpawnPointData.json"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "spawn-points.json")

with urllib.request.urlopen(urllib.request.Request(URL, headers={"User-Agent": "eveniunt-tracker-data-snapshot"}), timeout=60) as r:
    rows = json.load(r)
zones = {}
for m in rows:
    pts = [[round(float(p["X"]), 2), round(float(p["Y"]), 2), (1 if p.get("S") else 0) | (2 if p.get("A") else 0) | (4 if p.get("B") else 0)] for p in m["Positions"]]
    zones[str(int(m["MapID"]))] = {"name": m["MapName"], "pts": pts}
out = {"_about": "Elite mark spawn points per hunt zone from Hunt Helper (img02/HuntHelper, MIT licence, commit " + COMMIT +
       "). Points are map coordinates; the third number lists the ranks that use the point (1 = S, 2 = A, 4 = B).", "zones": zones}
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
print(len(zones), "zones,", sum(len(z["pts"]) for z in zones.values()), "points")
