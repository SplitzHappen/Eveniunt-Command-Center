#!/usr/bin/env python3
"""Choose the model plan (max or pro) and make `.claude/agents/` match it.

SessionStart hook, and a command line: `model_plan.py --show | --apply [--plan max|pro] | --check`.
Plan: `.claude/model-plan.json` is the owner's entitlement (max = Fable available, pro = not); a missing or invalid
file means pro. CONTINUITY_MODEL_PLAN overrides it either way. The session model may only lower the plan
(Sonnet or Haiku means pro), never raise it. `.claude/agents/*.md` is a generated, untracked copy of
`.claude/agent-sets/<plan>/`; edit the sets, never the copy.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Any

PLANS = ("max", "pro")
AGENTS = ("architect", "builder", "clerk", "reviewer")


def root_dir() -> Path:
    return Path(os.environ.get("CLAUDE_PROJECT_DIR") or Path(__file__).resolve().parents[2])


def file_plan(root: Path) -> str:
    try:
        doc = json.loads((root / ".claude" / "model-plan.json").read_text(encoding="utf-8"))
        plan = doc.get("plan") if isinstance(doc, dict) else None
    except (OSError, ValueError):
        plan = None
    return plan if plan in PLANS else "pro"


def active(root: Path) -> str | None:
    """The plan the hook last applied in this checkout (`.claude/agents/.plan`), if any."""
    try:
        plan = (root / ".claude" / "agents" / ".plan").read_text(encoding="utf-8").strip()
    except OSError:
        return None
    return plan if plan in PLANS else None


def resolve(root: Path, model: str | None = None, source: str = "startup") -> tuple[str, str]:
    """(plan, reason). The model may only lower the plan; a resumed session without a model keeps the plan already applied."""
    env = (os.environ.get("CONTINUITY_MODEL_PLAN") or "").strip().lower()
    if env in PLANS:
        return env, f"CONTINUITY_MODEL_PLAN={env}"
    ceiling = file_plan(root)
    if ceiling == "pro":
        return "pro", ".claude/model-plan.json (pro, or missing or invalid)"
    if any(k in (model or "").lower() for k in ("sonnet", "haiku")):
        return "pro", f"session model {model} lowers the plan"
    kept = active(root) if source != "startup" and not model else None
    if kept:
        return kept, "plan already applied in this checkout"
    return "max", ".claude/model-plan.json (max)"


def _write(path: Path, data: bytes) -> None:
    fd, name = tempfile.mkstemp(dir=path.parent, prefix=".tmp-", suffix=".tmp")
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(data)
        os.replace(name, path)
    except BaseException:
        try:
            os.unlink(name)
        except OSError:
            pass
        raise


def sync(root: Path, plan: str) -> list[str]:
    """Make `.claude/agents/<name>.md` equal the plan's set. Returns the names rewritten."""
    src, dst = root / ".claude" / "agent-sets" / plan, root / ".claude" / "agents"
    dst.mkdir(parents=True, exist_ok=True)
    _write(dst / ".plan", (plan + "\n").encode())
    changed: list[str] = []
    for name in AGENTS:
        want = (src / f"{name}.md").read_bytes()
        target = dst / f"{name}.md"
        if not target.exists() or target.read_bytes() != want:
            _write(target, want)
            changed.append(name)
    return changed


def drift(root: Path, plan: str) -> list[str]:
    src, dst = root / ".claude" / "agent-sets" / plan, root / ".claude" / "agents"
    return [n for n in AGENTS if not (dst / f"{n}.md").exists() or (dst / f"{n}.md").read_bytes() != (src / f"{n}.md").read_bytes()]


def session_start(event: dict[str, Any]) -> dict[str, Any]:
    root = root_dir()
    plan, reason = resolve(root, event.get("model"), str(event.get("source") or "startup"))
    try:
        changed = sync(root, plan)
    except OSError as exc:
        return {"systemMessage": f"Model plan {plan} chosen ({reason}) but .claude/agents could not be updated: {exc}"}
    orch = "Opus" if plan == "max" else "Sonnet"
    arch = "Fable" if plan == "max" else "Opus"
    note = f"Continuity model plan: {plan} ({reason}). Orchestrator {orch}; architect {arch}; builder Sonnet; clerk Haiku; reviewer Opus. Routing: docs/model-tiers.md."
    if changed:
        note += f" Agent files switched: {', '.join(changed)}."
    return {"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": note}}


def main(argv: list[str]) -> int:
    root = root_dir()
    if argv[:1] in (["--show"], ["--apply"], ["--check"]):
        plan = argv[argv.index("--plan") + 1] if "--plan" in argv else (active(root) or resolve(root)[0])
        if plan not in PLANS:
            print(f"plan must be one of {PLANS}", file=sys.stderr)
            return 2
        if argv[0] == "--apply":
            print(f"{plan}: rewrote {sync(root, plan) or 'nothing'}")
        elif argv[0] == "--check":
            bad = drift(root, plan)
            print(f"{plan}: " + (f"drift in {bad}" if bad else "agents match"))
            return 1 if bad else 0
        elif "--plan" not in argv and active(root):
            print(f"{plan} (last applied in this checkout; a fresh start would resolve to {resolve(root)[0]}: {resolve(root)[1]})")
        elif "--plan" in argv:
            print(f"{plan} (forced by --plan; a fresh start would resolve to {resolve(root)[0]}: {resolve(root)[1]})")
        else:
            print(f"{plan} ({resolve(root)[1]})")
        return 0
    try:
        event = json.loads(sys.stdin.read() or "{}")
    except ValueError:
        event = {}
    print(json.dumps(session_start(event if isinstance(event, dict) else {})))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
