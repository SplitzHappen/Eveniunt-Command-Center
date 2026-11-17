#!/usr/bin/env python3
"""Keep subagent launches inside the model tiers of `docs/model-tiers.md`.

PreToolUse (Agent or Task): allow only the four tier agents, refuse a per-call
`model` override (it would beat the model pinned in the agent file), refuse `name`, `team_name` and `effort` (routes to a teammate session or an effort change), refuse remote isolation
and oversized briefs, and repair stale agent files. SubagentStop: append one line to a local
ledger. `tier_guard.py --report` summarises the ledger. A strong check, not a proof.
"""

from __future__ import annotations

import json
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

ALLOWED = ("architect", "builder", "clerk", "reviewer")
MAX_BRIEF_CHARS = 6000
STANDARD = "docs/model-tiers.md"


def deny(reason: str) -> dict[str, Any]:
    return {"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny",
                                   "permissionDecisionReason": f"Model tiers ({STANDARD}): {reason}"}}


sys.path.insert(0, str(Path(__file__).resolve().parent))
try:
    import model_plan  # noqa: E402
except Exception as exc:  # noqa: BLE001 - fail closed when run as the hook
    if __name__ != "__main__":
        raise
    print(json.dumps(deny(f"the guard could not load ({type(exc).__name__}), so the launch is refused (fail closed).")))
    sys.exit(0)


def pre_tool_use(event: dict[str, Any]) -> dict[str, Any] | None:
    if event.get("tool_name") not in ("Agent", "Task"):
        return None
    args = event.get("tool_input")
    if not isinstance(args, dict):
        return deny("the launch has no readable arguments.")
    kind = args.get("subagent_type")
    if kind not in ALLOWED:
        return deny(f"subagent_type {kind!r} is not a tier agent. Use one of {', '.join(ALLOWED)}.")
    if args.get("model"):
        return deny("do not pass `model` on the call: it would override the model pinned in the agent file. Choose the agent instead.")
    for key in ("name", "team_name", "effort"):
        if args.get(key):
            return deny(f"do not pass `{key}`: a named call can start an agent-team teammate (a separate session) and an effort override changes cost. Neither is covered by the standing exception.")
    if args.get("isolation") == "remote":
        return deny("remote agents are not tier agents and cost more; none is allowed without the owner's request.")
    if len(str(args.get("prompt", ""))) > MAX_BRIEF_CHARS:
        return deny(f"the brief is over {MAX_BRIEF_CHARS} characters. Name files and paths instead of pasting contents, then retry.")
    root = model_plan.root_dir()
    plan = model_plan.active(root) or model_plan.resolve(root)[0]
    bad = model_plan.drift(root, plan)
    if bad:
        model_plan.sync(root, plan)
        return deny(f"agent files {bad} were out of date and have just been rewritten for the current plan. Retry the same call.")
    return None


def ledger_path() -> Path | None:
    out = subprocess.run(["git", "-C", str(model_plan.root_dir()), "rev-parse", "--git-dir"], capture_output=True, text=True, timeout=10)
    if out.returncode != 0:
        return None
    gd = Path(out.stdout.strip())
    return (gd if gd.is_absolute() else model_plan.root_dir() / gd) / "continuity-tier-ledger.jsonl"


def subagent_stop(event: dict[str, Any]) -> None:
    path = ledger_path()
    if path is None:
        return
    row = {"ts": int(time.time()), "session": event.get("session_id"), "plan": model_plan.active(model_plan.root_dir()),
           "agent": event.get("agent_type"), "id": event.get("agent_id"),
           "result_chars": len(str(event.get("last_assistant_message") or ""))}
    with path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(row) + "\n")


def report(session: str | None = None) -> str:
    path = ledger_path()
    if path is None or not path.exists():
        return "no delegations recorded"
    counts: dict[str, list[int]] = {}
    plans: set[str] = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            row = json.loads(line)
        except ValueError:
            continue
        if row.get("agent") not in ALLOWED or (session and row.get("session") != session):
            continue
        counts.setdefault(str(row["agent"]), []).append(int(row.get("result_chars") or 0))
        plans.add(str(row.get("plan")))
    if not counts:
        return "no delegations recorded" + (f" for session {session}" if session else "")
    head = f"observed delegations (not verified spend), plan {'/'.join(sorted(plans))}" + (f", session {session}" if session else ", all sessions in this checkout")
    return head + "\n" + "\n".join(f"{k}: {len(v)} delegations, {sum(v) // max(len(v), 1)} chars average result" for k, v in sorted(counts.items()))


def main(argv: list[str]) -> int:
    if argv[:1] == ["--report"]:
        print(report(argv[2] if argv[1:2] == ["--session"] and len(argv) > 2 else None))
        return 0
    try:
        event = json.loads(sys.stdin.read())
        if not isinstance(event, dict):
            raise ValueError("event is not an object")
    except ValueError:
        print(json.dumps(deny("the hook event could not be read, so the launch is refused (fail closed).")))
        return 0
    name = event.get("hook_event_name")
    if name not in ("PreToolUse", "SubagentStop"):
        print(json.dumps(deny("the hook event is missing or unknown, so the launch is refused (fail closed).")))
        return 0
    try:
        if name == "PreToolUse":
            out = pre_tool_use(event)
            if out:
                print(json.dumps(out))
        elif name == "SubagentStop":
            subagent_stop(event)
    except Exception as exc:  # noqa: BLE001 - a guard that crashes must refuse, not allow
        if name == "PreToolUse":
            print(json.dumps(deny(f"the guard failed ({type(exc).__name__}: {str(exc)[:200]}), so the launch is refused (fail closed).")))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
