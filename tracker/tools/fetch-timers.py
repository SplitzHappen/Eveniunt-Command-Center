#!/usr/bin/env python3
"""Refresh data/timers.json (upcoming events and maintenance) from Xenoveritas' FFXIV timers, which follow the Lodestone.

  python3 -I tools/fetch-timers.py      (needs network access to www.xenoveritas.org; run before tools/live.py)
"""
import datetime, html, json, os, re, urllib.request
URL = "https://www.xenoveritas.org/static/ffxiv/timers.json"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "timers.json")
req = urllib.request.Request(URL, headers={"User-Agent": "eveniunt-tracker-data-snapshot"})
with urllib.request.urlopen(req, timeout=60) as r:
    src = json.load(r)
timers = [{"name": html.unescape(re.sub(r"<[^>]+>", "", str(t.get("name", "")))).strip(), "type": t.get("type"), "start": t.get("start"), "end": t.get("end")}
          for t in src.get("timers", []) if t.get("start")]
about = json.load(open(OUT)).get("_about", "") if os.path.exists(OUT) else ""
json.dump({"_about": about or "Upcoming events and maintenance, from Xenoveritas' FFXIV timers (which follow the Lodestone).", "fetched": datetime.date.today().isoformat(), "timers": timers},
          open(OUT, "w"), ensure_ascii=False, indent=0)
print(len(timers), "timers")
