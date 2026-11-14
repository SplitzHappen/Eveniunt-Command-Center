"""Pin the model-tier agent sets, the plan switch and the launch guard (docs/model-tiers.md)."""

from __future__ import annotations

import json
import os
import re
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".claude" / "hooks"))
import model_plan  # noqa: E402
import tier_guard  # noqa: E402

NAMES = ("architect", "builder", "clerk", "reviewer")
MODELS = {"max": {"architect": "fable", "builder": "sonnet", "clerk": "haiku", "reviewer": "opus"},
          "pro": {"architect": "opus", "builder": "sonnet", "clerk": "haiku", "reviewer": "opus"}}


def front(path: Path) -> dict[str, str]:
    text = path.read_text(encoding="utf-8")
    block = text.split("---")[1]
    return {m.group(1): m.group(2).strip() for m in re.finditer(r"^(\w+): (.*)$", block, re.M)}


class SetTests(unittest.TestCase):
    def test_each_set_pins_the_expected_models(self) -> None:
        for plan, models in MODELS.items():
            for name in NAMES:
                with self.subTest(plan=plan, agent=name):
                    meta = front(ROOT / ".claude/agent-sets" / plan / f"{name}.md")
                    self.assertEqual(meta["name"], name)
                    self.assertEqual(meta["model"], models[name])

    def test_only_the_architect_differs_between_the_sets(self) -> None:
        for name in NAMES:
            same = (ROOT / ".claude/agent-sets/max" / f"{name}.md").read_bytes() == (ROOT / ".claude/agent-sets/pro" / f"{name}.md").read_bytes()
            self.assertEqual(same, name != "architect", name)

    def test_no_agent_can_launch_agents_or_browse(self) -> None:
        for plan in MODELS:
            for name in NAMES:
                meta = front(ROOT / ".claude/agent-sets" / plan / f"{name}.md")
                for tool in ("Agent", "WebFetch", "WebSearch"):
                    self.assertIn(tool, meta["disallowedTools"], f"{plan}/{name}")

    def test_reviewer_is_read_only(self) -> None:
        meta = front(ROOT / ".claude/agent-sets/max/reviewer.md")
        for tool in ("Edit", "Write"):
            self.assertIn(tool, meta["disallowedTools"])
            self.assertNotIn(tool, meta["tools"])

    def test_generated_agents_are_untracked_and_builder_clerk_have_positive_tools(self) -> None:
        import subprocess
        tracked = subprocess.run(["git", "-C", str(ROOT), "ls-files", ".claude/agents"], capture_output=True, text=True).stdout.split()
        self.assertEqual(tracked, [".claude/agents/.gitkeep"])
        for plan in MODELS:
            for name in ("builder", "clerk"):
                self.assertEqual(front(ROOT / ".claude/agent-sets" / plan / f"{name}.md")["tools"], "Read, Edit, Write, Bash, Glob, Grep")

    def test_settings_wire_the_three_hooks(self) -> None:
        hooks = json.loads((ROOT / ".claude/settings.json").read_text(encoding="utf-8"))["hooks"]
        text = lambda event: json.dumps(hooks[event])  # noqa: E731
        self.assertIn("model_plan.py", text("SessionStart"))
        self.assertIn("tier_guard.py", text("PreToolUse"))
        self.assertIn("Agent", hooks["PreToolUse"][0]["matcher"])
        self.assertEqual(hooks["PreToolUse"][0]["hooks"][0]["onFailure"], "block")
        self.assertIn("tier_guard.py", text("SubagentStop"))


class PlanTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        shutil.copytree(ROOT / ".claude/agent-sets", self.root / ".claude/agent-sets")
        shutil.copy(ROOT / ".claude/model-plan.json", self.root / ".claude/model-plan.json")
        self.env = mock.patch.dict(os.environ, {"CLAUDE_PROJECT_DIR": str(self.root)})
        self.env.start()
        self.addCleanup(self.env.stop)
        os.environ.pop("CONTINUITY_MODEL_PLAN", None)

    def test_the_model_can_only_lower_the_plan(self) -> None:
        plan = lambda model=None, source="startup": model_plan.resolve(self.root, model, source)[0]  # noqa: E731
        self.assertEqual(plan(None), "max")
        self.assertEqual(plan("claude-opus-5-5"), "max")
        self.assertEqual(plan("claude-sonnet-5-5"), "pro")
        self.assertEqual(plan("claude-haiku-5-5"), "pro")
        with mock.patch.dict(os.environ, {"CONTINUITY_MODEL_PLAN": "pro"}):
            self.assertEqual(plan("claude-opus-5-5"), "pro")
        with mock.patch.dict(os.environ, {"CONTINUITY_MODEL_PLAN": "max"}):
            self.assertEqual(plan("claude-sonnet-5-5"), "max")
        (self.root / ".claude/model-plan.json").write_text('{"plan": "pro"}', encoding="utf-8")
        self.assertEqual(plan("claude-opus-5-5"), "pro")
        self.assertEqual(plan(None), "pro")
        for bad in ("not json", '{"plan": "ultra"}', "[]"):
            (self.root / ".claude/model-plan.json").write_text(bad, encoding="utf-8")
            self.assertEqual(plan("claude-opus-5-5"), "pro", bad)
        (self.root / ".claude/model-plan.json").unlink()
        self.assertEqual(plan("claude-opus-5-5"), "pro")

    def test_a_resumed_session_without_a_model_keeps_the_applied_plan_and_the_guard_does_not_flip_it(self) -> None:
        model_plan.session_start({"model": "claude-sonnet-5-5"})
        self.assertEqual(model_plan.active(self.root), "pro")
        out = model_plan.session_start({"source": "resume"})
        self.assertIn("plan: pro", out["hookSpecificOutput"]["additionalContext"])
        self.assertIsNone(tier_guard.pre_tool_use({"tool_name": "Agent", "tool_input": {"subagent_type": "builder", "prompt": "x"}}))
        self.assertEqual(model_plan.drift(self.root, "pro"), [])
        out = model_plan.session_start({"source": "startup", "model": "claude-opus-5-5"})
        self.assertIn("plan: max", out["hookSpecificOutput"]["additionalContext"])

    def test_show_names_the_reason_for_the_plan_it_prints(self) -> None:
        import subprocess
        env = {**os.environ, "CLAUDE_PROJECT_DIR": str(self.root)}
        env.pop("CONTINUITY_MODEL_PLAN", None)
        run = lambda *a: subprocess.run([sys.executable, str(ROOT / ".claude/hooks/model_plan.py"), *a], capture_output=True, text=True, env=env, check=True).stdout  # noqa: E731
        run("--apply", "--plan", "pro")
        out = run("--show")
        self.assertTrue(out.startswith("pro (last applied"), out)
        self.assertIn("would resolve to max", out)

    def test_sync_switches_only_the_architect_and_is_idempotent(self) -> None:
        self.assertEqual(sorted(model_plan.sync(self.root, "max")), list(NAMES))
        self.assertEqual(model_plan.sync(self.root, "max"), [])
        self.assertEqual(model_plan.sync(self.root, "pro"), ["architect"])
        self.assertEqual(front(self.root / ".claude/agents/architect.md")["model"], "opus")
        self.assertEqual(model_plan.drift(self.root, "pro"), [])
        self.assertEqual(model_plan.drift(self.root, "max"), ["architect"])

    def test_session_start_reports_the_plan(self) -> None:
        out = model_plan.session_start({"hook_event_name": "SessionStart", "model": "claude-sonnet-5-5"})
        note = out["hookSpecificOutput"]["additionalContext"]
        self.assertIn("plan: pro", note)
        self.assertIn("architect Opus", note)

    def test_launch_guard(self) -> None:
        model_plan.sync(self.root, "max")
        call = lambda **kw: tier_guard.pre_tool_use({"tool_name": "Agent", "tool_input": kw})  # noqa: E731
        self.assertIsNone(call(subagent_type="builder", prompt="Do card X at path Y."))
        self.assertEqual(call(subagent_type="Explore", prompt="Find the hook files.")["hookSpecificOutput"]["permissionDecision"], "deny")
        self.assertEqual(tier_guard.pre_tool_use({"tool_name": "Agent", "tool_input": "not an object"})["hookSpecificOutput"]["permissionDecision"], "deny")
        self.assertIsNone(tier_guard.pre_tool_use({"tool_name": "Bash", "tool_input": {}}))
        for bad in ({"subagent_type": "general-purpose", "prompt": "x"},
                    {"prompt": "x"},
                    {"subagent_type": "builder", "prompt": "x", "model": "opus"},
                    {"subagent_type": "builder", "prompt": "x", "isolation": "remote"},
                    {"subagent_type": "builder", "prompt": "x", "name": "helper"},
                    {"subagent_type": "builder", "prompt": "x", "team_name": "t"},
                    {"subagent_type": "builder", "prompt": "x", "effort": "max"},
                    {"subagent_type": "reviewer", "prompt": "x" * (tier_guard.MAX_BRIEF_CHARS + 1)}):
            with self.subTest(bad=bad):
                self.assertEqual(call(**bad)["hookSpecificOutput"]["permissionDecision"], "deny")

    def test_the_guard_process_fails_closed_on_bad_input_and_crashes(self) -> None:
        import subprocess
        script = str(ROOT / ".claude/hooks/tier_guard.py")
        env = {**os.environ, "CLAUDE_PROJECT_DIR": str(self.root)}
        run = lambda stdin: subprocess.run([sys.executable, script], input=stdin, capture_output=True, text=True, env=env, check=True).stdout  # noqa: E731
        for stdin in ("not json", "[]", json.dumps({"hook_event_name": "PreToolUse", "tool_name": "Agent", "tool_input": []})):
            with self.subTest(stdin=stdin):
                self.assertEqual(json.loads(run(stdin))["hookSpecificOutput"]["permissionDecision"], "deny")
        shutil.rmtree(self.root / ".claude/agent-sets")  # a missing set makes the drift check raise
        out = run(json.dumps({"hook_event_name": "PreToolUse", "tool_name": "Agent", "tool_input": {"subagent_type": "builder", "prompt": "x"}}))
        self.assertIn("fail closed", json.loads(out)["hookSpecificOutput"]["permissionDecisionReason"])

    def test_the_ledger_records_session_and_plan(self) -> None:
        import subprocess
        subprocess.run(["git", "init", "-q", str(self.root)], check=True)
        model_plan.sync(self.root, "pro")
        tier_guard.subagent_stop({"session_id": "s1", "agent_type": "builder", "agent_id": "a1", "last_assistant_message": "done"})
        rows = [json.loads(x) for x in (self.root / ".git/continuity-tier-ledger.jsonl").read_text().splitlines()]
        self.assertEqual((rows[0]["session"], rows[0]["plan"], rows[0]["agent"]), ("s1", "pro", "builder"))

    def test_launch_guard_repairs_stale_agent_files_once(self) -> None:
        model_plan.sync(self.root, "max")
        (self.root / ".claude/agents/builder.md").write_text("stale", encoding="utf-8")
        first = tier_guard.pre_tool_use({"tool_name": "Agent", "tool_input": {"subagent_type": "builder", "prompt": "x"}})
        self.assertIn("rewritten", first["hookSpecificOutput"]["permissionDecisionReason"])
        self.assertIsNone(tier_guard.pre_tool_use({"tool_name": "Agent", "tool_input": {"subagent_type": "builder", "prompt": "x"}}))


class StandardTests(unittest.TestCase):
    def test_the_standard_and_instructions_agree(self) -> None:
        std = (ROOT / "docs/model-tiers.md").read_text(encoding="utf-8")
        for needle in ("CONTINUITY_MODEL_PLAN", ".claude/model-plan.json", "tier_guard.py", "Escalation ladder", "6,000 characters", "onFailure"):
            self.assertIn(needle, std)
        claude = (ROOT / "CLAUDE.md").read_text(encoding="utf-8")
        self.assertIn("docs/model-tiers.md", claude)
        self.assertIn("pull request", claude)


if __name__ == "__main__":
    unittest.main()
