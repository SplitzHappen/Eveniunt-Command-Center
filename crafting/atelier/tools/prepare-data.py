#!/usr/bin/env python3
"""Collect data the Atelier needs beyond Raphael's crates.

  python3 prepare-data.py <ffxiv-datamining checkout> <raphael-rs checkout>

Writes atelier/data/atelier-data.json:
  condFlags   recipe level -> RecipeLevelTable.ConditionsFlag (which material conditions can appear)
  cosmic      recipe id -> Cosmic tiers / Material Miracle and Stellar Steady Hand charges (from ../data/cosmic-db.json)
  i18n        Raphael UI strings (raphael-translations/translations.toml), keyed by English text
  log         crafting-log order: RecipeNotebookList pages per job (rows 0-319 = job*40 + level division,
              rows 1000+ = 1000 + (division-1000)*8 + job), level divisions first, then special divisions by
              NotebookDivisionCategory.Index; division names in en/de/fr/jp where the sheet exists
"""
import csv, json, os, sys, tomllib

dm, raph = sys.argv[1], sys.argv[2]
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.join(here, "..")

flags = {}
with open(os.path.join(dm, "csv", "en", "RecipeLevelTable.csv"), encoding="utf-8") as f:
    rows = list(csv.reader(f))
h = rows[0]
ci = h.index("ConditionsFlag")
for r in rows[1:]:
    if r and r[0].isdigit():
        flags[int(r[0])] = int(r[ci])

db = json.load(open(os.path.join(root, "..", "data", "cosmic-db.json"), encoding="utf-8"))
cosmic = {}
for m in db["missions"]:
    obj = m["objectives"][0] if m["objectives"] else {}
    for rid in m["recipes"]:
        r = db["recipes"][str(rid)]
        if str(rid) in cosmic:
            continue
        cosmic[str(rid)] = {
            "tiers": r["tiers"], "pct": r["tierPct"], "planet": m["planet"], "rank": m["rank"],
            "mm": obj.get("specialActionCharges", 0) if obj.get("specialAction") == "MaterialMiracle" else 0,
            "ssh": obj.get("specialActionCharges", 0) if obj.get("specialAction") == "StellarSteadyHand" else 0,
        }

with open(os.path.join(raph, "raphael-translations", "translations.toml"), "rb") as f:
    tr = tomllib.load(f)
langmap = {"de": "de", "fr": "fr", "ja": "jp", "chs": "cn", "ko": "kr", "tc": "tw"}
i18n = {}
for k, v in tr.items():
    en = v.get("en")
    if not en or en.startswith("EXAMPLE"):
        continue
    i18n[en] = {langmap[l]: v[l] for l in langmap if v.get(l)}

def sheet(lang, name):
    fn = os.path.join(dm, "csv", lang, name + ".csv")
    if not os.path.exists(fn):
        return None
    with open(fn, encoding="utf-8") as f:
        rows = list(csv.reader(f))
    return rows[0], [r for r in rows[1:] if r and r[0].lstrip("-").isdigit()]

h, nd = sheet("en", "NotebookDivision")
cat_col = h.index("NotebookDivisionCategory")
_, ndc = sheet("en", "NotebookDivisionCategory")
cat_index = {int(r[0]): int(r[2]) for r in ndc}
names = {}
for lang, key in (("en", "en"), ("de", "de"), ("fr", "fr"), ("ja", "jp")):
    sh = sheet(lang, "NotebookDivision")
    if sh:
        for r in sh[1]:
            names.setdefault(int(r[0]), {})[key] = r[1]
div_cat = {int(r[0]): int(r[cat_col]) for r in nd}
cat_names = {}
for lang, key in (("en", "en"), ("de", "de"), ("fr", "fr"), ("ja", "jp")):
    sh = sheet(lang, "NotebookDivisionCategory")
    if sh:
        for r in sh[1]:
            if r[1]:
                cat_names.setdefault(int(r[0]), {})[key] = r[1]
_, rnl = sheet("en", "RecipeNotebookList")
pages = {}  # (job, division) -> recipe ids in log order
for r in rnl:
    row = int(r[0])
    if row < 1000:
        job, div = divmod(row, 40)
    else:
        q, job = divmod(row - 1000, 8)
        div = 1000 + q
    ids = [int(x) for x in r[1:] if x not in ("", "-1", "0")]
    if ids:
        pages[(job, div)] = ids
def div_order(d):
    return (0, d, 0) if d < 1000 else (1, cat_index.get(div_cat.get(d, 0), 99), d)
divs = sorted({d for (_, d) in pages}, key=div_order)
log = {"divisions": [], "jobs": [[] for _ in range(8)]}
for i, d in enumerate(divs):
    nm = names.get(d, {})
    hidden = nm.get("en", "").startswith("[")  # internal "not searchable" pages (Cosmic Exploration recipes live here)
    log["divisions"].append({"id": d, "level": d < 1000, "hidden": hidden, "name": {} if hidden else {k: v for k, v in nm.items() if v},
                             "cat": {} if d < 1000 or hidden else cat_names.get(div_cat.get(d, 0), {})})
    for job in range(8):
        if (job, d) in pages:
            log["jobs"][job].append([i, pages[(job, d)]])

out = {"condFlags": flags, "cosmic": cosmic, "i18n": i18n, "log": log,
       "sources": {"datamining": "xivapi/ffxiv-datamining 44948e4c", "raphael": "KonaeAkira/raphael-rs 723b17e"}}
json.dump(out, open(os.path.join(root, "data", "atelier-data.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(sum(len(p) for j in log["jobs"] for _, p in j), "log entries in", len(divs), "divisions;", len(flags), "rlvls;", len(cosmic), "cosmic recipes;", len(i18n), "UI strings")
