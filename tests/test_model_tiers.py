"""Tests for the model tiers: agent files, the launch guard, the plan, the session note and the usage report."""

from __future__ import annotations

import io
import json
import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / ".claude" / "hooks"))
import model_plan  # noqa: E402
import tier_guard  # noqa: E402
import tier_usage  # noqa: E402

SETS = REPO / ".claude" / "agent-sets"


def frontmatter(path: Path) -> tuple[dict[str, str], str]:
    parts = path.read_text(encoding="utf-8").split("---\n", 2)
    fields = {}
    for line in parts[1].splitlines():
        key, _, val = line.partition(":")
        fields[key.strip()] = val.strip()
    return fields, parts[2]


def make_root(tmp: str, plan: str | None = "max") -> Path:
    root = Path(tmp)
    (root / ".claude").mkdir(parents=True, exist_ok=True)
    shutil.copytree(REPO / ".claude" / "agent-sets", root / ".claude" / "agent-sets")
    shutil.copytree(REPO / ".claude" / "hooks", root / ".claude" / "hooks", ignore=shutil.ignore_patterns("__pycache__"))
    if plan is not None:
        (root / ".claude" / "model-plan.json").write_text(json.dumps({"plan": plan}), encoding="utf-8")
    return root


def env_for(root: Path) -> mock._patch_dict:
    env = dict(os.environ, CLAUDE_PROJECT_DIR=str(root))
    env.pop("CONTINUITY_MODEL_PLAN", None)
    return mock.patch.dict(os.environ, env, clear=True)


class AgentFiles(unittest.TestCase):
    def test_both_sets(self) -> None:
        for plan, arch_model in (("max", "fable"), ("pro", "opus")):
            want = {"architect": (arch_model, "high"), "builder": ("sonnet", "medium"),
                    "clerk": ("haiku", "low"), "reviewer": ("opus", "high")}
            for agent, (model, effort) in want.items():
                path = SETS / plan / f"{agent}.md"
                self.assertTrue(path.exists(), path)
                fields, body = frontmatter(path)
                self.assertEqual(fields["model"], model, f"{plan}/{agent}")
                self.assertEqual(fields["effort"], effort, f"{plan}/{agent}")
                self.assertIn("Agent", fields["disallowedTools"], f"{plan}/{agent}")
                if agent == "reviewer":
                    self.assertNotIn("Edit", fields["tools"])
                    self.assertNotIn("Write", fields["tools"])
                    self.assertIn("never evidence", body)
                if agent == "clerk":
                    for text in ("tracker/src/core/save.js", ".github/workflows/", "One attempt only"):
                        self.assertIn(text, body)

    def test_sets_differ_only_in_architect(self) -> None:
        for agent in model_plan.AGENTS:
            same = (SETS / "max" / f"{agent}.md").read_bytes() == (SETS / "pro" / f"{agent}.md").read_bytes()
            self.assertEqual(same, agent != "architect", agent)


class Guard(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = make_root(self.tmp.name)
        patcher = env_for(self.root)
        patcher.start()
        self.addCleanup(patcher.stop)
        model_plan.sync(self.root, "max")

    def call(self, **extra: object) -> dict | None:
        args = {"subagent_type": "clerk", "prompt": "x", **extra}
        return tier_guard.pre_tool_use({"tool_name": "Agent", "tool_input": args})

    def assert_denied(self, out: dict | None) -> None:
        self.assertIsNotNone(out)
        self.assertEqual(out["hookSpecificOutput"]["permissionDecision"], "deny")

    def test_clean_launch(self) -> None:
        self.assertIsNone(self.call())

    def test_denied_launches(self) -> None:
        self.assert_denied(self.call(subagent_type="general-purpose"))
        self.assert_denied(self.call(model="opus"))
        self.assert_denied(self.call(effort="high"))
        self.assert_denied(self.call(name="x"))
        self.assert_denied(self.call(team_name="x"))
        self.assert_denied(self.call(isolation="remote"))
        self.assert_denied(self.call(prompt="x" * 6001))

    def test_altered_agent_file(self) -> None:
        with (self.root / ".claude" / "agents" / "clerk.md").open("a", encoding="utf-8") as fh:
            fh.write("altered\n")
        self.assert_denied(self.call())
        self.assertIsNone(self.call())

    def test_unreadable_stdin(self) -> None:
        out = io.StringIO()
        with mock.patch.object(sys, "stdin", io.StringIO("not json")), mock.patch.object(sys, "stdout", out):
            self.assertEqual(tier_guard.main([]), 0)
        self.assertEqual(json.loads(out.getvalue())["hookSpecificOutput"]["permissionDecision"], "deny")


class Plan(unittest.TestCase):
    def resolve(self, plan: str | None, model: str | None = None, env: str | None = None) -> str:
        with tempfile.TemporaryDirectory() as tmp:
            root = make_root(tmp, plan)
            with env_for(root):
                if env:
                    os.environ["CONTINUITY_MODEL_PLAN"] = env
                return model_plan.resolve(root, model)[0]

    def test_resolve(self) -> None:
        self.assertEqual(self.resolve("max"), "max")
        self.assertEqual(self.resolve("max", "claude-sonnet-5-5"), "pro")
        self.assertEqual(self.resolve("max", env="pro"), "pro")
        self.assertEqual(self.resolve(None), "pro")


class SessionNote(unittest.TestCase):
    def note(self, event: dict) -> str:
        with tempfile.TemporaryDirectory() as tmp:
            root = make_root(tmp, "max")
            with env_for(root):
                out = model_plan.session_start(event)
        return out["hookSpecificOutput"]["additionalContext"]

    def test_orchestrator_model(self) -> None:
        note = self.note({"model": "claude-opus-5-5"})
        self.assertIn("Session model: claude-opus-5-5.", note)
        self.assertNotIn("not the plan's", note)

    def test_architect_model(self) -> None:
        note = self.note({"model": "claude-fable-5-2"})
        self.assertIn("not the plan's Opus orchestrator", note)
        self.assertIn("Plan in this session instead of launching the architect.", note)

    def test_no_model(self) -> None:
        self.assertIn("Session model not reported.", self.note({}))


def row(msg_id: str, model: str, effort: str | None, inp: int, out: int, cr: int = 0, cw: int = 0, uuid: str = "u") -> str:
    doc: dict = {"type": "assistant", "uuid": uuid, "message": {"id": msg_id, "model": model, "usage": {
        "input_tokens": inp, "output_tokens": out, "cache_read_input_tokens": cr, "cache_creation_input_tokens": cw}}}
    if effort:
        doc["effort"] = effort
    return json.dumps(doc)


class Usage(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.root = make_root(str(self.base / "repo"))
        self.project = self.base / "project"
        (self.project / "s1" / "subagents").mkdir(parents=True)

    def agent(self, agent_id: str, agent_type: str, rows: list[str]) -> None:
        sub = self.project / "s1" / "subagents"
        (sub / f"agent-{agent_id}.jsonl").write_text("\n".join(rows) + "\nnot json\n", encoding="utf-8")
        (sub / f"agent-{agent_id}.meta.json").write_text(json.dumps({"agentType": agent_type, "model": "x", "description": "d"}), encoding="utf-8")

    def build(self) -> None:
        (self.project / "s1.jsonl").write_text(
            row("m0", "claude-opus-5-5", "high", 1, 2, 3, 4) + "\n" + row("m9", "<synthetic>", None, 99, 99) + "\n", encoding="utf-8")
        self.agent("c1", "clerk", [row("m1", "claude-haiku-5-5", "low", 10, 5, 100, 50, "a"),
                                   row("m1", "claude-haiku-5-5", "low", 10, 5, 100, 50, "b")])
        self.agent("b1", "builder", [row("m2", "claude-opus-5-5", "high", 7, 3)])
        self.agent("e1", "Explore", [row("m3", "claude-haiku-5-5", "low", 4, 6)])

    def test_collect_and_render(self) -> None:
        self.build()
        data = tier_usage.collect(self.project, self.root, "max")
        self.assertEqual(data["orchestrator"]["tokens"], {"input": 1, "output": 2, "cache_read": 3, "cache_write": 4})
        self.assertEqual(data["tiers"]["clerk"]["runs"], 1)
        self.assertEqual(data["tiers"]["clerk"]["tokens"], {"input": 10, "output": 5, "cache_read": 100, "cache_write": 50})
        self.assertEqual(data["tiers"]["builder"]["runs"], 1)
        self.assertEqual(data["other"]["runs"], 1)
        self.assertEqual(data["other"]["tokens"]["input"], 4)
        self.assertEqual(data["problems"], ["builder b1: served by opus, pinned sonnet", "builder b1: effort high, pinned medium"])
        text = tier_usage.render(data, "max")
        self.assertEqual(text.splitlines()[0], "measured from transcripts (tokens, not money), plan max")
        self.assertIn("clerk: 1 runs, model haiku, effort low, in 10, out 5, cache read 100, cache write 50", text)
        self.assertIn("problems:\nbuilder b1: served by opus, pinned sonnet", text)

    def test_main_returns_one(self) -> None:
        self.build()
        with mock.patch.object(tier_usage, "project_dir", return_value=self.project), \
                mock.patch.object(model_plan, "root_dir", return_value=self.root), \
                mock.patch.object(sys, "stdout", io.StringIO()):
            self.assertEqual(tier_usage.main([]), 1)

    def test_empty_folder(self) -> None:
        empty = self.base / "empty"
        data = tier_usage.collect(empty, self.root, "max")
        self.assertTrue(tier_usage.render(data, "max", empty).startswith("no transcripts found"))


if __name__ == "__main__":
    unittest.main()
