# Model tiers — which Claude model does which job

Decided by the owner (2026-11-13 for the Continuity workspace; applied here on request; revised 2026-11-19): Opus orchestrates, reviews and debugs; Fable plans architecture; Sonnet builds and tests; Haiku does routine work and the small, test-covered build items. Ported from the reviewed Continuity standard; this repository has no governance machinery of its own, so the rules here are short.

## 1. Roles

| Tier | Model | Effort | Does | Does not do |
| --- | --- | --- | --- | --- |
| Orchestrator | the session's main model | the session's | Decomposes the request, delegates, tracks progress, consolidates, checks what delegates claim, writes the final synthesis and every owner-facing report | Bulk building or reading a cheaper tier can do |
| `architect` | Fable (max plan), Opus (pro plan) | high | Architecture and difficult planning: one written spec with work items and owner questions | Implement, review code, decide the owner's choices |
| `builder` | Sonnet | medium | Implementation and testing of a fully specified work item; everything on the protected list (section 3, rule 4); anything the clerk escalated | Design, anything the brief leaves open |
| `clerk` | Haiku | low | Routine work (file discovery, repetitive edits, running the build and the suites, log reading, fixtures, format conversions); one piece of a split check; a small build item that passes the gate in rule 4 | Anything that needs a choice; anything on the protected list |
| `reviewer` | Opus | high | Review of finished changes against the original request and the diff, and debugging; returns findings and a proposed fix | Write or apply code; take the builder's account as evidence |

Effort is written in each agent file. Without it, a sub-agent on a different model from the session runs at that model's default (medium, measured here on 2026-11-19 for the clerk), and one on the session's own model inherits the session's level, so the cost of the same routing changed with how the session was started.

## 2. The two plans

| | max | pro |
| --- | --- | --- |
| Orchestrator (the model the session is started on) | Opus | Sonnet, which also builds small and medium work directly |
| `architect` | Fable | Opus |
| `builder` | Sonnet | Sonnet |
| `clerk` | Haiku | Haiku |
| `reviewer` | Opus | Opus |

The agent files for each plan are in `.claude/agent-sets/max/` and `.claude/agent-sets/pro/`; only `architect.md` differs. `.claude/agents/*.md` is generated and untracked: edit the sets, never that folder.

**Switching.** `.claude/model-plan.json` records the owner's entitlement: `max` means Fable is available, `pro` means it is not; a missing or invalid file means `pro`. The SessionStart hook `.claude/hooks/model_plan.py` picks the plan: `CONTINUITY_MODEL_PLAN` set to `max` or `pro` in the session's environment overrides everything; otherwise the file's plan is the ceiling and the session's model can only lower it (a session started on Sonnet or Haiku uses `pro`). The model never raises the plan, because a model name says nothing about what the subscription allows. The hook copies the plan's set into `.claude/agents/` and tells the session which plan is active and why. `python3 .claude/hooks/model_plan.py --show`, `--apply --plan pro` and `--check` do by hand what the hook does. When the subscription changes, set the variable or edit the file once.

**The session's own model.** The orchestrator reads every result and writes every report, so it is the largest part of the usage. The hook names the model the session really started on and says so when it is not the plan's orchestrator. A session started on the architect's model (Fable on max) plans in the session: launching the architect would pay twice for the same model.

## 3. Routing rules for the orchestrator

1. **Do small work yourself.** Delegation has a fixed cost (a brief out, a result back, a fresh context that re-reads the files), so a task of about three tool calls, or one whose files are already in your context, is done directly. Delegate when the work needs a lot of reading or running that you would otherwise carry in your own context. Under pro, do not delegate to `builder` merely to relabel Sonnet work.
2. **Plan once, in writing.** The architect returns one spec; later tiers consume it.
3. **Split wide checks.** A check that covers many files or pages (guides against the solver's data, links, built copies, every module for one pattern) is cut into small fixed pieces, one clerk each, launched together. One model reading everything finds fewer problems than many reading a piece each; the model matters less than the split. Clerks over-report, so open and confirm each claimed problem yourself before reporting it, and say how many claims you rejected.
4. **Haiku builds only behind the gate.** A build item goes to `clerk` only when all of these hold: the brief leaves nothing to decide; a test or check named in the brief fails if the work is wrong; it stays inside one module; and it touches nothing on the protected list. Otherwise it goes to `builder`. **Protected list:** `tracker/src/core/save.js` and any code that reads, writes or merges the shared save; service workers and offline behaviour; the build scripts; `.github/workflows/`; `.claude/`. The clerk also runs the routine steps around a builder's job (finding files, running the build and the suites, reading logs).
5. **Escalation ladder.** `clerk` meets a choice or fails once, so `builder` takes the item (the clerk does not retry). `builder` fails twice on a step, so `reviewer` diagnoses. `reviewer` finds a design flaw, so `architect`. A reviewer's fix is applied by `builder`.
6. **Brief the reviewer with the request, not the report.** A review brief carries the owner's original request (or the spec item) and the diff or commit range. It never carries the builder's or clerk's summary of its own work; what a delegate said about its work is a claim the reviewer checks.
7. **Brief and result caps.** A brief names paths and the exact ask and is under 6,000 characters. A result is at most 15 lines (clerk 10, a split-check piece 25, reviewer 20): paths, counts and findings, never file contents or logs.
8. **Independence.** Claude reviewing Claude-built work is same-family; say so. It is not an independent audit.
9. **Wait for delegates before ending the turn.** Do not leave agents running or start schedules or subscriptions unless the owner asked.
10. **Reporting.** Before the final report run `python3 .claude/hooks/tier_usage.py` (every session whose transcripts are still on the machine; `--session <id>` narrows it to one, the id being the name of its `<id>.jsonl` transcript) and give the owner its lines: runs per tier, the model and effort that really served each, tokens, and any problem it lists. Put the same lines in the pull request description, because the transcripts and the ledger disappear with a cloud container. `python3 .claude/hooks/tier_guard.py --report` gives the launch counts alone.

## 4. What enforces it, and what does not

**Configured and checked by tests** (`tests/test_model_tiers.py`, part of `npm run test:unit`): the model and the effort written in each agent file; each agent's tool list (tool selection, not a barrier: builder and clerk have a positive allowlist; the Agent, WebFetch and WebSearch tools are removed, but Bash remains and can reach the network or start processes; the reviewer has no Edit or Write but keeps Bash); `.claude/hooks/tier_guard.py`, which refuses a launch of anything but the four tier agents, a `model` override, remote isolation, `name`, `team_name` or `effort` on the call (`name` is the documented agent-team trigger; `team_name` is documented as ignored and refused as a precaution; effort belongs in the agent file), and an oversized brief, and which refuses on unreadable input (it is also written to refuse on its own errors; that path is not tested). The hook is registered with `onFailure: "block"`, which blocks a launch when the hook cannot start, crashes or times out, on Claude Code v2.1.295 or later (documented; not tested here; what an older version does with the key is not documented).

**Measured afterwards, not prevented:** `.claude/hooks/tier_usage.py` reads Claude Code's transcripts (`~/.claude/projects/<project>/<session>.jsonl` and `<session>/subagents/agent-<id>.jsonl`, layout seen on v2.1.328) and reports the model, effort and tokens of every sub-agent and of the orchestrator, listing any run served by a model or effort other than the pinned one. It reports tokens, not money: prices change and a subscription is not billed per token. It sees only transcripts still on the machine, and it compares each run with the agent files as they are now: a run from before a pin was changed is listed as a problem although nothing failed.

**Not enforced:**
- A launch on the wrong model is reported after it ran, not stopped. Settings, installed mods or `CLAUDE_CODE_SUBAGENT_MODEL` can override routing, and `CLAUDE_CODE_EFFORT_LEVEL` overrides every pinned effort.
- The gate for Haiku build items and the protected list are instructions in the rules and in the clerk's file; nothing stops a clerk's edit to a protected file. The reviewer and `Checks` are the net.
- The reviewer's read-only rule covers file tools only.
- The small-task rule, splitting, the escalation ladder and waiting for delegates are instructions; the usage report shows drift afterwards.
- One plan per checkout: two sessions on different plans in one checkout overwrite each other.
- No automatic fallback if a model is unavailable: switch plan by hand.
- Agent files changed during a session may only take effect in the next session.
- Whether a brand-new cloud container loads the generated agent files has been seen once, with a delay. If the tier agents are missing, run `python3 .claude/hooks/model_plan.py --apply` and start a new session.

The hooks are a strong check, not a proof.

## 5. Where the 2026-11-19 revision came from

The split rule, the reviewer-brief rule and the Haiku gate follow a public experiment on routing work between Claude models (about 330 scored runs, mostly on one Python codebase, two to five runs per setup, tests written and judged by Claude Opus). It supports the direction of these rules, not their size, and it did not test Fable, Sonnet as a helper, or effort levels. The effort levels are a judgement, not a measurement. Revisit both with this repository's own numbers from the usage report.
