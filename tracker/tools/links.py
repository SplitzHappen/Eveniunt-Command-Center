#!/usr/bin/env python3
"""Build data/links.json: what ticking one entry tells us about others, from the game's own tables.

    python3 -I tools/links.py <ffxiv-datamining checkout>      (after tools/extract.py and tools/add-checklist.py)

Every link is a fact the game data states (or, for ladders, the order the game enforces); nothing is guessed from
names alone except where noted. Rules (all per character, and they only ever ADD ticks):
  imp  [from, to, kind]            from is done  -> to is done
  all  [target, [members], kind]   every member done -> target done
  any  [target, [members], kind]   any member done -> target done
  ab   [[a...], [b...], kind]      any of a done -> all of b done
  cnt  [target, n, members, kind]  at least n members done -> target done (members: keys, or "s:<list id>")
  lvl  [target, need, [[levelKey, level], ...], kind]  at least `need` of the levels reached -> target done
Kinds: q earlier quest, qc:<cities>/qg:<company> the earlier quest for the character's own starting city (l, g, u) / Grand Company, c aether current, r reward, d duty, t title, a achievement, l rank or stage order,
h hunting log rank, s sightseeing, m master recipe book, f FATE, g FATE achievement that needs a gold rating
(applied only when the owner keeps "assume a gold rating" on).
"""
import collections, csv, json, os, re, sys

DM = sys.argv[1]
T = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA = json.load(open(os.path.join(T, "data", "tracker-data.json"), encoding="utf-8"))
OUT = os.path.join(T, "data", "links.json")

_cache = {}
def sheet(name):
    if name not in _cache:
        with open(os.path.join(DM, "csv", "en", name + ".csv"), encoding="utf-8-sig") as f:
            rows = list(csv.reader(f))
        _cache[name] = {int(r[0]): dict(zip(rows[0], r)) for r in rows[1:] if r and r[0].isdigit()}
    return _cache[name]
def i(v):
    try: return int(v)
    except (TypeError, ValueError): return 0
def clean(s): return " ".join((s or "").replace(" ", " ").split())
def norm(s): return re.sub(r"[^a-z0-9]+", " ", clean(s).lower().replace("’", "'").replace("'", "")).strip()

S = {s["id"]: s for s in DATA["sections"]}
KEYS = {}
for s in DATA["sections"]:
    for g in s["g"]:
        for e in g["e"]:
            KEYS[s["id"] + ":" + str(e["i"])] = (s, g, e)
def k(sid, eid): return sid + ":" + str(eid)
def entries(sid):
    for g in S[sid]["g"]:
        for e in g["e"]:
            yield g, e

imp, all_r, any_r, ab_r, cnt_r, lvl_r = [], [], [], [], [], []
fam = collections.Counter()
def add_imp(a, b, kind):
    if a and b and a != b and a in KEYS and b in KEYS:
        imp.append([a, b, kind]); fam[kind] += 1
def both(a, b, kind):
    add_imp(a, b, kind); add_imp(b, a, kind)

# ---------------------------------------------------------------- indexes
quest_key = {}
for sid in S:
    if sid.startswith("quests-"):
        for g, e in entries(sid):
            quest_key[e["i"]] = k(sid, e["i"])
            for a in e.get("al", []): quest_key[a] = k(sid, e["i"])
ach_key = {}
for sid in S:
    if sid.startswith("ach-"):
        for g, e in entries(sid): ach_key[e["i"]] = k(sid, e["i"])
COLLECTIONS = ["mounts", "minions", "orchestrion", "emotes", "hairstyles", "cards", "fashion", "facewear", "barding"]
item_key = {}
for sid in COLLECTIONS:
    for g, e in entries(sid):
        if e.get("it"): item_key.setdefault(e["it"], k(sid, e["i"]))
duty_key = {}
for sid in S:
    if sid.startswith("duty-"):
        for g, e in entries(sid): duty_key[e["i"]] = k(sid, e["i"])
Q = sheet("Quest")
A = {aid: r for aid, r in sheet("Achievement").items() if clean(r["Name"])}
CFC = sheet("ContentFinderCondition")
ic_to_duty = collections.defaultdict(list)
for cid, r in CFC.items():
    if i(r["ContentLinkType"]) == 1 and cid in duty_key: ic_to_duty[i(r["Content"])].append(duty_key[cid])
qname = {qid: clean(r["Name"]) for qid, r in Q.items() if clean(r["Name"])}
quest_by_name = collections.defaultdict(list)
for qid, n in qname.items():
    if qid in quest_key: quest_by_name[norm(n)].append(qid)

# ---------------------------------------------------------------- 1. quest prerequisites (q)
# PreviousQuestJoin 2 means "any one of"; those quests are skipped (no single quest is implied), unless only one
# previous quest is listed. Untracked quests in between are walked through, so the link lands on the nearest tracked
# quest(s); the tracker then follows those links further.
def prereqs(qid):
    r = Q.get(qid)
    if not r: return []
    ps = [i(r[f"PreviousQuest[{n}]"]) for n in range(3)]
    ps = [p for p in ps if p]
    if r.get("PreviousQuestJoin") == "2" and len(ps) > 1: return []
    return ps
def nearest_tracked(qid, seen):
    out = set()
    for p in prereqs(qid):
        if p in seen: continue
        seen.add(p)
        if p in quest_key: out.add(quest_key[p])
        else: out |= nearest_tracked(p, seen)
    return out
# which starting cities can reach each quest (from each city's first quest, following the game's prerequisites)
CITY_ROOTS = {"l": 65643, "g": 65575, "u": 66130}
succ = collections.defaultdict(list)
for qid_, r_ in Q.items():
    for n_ in range(3):
        p_ = i(r_[f"PreviousQuest[{n_}]"])
        if p_: succ[p_].append(qid_)
reach = collections.defaultdict(set)
for letter, root in CITY_ROOTS.items():
    stack, seen_ = [root], {root}
    while stack:
        x = stack.pop(); reach[x].add(letter)
        for y in succ.get(x, []):
            if y not in seen_: seen_.add(y); stack.append(y)
def choice_prereqs(qid):
    # "any one of" previous quests that are the same step for different starting cities or Grand Companies: the
    # character's own city or company decides which one was done (kinds qc and qg; the tracker applies them only
    # when that city or company is set for the character)
    r = Q.get(qid)
    if not r or r.get("PreviousQuestJoin") != "2": return None, []
    ps = [i(r[f"PreviousQuest[{n}]"]) for n in range(3)]
    ps = [p for p in ps if p]
    if len(ps) < 2: return None, []
    tracked = []
    for p in ps:
        hit = {quest_key[p]} if p in quest_key else nearest_tracked(p, {qid, p})
        tracked.append(hit)
    flat = [x for h in tracked for x in h]
    # starting cities: each option is reached from its own cities, and no city reaches two options
    sets = [reach.get(p, set()) for p in ps]
    if all(sets) and all(len(x) < 3 for x in sets) and sum(len(x) for x in sets) == len(set().union(*sets)):
        return "city", [(h, "qc:" + "".join(sorted(sx))) for h, sx in zip(tracked, sets)]
    tags = [KEYS[x][2].get("gc") for x in flat]
    if flat and all(tags) and len(set(tags)) == len(ps) and all(len(h) == 1 for h in tracked):
        return "gc", [({x}, "qg:" + str(KEYS[x][2]["gc"])) for x in flat]
    return None, []
for qid, key in list(quest_key.items()):
    if KEYS[key][2]["i"] != qid: continue  # aliases share the kept entry
    me = KEYS[key][2]
    kind_, opts_ = choice_prereqs(qid)
    for targets_, code_ in opts_:
        # a quest of one company (or city) only ever follows its own company's option: the others never apply
        if me.get("gc") and code_.startswith("qg:") and code_ != "qg:" + str(me["gc"]): continue
        if me.get("city") and code_.startswith("qc:") and {"lim": "l", "gri": "g", "uld": "u"}[me["city"]] not in code_[3:]: continue
        for t_ in targets_: add_imp(key, t_, code_)
    for pk in nearest_tracked(qid, {qid}):
        pe = KEYS[pk][2]
        if me.get("city") and pe.get("city") and me["city"] != pe["city"]: continue
        if me.get("gc") and pe.get("gc") and me["gc"] != pe["gc"]: continue
        add_imp(key, pk, "q")

# ---------------------------------------------------------------- 2. aether currents from quests (c), Freebird (a)
cur = sheet("AetherCurrent")
for cid, r in cur.items():
    if i(r["Quest"]) in quest_key and k("aethercurrents", cid) in KEYS:
        both(quest_key[i(r["Quest"])], k("aethercurrents", cid), "c")
flg = sheet("AetherCurrentCompFlgSet")

# ---------------------------------------------------------------- 3. quest rewards (r), required and unlocked duties (d)
def single_source(key, kind_label, name):
    src = KEYS[key][2].get("src") or []
    return len(src) == 1 and norm(src[0]) == norm(kind_label + ": " + name)
emote_key = {e["i"]: k("emotes", e["i"]) for g, e in entries("emotes")}
for qid, r in Q.items():
    if qid not in quest_key or KEYS[quest_key[qid]][2]["i"] != qid: continue
    qk = quest_key[qid]
    rewards = []
    if r.get("ItemRewardType") == "1":
        rewards += [item_key.get(i(r[f"Reward[{n}]"])) for n in range(7)]
    rewards.append(emote_key.get(i(r.get("EmoteReward"))))
    for ck in filter(None, rewards):
        add_imp(qk, ck, "r")
        if single_source(ck, "Quest", qname[qid]): add_imp(ck, qk, "r")
    ics = [i(r[f"InstanceContent[{n}]"]) for n in range(3)]
    ics = [x for x in ics if x]
    if ics and (r.get("InstanceContentJoin") == "1" or len(ics) == 1):
        for ic in ics:
            for dk in ic_to_duty.get(ic, []): add_imp(qk, dk, "d")
    for dk in ic_to_duty.get(i(r.get("InstanceContentUnlock")), []): add_imp(dk, qk, "d")

# ---------------------------------------------------------------- 4. achievements
title_count = collections.Counter(i(r["Title"]) for r in A.values() if i(r["Title"]))
title_key = {e["i"]: k("titles", e["i"]) for g, e in entries("titles")}
LEVELS = {}  # ClassJob id -> level entry key (a class and its job share one entry)
cj = sheet("ClassJob")
lvl_entries = [(e, k("levels", e["i"])) for g, e in entries("levels") if e.get("max")]
for cid, r in cj.items():
    nm = norm(r["Name"])
    if not nm: continue
    for e, key in lvl_entries:
        parts = [norm(p) for p in re.sub(r"\(.*?\)", "", e["n"]).split("/")]
        if nm in parts: LEVELS[cid] = key
cjc = sheet("ClassJobCategory")
abbr = {r["Abbreviation"]: cid for cid, r in cj.items() if r.get("Abbreviation")}
hunt_groups = collections.defaultdict(list)
for g, e in entries("hunting"): hunt_groups[norm(g.get("c"))].append(k("hunting", e["i"]))
tribes = sheet("BeastTribe"); rep = sheet("BeastReputationRank")
soc_groups = {}
for g in S["societyranks"]["g"]:
    soc_groups[norm(g["t"])] = g
def tribe_group(tid):
    n = norm(tribes.get(tid, {}).get("Name"))
    for gn, g in soc_groups.items():
        if gn == n or gn.rstrip("s") == n.rstrip("s") or gn.startswith(n) or n.startswith(gn): return g
    return None
rank_index = {}
for rid, r in rep.items():
    for nm in (r["Name"], r["AlliedNames"]):
        if clean(nm): rank_index.setdefault(norm(nm), rid)
fate_by_name = collections.defaultdict(list)
for g, e in entries("fates"): fate_by_name[norm(e["n"])].append(k("fates", e["i"]))
minion_by_name = {norm(e["n"]): k("minions", e["i"]) for g, e in entries("minions")}
cards_by_no = {e["no"]: k("cards", e["i"]) for g, e in entries("cards") if e.get("no")}
sight = collections.defaultdict(dict)  # expansion -> entry number within that expansion's log -> key
for g in S["sightseeing"]["g"]:
    for pos, e in enumerate(sorted(g["e"], key=lambda e: e.get("no") or 0), 1): sight[norm(g["t"])][pos] = k("sightseeing", e["i"])
relic_job = collections.defaultdict(list)  # (list, series, job) -> stages in order (weapons and tools)
for rsid in ("relicweapons", "relictools"):
    for g, e in entries(rsid): relic_job[(rsid, g["t"], e.get("d", "").split(" · ")[0].lower())].append(e)
relic_pending = []  # type-24 achievements not matched by name: (achievement key, quest key, job)
relic_stage = collections.defaultdict(collections.Counter)  # quest key -> (series, stage position) votes
unmatched = collections.Counter()

for aid, r in A.items():
    ak = ach_key.get(aid)
    if not ak: continue
    t, key, data = i(r["Type"]), i(r["Key"]), [i(r[f"Data[{n}]"]) for n in range(8)]
    desc = clean(r["Description"])
    # title and reward item
    tid = i(r["Title"])
    if tid in title_key:
        if title_count[tid] == 1: both(ak, title_key[tid], "t")
        else: add_imp(ak, title_key[tid], "t")
    ik = item_key.get(i(r["Item"]))
    if ik:
        add_imp(ak, ik, "r")
        if single_source(ik, "Achievement", r["Name"]): add_imp(ik, ak, "r")
    if t == 2:  # obtain these achievements
        subs = [ach_key.get(x) for x in [key] + data if x]
        if subs and all(subs):
            all_r.append([ak, subs, "a"]); fam["a"] += 1
            for s_ in subs: add_imp(ak, s_, "a")
        else: unmatched["achievement of achievements"] += 1
    elif t == 6:
        if key in quest_key: both(ak, quest_key[key], "a")
        else: unmatched["quest achievement (quest not listed)"] += 1
    elif t == 9:
        qs = [quest_key.get(x) for x in [key] + data if x]
        qs = [x for x in qs if x]
        if qs: any_r.append([ak, sorted(set(qs)), "a"]); fam["a"] += 1
    elif t == 3:
        if key in LEVELS: lvl_r.append([ak, 1, [[LEVELS[key], data[0]]], "a"]); fam["a"] += 1
        else: unmatched["level achievement (class not listed)"] += 1
    elif t == 26:
        m = re.search(r"level (\d+)", desc)
        cat = cjc.get(key, {})
        jobs = sorted({LEVELS[abbr[a]] for a, v in cat.items() if v == "True" and a in abbr and abbr[a] in LEVELS})
        if m and jobs and data[0]:
            lvl_r.append([ak, min(data[0], len(jobs)), [[j, int(m.group(1))] for j in jobs], "a"]); fam["a"] += 1
        else: unmatched["mastery achievement"] += 1
    elif t == 7:
        m = re.search(r"Complete all (.+?) entries in the hunting log", desc)
        members = hunt_groups.get(norm(m.group(1))) if m else None
        if members:
            all_r.append([ak, members, "a"]); fam["a"] += 1
            ab_r.append([[ak], members, "a"])
        else: unmatched["hunting log achievement"] += 1
    elif t == 10:
        hit = next((k("companionrank", e["i"]) for g, e in entries("companionrank") if e["n"] == str(key)), None)
        if hit: both(ak, hit, "a")
    elif t == 14:
        ds = ic_to_duty.get(key, [])
        if len(ds) == 1: both(ak, ds[0], "a")
        else: unmatched["duty achievement"] += 1
    elif t == 15:
        g = tribe_group(key)
        rn = rep.get(data[0], {})
        hit = None
        if g:
            for e in g["e"]:
                if norm(e["n"]) in (norm(rn.get("Name")), norm(rn.get("AlliedNames"))): hit = k("societyranks", e["i"])
        if hit: both(ak, hit, "a")
        else: unmatched["allied society rank achievement"] += 1
    elif t == 20:
        f = flg.get(key)
        cs = [k("aethercurrents", i(f[f"AetherCurrents[{n}]"])) for n in range(15) if f and i(f[f"AetherCurrents[{n}]"])]
        if cs and all(c in KEYS for c in cs):
            all_r.append([ak, cs, "a"]); fam["a"] += 1
            ab_r.append([[ak], cs, "a"])
        else: unmatched["Freebird achievement"] += 1
    elif t == 21 and key == 0:
        cnt_r.append([ak, data[0], "s:minions", "a"]); fam["a"] += 1
    elif t == 29:
        cs = [cards_by_no.get(n) for n in range(1, data[0] + 1)]
        if all(cs):
            all_r.append([ak, cs, "a"]); fam["a"] += 1
            ab_r.append([[ak], cs, "a"])
    elif t == 24:
        # "Obtain <weapon>": matched by the weapon's name where the wording allows; the achievement's quest names
        # the stage, so the stage found for one job is used for the other jobs with the same quest (below)
        # the job is the data value that names a class or job (newer achievements put another quest first)
        job = next((clean(cj[x]["Name"]).lower() for x in data if 0 < x < 100 and x in cj and clean(cj[x]["Name"])), "")
        best, where = None, None
        for (rsid, grp, jb), es in relic_job.items():
            if jb != job: continue
            for pos, e in enumerate(es):
                names = [norm(x.replace("*", "")) for x in e["n"].split("&")]
                if all(re.search(r"\b" + re.escape(n) + r"\b", norm(desc.replace("*", ""))) for n in names):
                    if not best or len(e["n"]) > len(best["n"]): best, where = e, (rsid, grp, pos)
        if best:
            both(ak, k(where[0], best["i"]), "a")
            relic_stage[key][where] += 1
        else: relic_pending.append((ak, key, job))
    elif t == 1:
        fates = re.findall(r"“([^”]+?)[,]?”", desc) if "FATE" in desc else []
        if fates and "highest rating" in desc:
            hits = [fate_by_name.get(norm(x)) for x in fates]
            if all(hits):
                flat = sorted({h for x in hits for h in x})
                if len(flat) == 1:  # one FATE: the achievement proves it; the FATE gives it with a gold rating
                    add_imp(ak, flat[0], "f")
                    imp.append([flat[0], ak, "g"]); fam["g"] += 1
                else:  # "either FATE", or a name the game uses for several FATE versions: any of them gives it
                    any_r.append([ak, flat, "g"]); fam["g"] += 1
            else: unmatched["FATE achievement (FATE not found)"] += 1
            continue
        m = re.match(r"^Successfully complete (\d+) FATEs\.$", desc)
        if m: cnt_r.append([ak, int(m.group(1)), "s:fates", "a"]); fam["a"] += 1; continue
        m = re.match(r"^Add (\d+) unique music rolls to your orchestrion\.$", desc)
        if m: cnt_r.append([ak, int(m.group(1)), "s:orchestrion", "a"]); fam["a"] += 1; continue
        m = re.match(r"^Obtain (\d+|a) Triple Triad cards?\.$", desc)
        if m: cnt_r.append([ak, 1 if m.group(1) == "a" else int(m.group(1)), "s:cards", "a"]); fam["a"] += 1; continue
        m = re.match(r"^Complete entries (\d+)-(\d+) in your (?:(.+?) )?sightseeing log\.$", desc)
        if m:
            ex = norm(m.group(3) or "A Realm Reborn")
            cs = [sight.get(ex, {}).get(n) for n in range(int(m.group(1)), int(m.group(2)) + 1)]
            if cs and all(cs):
                all_r.append([ak, cs, "s"]); fam["s"] += 1
                ab_r.append([[ak], cs, "s"])
            else: unmatched["sightseeing achievement"] += 1
            continue
        m = re.match(r"^Achieve shared FATE rank 3 in (.+)\.$", desc)
        if m:
            hit = next((k("sharedfate", e["i"]) for g, e in entries("sharedfate") if e.get("d") == "3" and norm(e["n"]).endswith(" in " + norm(m.group(1)))), None)
            if hit: both(ak, hit, "a")
            continue
        m = re.match(r"^Obtain (?:a|an) (.+?) minion\.$", desc)
        if m and norm(m.group(1)) in minion_by_name: both(ak, minion_by_name[norm(m.group(1))], "a"); continue
    elif t == 0:
        m = re.match(r"^Defeat the notorious monsters? (.+)\.$", desc)
        if m:
            unmatched["notorious-monster achievement (no FATE link in the data)"] += 1

for ak, qk, job in relic_pending:
    votes = relic_stage.get(qk)
    if votes:
        (rsid, grp, pos), n = votes.most_common(1)[0]
        es = relic_job.get((rsid, grp, job), [])
        if n >= 2 and pos < len(es): both(ak, k(rsid, es[pos]["i"]), "a"); continue
    unmatched["relic weapon achievement"] += 1

# achievement tiers: the same counter at a higher threshold proves the lower ones ("Defeat 500 enemies" proves
# "Defeat 100 enemies"); per type, which field names the counter and which holds the threshold
TIER = {1: ("Key", 0), 3: ("Key", 0), 11: ("Key", 0), 15: ("Key", 0), 18: ("Key", 0), 21: ("Key", 0), 32: ("Key", 0),
        10: (None, "Key"), 12: (None, "Key"), 13: (None, "Key"), 17: (None, "Key"), 19: (None, "Key")}
tiers = collections.defaultdict(lambda: collections.defaultdict(list))
for aid, r in A.items():
    t = i(r["Type"])
    if t not in TIER or aid not in ach_key: continue
    gf, tf = TIER[t]
    grp = (t, i(r["Key"]) if gf == "Key" else 0)
    thr = i(r["Key"]) if tf == "Key" else i(r[f"Data[{tf}]"])
    if thr > 0: tiers[grp][thr].append(ach_key[aid])
for grp, levels in tiers.items():
    ths = sorted(levels)
    for hi, lo in zip(ths[1:], ths[:-1]):
        for a_ in levels[hi]:
            for b_ in levels[lo]:
                # a Legacy (version 1.0) achievement shares its counter with today's, but nobody can earn it now
                if b_.startswith("ach-legacy:") or a_.startswith("ach-legacy:"): unmatched["tier link into Legacy achievements (skipped)"] += 1; continue
                add_imp(a_, b_, "a")
# emotes unlocked by the same item come together
by_item = collections.defaultdict(list)
for g, e in entries("emotes"):
    if e.get("it"): by_item[e["it"]].append(k("emotes", e["i"]))
for it_, ks_ in by_item.items():
    for a_ in ks_:
        for b_ in ks_: add_imp(a_, b_, "r")

# ---------------------------------------------------------------- 5. ladders (l), hunting log ranks (h)
def ladder(keys, kind="l"):
    for hi, lo in zip(keys[1:], keys[:-1]): add_imp(hi, lo, kind)
for g in S["gcranks"]["g"]: ladder([k("gcranks", e["i"]) for e in g["e"]])
for g in S["societyranks"]["g"]:
    # by the game's rank number; names that share a rank (Allied and Bloodsworn are one rank) are not linked to
    # each other, only to the rank below
    byrank = collections.defaultdict(list)
    for e in g["e"]: byrank[rank_index.get(norm(e["n"]))].append(k("societyranks", e["i"]))
    if None in byrank: unmatched["allied society rank name not in the game's rank list"] += 1; continue
    rs = sorted(byrank)
    for hi, lo in zip(rs[1:], rs[:-1]):
        for a_ in byrank[hi]:
            for b_ in byrank[lo]: add_imp(a_, b_, "l")
for sid in ["companionrank", "eurekalevel", "bozjarank", "oclevel", "islerank"]:
    es = sorted((e for g, e in entries(sid)), key=lambda e: i(e["n"]))
    ladder([k(sid, e["i"]) for e in es])
for g in S["companionskills"]["g"]: ladder([k("companionskills", e["i"]) for e in g["e"]])
zones = collections.defaultdict(list)
for g, e in entries("sharedfate"):
    m = re.search(r" in (.+)$", e["n"])
    if m: zones[norm(m.group(1))].append((i(e.get("d")), e))
for z, es in zones.items(): ladder([k("sharedfate", e["i"]) for r_, e in sorted(es, key=lambda t: t[0])])
speed = collections.defaultdict(dict)
for g, e in entries("mountspeed"):
    m = re.match(r"^(.+): (1st|2nd) increase$", e["n"])
    if m: speed[m.group(1)][m.group(2)] = k("mountspeed", e["i"])
for z, d in speed.items():
    if "1st" in d and "2nd" in d: add_imp(d["2nd"], d["1st"], "l")
# relic stages: in each series, a job's stages in the workbook's order must also rise (or hold) in item level; a later
# stage needs the earlier one (for Dawntrail, Console Games Wiki "Phantom Weapons": each upgrade needs the previous
# stage, Penumbrae to Occultum; "Cosmic Tools": a 19-step upgrade of the same tool)
for sid in ["relicweapons", "relictools"]:
    for g in S[sid]["g"]:
        byjob = collections.OrderedDict()
        for e in g["e"]:
            parts = e.get("d", "").split(" · ")
            if len(parts) >= 2 and parts[1].isdigit(): byjob.setdefault(parts[0], []).append((int(parts[1]), e))
        for job, es in byjob.items():
            lv = [x for x, e in es]
            if lv == sorted(lv) and len(es) > 1: ladder([k(sid, e["i"]) for x, e in es])
            else: unmatched["relic stages not in rising item level (" + sid + ")"] += 1
# hunting log: rank N opens only after rank N-1 is complete
hl = collections.defaultdict(dict)
for g in S["hunting"]["g"]:
    m = re.search(r"Rank (\d+)$", g["t"])
    if m: hl[g.get("c")][int(m.group(1))] = [k("hunting", e["i"]) for e in g["e"]]
for who, ranks in hl.items():
    for n in sorted(ranks):
        if n - 1 in ranks: ab_r.append([ranks[n], ranks[n - 1], "h"]); fam["h"] += 1
# shared FATE ranks: "Complete N FATEs in <zone>" is reached once N different FATEs of that zone are ticked
fates_zone = collections.defaultdict(list)
for g, e in entries("fates"): fates_zone[norm(g["t"])].append(k("fates", e["i"]))
for g, e in entries("sharedfate"):
    m = re.match(r"^Complete (\d+) FATEs? in (.+)$", e["n"])
    if m and fates_zone.get(norm(m.group(2))):
        cnt_r.append([k("sharedfate", e["i"]), int(m.group(1)), fates_zone[norm(m.group(2))], "f"]); fam["f"] += 1

# mount speed: the first increase in a zone that the workbook gives as a quest comes from that quest (and only it)
def one_quest(name):
    # the tracked quest with that name; when several share it (a quest remade in 6.1), the main-story one
    qs = quest_by_name.get(norm(name), [])
    if len(qs) > 1: qs = [q for q in qs if quest_key[q].startswith("quests-mainscenario")]
    return qs
for g, e in entries("mountspeed"):
    qs = one_quest(re.sub(r"\s*\(Quest\)$", "", e.get("d", "")))
    if e["n"].endswith("1st increase") and qs and len(qs) == 1: both(k("mountspeed", e["i"]), quest_key[qs[0]], "r")
# Grand Company: the first rank comes with the company's officer quest; promotions that need a hunting log rank
officer = {1: "Till Sea Swallows All", 2: "Wood's Will Be Done", 3: "For Coin and Country"}
gc_of_group = {"maelstrom": 1, "order of the twin adder": 2, "immortal flames": 3}
for g in S["gcranks"]["g"]:
    gc_ = gc_of_group.get(norm(g["t"]))
    if not gc_ or not g["e"]: continue
    qs = one_quest(officer[gc_])
    if len(qs) == 1: both(k("gcranks", g["e"][0]["i"]), quest_key[qs[0]], "q")
    for e in g["e"]:
        m = re.search(r"Hunting Log: (.+?) Rank (\d+)", e.get("d", ""))
        if m and int(m.group(2)) in hl.get(next((c for c in hl if norm(c) == norm(m.group(1))), None), {}):
            who = next(c for c in hl if norm(c) == norm(m.group(1)))
            ab_r.append([[k("gcranks", e["i"])], hl[who][int(m.group(2))], "h"]); fam["h"] += 1

# ---------------------------------------------------------------- 6. master recipe books (m)
books = {norm(e["n"]): k("masterbooks", e["i"]) for g, e in entries("masterbooks")}
srb = sheet("SecretRecipeBook")
rec = sheet("Recipe")
for sid in S:
    if not sid.startswith("craft-"): continue
    for g, e in entries(sid):
        b = srb.get(i(rec.get(e["i"], {}).get("SecretRecipeBook")))
        if b and norm(b["Name"]) in books: add_imp(k(sid, e["i"]), books[norm(b["Name"])], "m")

# ---------------------------------------------------------------- output
seen = set(); imp2 = []
for a, b, kind in imp:
    if (a, b) not in seen: seen.add((a, b)); imp2.append([a, b, kind])
ORDER = {}
for s_ in DATA["sections"]:
    for g in s_["g"]:
        for e in g["e"]: ORDER[s_["id"] + ":" + str(e["i"])] = len(ORDER)
n_ = lambda key: ORDER[key]
ns = lambda keys: keys if isinstance(keys, str) else [n_(x) for x in keys]
def keys_hash(keys):
    # FNV-1a (32 bit) over the key list, the same as ET.keysHash in src/core/links.js: the tracker refuses a links
    # file whose hash does not match its data (an entry added, removed or moved since the links were built)
    h = 0x811C9DC5
    for key in keys:
        for ch in key.encode("utf-8"):
            h = ((h ^ ch) * 0x01000193) & 0xFFFFFFFF
        h = ((h ^ 10) * 0x01000193) & 0xFFFFFFFF
    return "%08x" % h
out = {"v": 1, "entries": len(ORDER), "keys_hash": keys_hash(list(ORDER)),
       "imp": [[n_(a), n_(b), kind] for a, b, kind in imp2],
       "all": [[n_(t_), ns(m_), kind] for t_, m_, kind in all_r],
       "any": [[n_(t_), ns(m_), kind] for t_, m_, kind in any_r],
       "ab": [[ns(a), ns(b), kind] for a, b, kind in ab_r],
       "cnt": [[n_(t_), n, ns(m_), kind] for t_, n, m_, kind in cnt_r],
       "lvl": [[n_(t_), need, [[n_(lk), lv] for lk, lv in ls], kind] for t_, need, ls, kind in lvl_r]}
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
kinds = collections.Counter(x[2] for x in imp2)
print(json.dumps({"links": {kk: len(v) for kk, v in out.items() if isinstance(v, list)}, "implications_by_kind": dict(kinds), "rules_by_kind": dict(fam),
                  "not_linked": dict(unmatched), "bytes": os.path.getsize(OUT)}, indent=1))
