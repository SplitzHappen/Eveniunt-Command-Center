#!/usr/bin/env python3
"""Fetch the fishing windows from ff14-fish-tracker-app (MIT License, (c) icykoneko) at a pinned commit and keep only
what the information window uses: data/fish-tracker.json.

  python3 -I tools/fetch-fishdata.py [commit]

The source file is a JavaScript module (js/app/data.js); it is read as text, never run: each top-level block is
plain JSON and is parsed with the json module.
"""
import json, os, re, sys, urllib.request

COMMIT = sys.argv[1] if len(sys.argv) > 1 else "f5a51e5d3eb0eccb9a5e25899397e0d9cb5a6f66"
URL = "https://raw.githubusercontent.com/icykoneko/ff14-fish-tracker-app/%s/js/app/data.js" % COMMIT
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "fish-tracker.json")

src = urllib.request.urlopen(URL, timeout=120).read().decode("utf-8")
def block(name):
    m = re.search(r"\n\s*" + name + r"\s*:\s*\{", src)
    i = src.index("{", m.start()); depth = 0
    for j in range(i, len(src)):
        if src[j] == "{": depth += 1
        elif src[j] == "}":
            depth -= 1
            if depth == 0: return json.loads(src[i:j + 1])
FISH_KEYS = ["startHour", "endHour", "weatherSet", "previousWeatherSet", "bestCatchPath", "predators", "fishEyes", "snagging", "folklore", "location", "gig"]
keep = lambda x: x is not None and x is not False and x != []  # an hour of 0 is kept
fish = {k: {f: v.get(f) for f in FISH_KEYS if keep(v.get(f))} for k, v in block("FISH").items()}
names = lambda b, f="name_en": {k: v.get(f) for k, v in block(b).items() if v.get(f)}
out = {"_about": "Fishing windows from ff14-fish-tracker-app (MIT License, (c) icykoneko), commit " + COMMIT,
       "FISH": fish, "ITEMS": {k: {"name_en": v} for k, v in names("ITEMS").items()},
       "WEATHER_TYPES": {k: {"name_en": v} for k, v in names("WEATHER_TYPES").items()},
       "SPEARFISHING_SPOTS": {k: {"name_en": v} for k, v in names("SPEARFISHING_SPOTS").items()},
       "FOLKLORE": {k: {"book_en": v} for k, v in names("FOLKLORE", "book_en").items()}}
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
print(len(fish), "fish ->", OUT, os.path.getsize(OUT), "bytes")
