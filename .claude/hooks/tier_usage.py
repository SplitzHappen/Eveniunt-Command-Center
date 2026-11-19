#!/usr/bin/env python3
"""Report which model and effort really served each tier agent and the orchestrator, and the tokens used.

Command line only: `tier_usage.py [--session <id>]`. Reads Claude Code's own transcripts (tokens, not money).
Exit code 0 with no problems, 1 when a tier agent was served by a model or effort other than the one pinned in its file.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
import model_plan  # noqa: E402

FAMILIES = ("fable", "opus", "sonnet", "haiku")
TOKEN_KEYS = ("input", "output", "cache_read", "cache_write")
USAGE_KEYS = {"input": "input_tokens", "output": "output_tokens",
              "cache_read": "cache_read_input_tokens", "cache_write": "cache_creation_input_tokens"}


def family(model: str) -> str:
    low = model.lower()
    for fam in FAMILIES:
        if fam in low:
            return fam
    return model


def _empty() -> dict[str, Any]:
    return {"models": {}, "efforts": {}, "tokens": dict.fromkeys(TOKEN_KEYS, 0)}


def _add(into: dict[str, int], other: dict[str, int]) -> None:
    for key, val in other.items():
        into[key] = into.get(key, 0) + val


def _num(value: Any) -> int:
    return value if isinstance(value, int) and not isinstance(value, bool) else 0


def read_transcript(path: Path) -> dict[str, Any]:
    """Models, efforts and tokens of one transcript, each message id counted once."""
    out = _empty()
    seen: set[str] = set()
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return out
    for line in lines:
        try:
            row = json.loads(line)
        except ValueError:
            continue
        if not isinstance(row, dict) or row.get("type") != "assistant":
            continue
        msg = row.get("message")
        if not isinstance(msg, dict):
            continue
        model = msg.get("model")
        if not model or not isinstance(model, str) or model == "<synthetic>":
            continue
        key = msg.get("id") or row.get("uuid")
        if key:
            if key in seen:
                continue
            seen.add(str(key))
        fam = family(model)
        out["models"][fam] = out["models"].get(fam, 0) + 1
        effort = str(row.get("effort") or "unset")
        out["efforts"][effort] = out["efforts"].get(effort, 0) + 1
        usage = msg.get("usage") if isinstance(msg.get("usage"), dict) else {}
        for name, field in USAGE_KEYS.items():
            out["tokens"][name] += _num(usage.get(field))
    return out


def pinned(root: Path, plan: str, agent: str) -> tuple[str | None, str | None]:
    """(model, effort) pinned in the frontmatter of the plan's agent file."""
    try:
        lines = (root / ".claude" / "agent-sets" / plan / f"{agent}.md").read_text(encoding="utf-8").splitlines()
    except OSError:
        return None, None
    values: dict[str, str] = {}
    marks = 0
    for line in lines:
        if line.strip() == "---":
            marks += 1
            if marks == 2:
                break
            continue
        if marks == 1:
            name, _, val = line.partition(":")
            if name.strip() in ("model", "effort") and val.strip():
                values[name.strip()] = val.strip()
    return values.get("model"), values.get("effort")


def _meta(path: Path) -> dict[str, Any]:
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return doc if isinstance(doc, dict) else {}


def collect(project: Path, root: Path, plan: str, session: str | None = None) -> dict[str, Any]:
    orchestrator = _empty()
    tiers: dict[str, dict[str, Any]] = {a: {"runs": 0, "models": {}, "efforts": {}, "tokens": dict.fromkeys(TOKEN_KEYS, 0)}
                                        for a in model_plan.AGENTS}
    other: dict[str, Any] = {"runs": 0, "tokens": dict.fromkeys(TOKEN_KEYS, 0)}
    problems: list[str] = []
    ids: set[str] = set()
    if project.is_dir():
        for entry in project.iterdir():
            if entry.suffix == ".jsonl" and entry.is_file():
                ids.add(entry.stem)
            elif entry.is_dir():
                ids.add(entry.name)
    if session:
        ids &= {session}
    for sid in sorted(ids):
        main_file = project / f"{sid}.jsonl"
        if main_file.is_file():
            res = read_transcript(main_file)
            _add(orchestrator["models"], res["models"])
            _add(orchestrator["efforts"], res["efforts"])
            _add(orchestrator["tokens"], res["tokens"])
        subdir = project / sid / "subagents"
        if not subdir.is_dir():
            continue
        for sub in sorted(subdir.glob("agent-*.jsonl")):
            agent_id = sub.stem[len("agent-"):]
            res = read_transcript(sub)
            agent = _meta(sub.with_suffix(".meta.json")).get("agentType")
            if agent not in model_plan.AGENTS:
                other["runs"] += 1
                _add(other["tokens"], res["tokens"])
                continue
            row = tiers[agent]
            row["runs"] += 1
            _add(row["models"], res["models"])
            _add(row["efforts"], res["efforts"])
            _add(row["tokens"], res["tokens"])
            want_model, want_effort = pinned(root, plan, agent)
            if want_model and any(m != family(want_model) for m in res["models"]):
                problems.append(f"{agent} {agent_id}: served by {'/'.join(sorted(res['models']))}, pinned {want_model}")
            if want_effort and any(e not in ("unset", want_effort) for e in res["efforts"]):
                got = "/".join(sorted(e for e in res["efforts"] if e != "unset"))
                problems.append(f"{agent} {agent_id}: effort {got}, pinned {want_effort}")
    return {"orchestrator": orchestrator, "tiers": tiers, "other": other, "problems": problems}


def _line(name: str, runs: int | None, models: dict[str, int] | None, efforts: dict[str, int] | None, tok: dict[str, int]) -> str:
    parts = [f"{name}:"]
    head = []
    if runs is not None:
        head.append(f"{runs} runs")
    if models is not None and efforts is not None:
        head.append(f"model {'/'.join(sorted(models))}")
        head.append(f"effort {'/'.join(sorted(efforts))}")
    head.append(f"in {tok['input']}")
    head.append(f"out {tok['output']}")
    head.append(f"cache read {tok['cache_read']}")
    head.append(f"cache write {tok['cache_write']}")
    return " ".join(parts) + " " + ", ".join(head)


def render(data: dict[str, Any], plan: str, project: Path | None = None) -> str:
    orch = data["orchestrator"]
    lines = [f"measured from transcripts (tokens, not money), plan {plan}"]
    found = False
    if sum(orch["models"].values()):
        found = True
        lines.append(_line("orchestrator", None, orch["models"], orch["efforts"], orch["tokens"]))
    for agent in model_plan.AGENTS:
        row = data["tiers"][agent]
        if row["runs"]:
            found = True
            lines.append(_line(agent, row["runs"], row["models"], row["efforts"], row["tokens"]))
    if data["other"]["runs"]:
        found = True
        lines.append(_line("other", data["other"]["runs"], None, None, data["other"]["tokens"]))
    if not found:
        return "no transcripts found" + (f" in {project}" if project else "")
    if data["problems"]:
        lines.append("problems:")
        lines.extend(data["problems"])
    else:
        lines.append("problems: none")
    return "\n".join(lines)


def project_dir(root: Path) -> Path:
    config = Path(os.environ.get("CLAUDE_CONFIG_DIR") or Path.home() / ".claude").expanduser()
    return config / "projects" / re.sub(r"[^A-Za-z0-9]", "-", str(root))


def main(argv: list[str]) -> int:
    root = model_plan.root_dir()
    plan = model_plan.active(root) or model_plan.resolve(root)[0]
    if argv and not (len(argv) == 2 and argv[0] == "--session"):
        print("usage: tier_usage.py [--session <id>]", file=sys.stderr)
        return 2
    session = argv[1] if argv else None
    project = project_dir(root)
    data = collect(project, root, plan, session)
    print(render(data, plan, project))
    return 1 if data["problems"] else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
