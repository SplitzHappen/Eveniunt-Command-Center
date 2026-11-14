# Model tiers — which Claude model does which job

Decided by the owner (2026-11-13 for the Continuity workspace; applied here on request): Opus orchestrates, reviews and debugs; Fable plans architecture; Sonnet builds and tests; Haiku does routine work. Ported from the reviewed Continuity standard; this repository has no governance machinery of its own, so the rules here are short.

## 1. Roles

| Tier | Model | Does | Does not do |
| --- | --- | --- | --- |
| Orchestrator | the session's main model | Decomposes the request, delegates, tracks progress, consolidates, writes the final synthesis and every owner-facing report | Bulk building or searching a cheaper tier can do |
| `architect` | Fable (max plan), Opus (pro plan) | Architecture and difficult planning: one written spec with work items and owner questions | Implement, review code, decide the owner's choices |
| `builder` | Sonnet | Implementation and testing of a fully specified work item | Design, anything the brief leaves open |
| `clerk` | Haiku | Routine and repetitive work: file discovery, repetitive edits, log reading, fixtures, format conversions | Anything that needs a choice |
| `reviewer` | Opus | Independent review of finished changes, and debugging; returns findings and a proposed fix | Write or apply code |

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

## 3. Routing rules for the orchestrator

1. **Do small work yourself.** A task of about three tool calls or fewer is done directly. Under pro, do not delegate to `builder` merely to relabel Sonnet work.
2. **Plan once, in writing.** The architect returns one spec; later tiers consume it.
3. **Escalation ladder.** `clerk` meets a choice, so `builder` decides. `builder` fails twice on a step, so `reviewer` diagnoses. `reviewer` finds a design flaw, so `architect`. A reviewer's fix is applied by `builder`.
4. **Brief and result caps.** A brief names paths and the exact ask and is under 6,000 characters. A result is at most 15 lines (clerk 10, reviewer 20): paths, counts and findings, never file contents or logs.
5. **Independence.** Claude reviewing Claude-built work is same-family; say so. It is not an independent audit.
6. **Wait for delegates before ending the turn.** Do not leave agents running or start schedules or subscriptions unless the owner asked.
7. **Reporting.** Say how many delegations ran per tier (`python3 .claude/hooks/tier_guard.py --report [--session <id>]`, observed counts, not verified spend) and which plan was active.

## 4. What enforces it, and what does not

**Configured and checked by tests:** the model written in each agent file; each agent's tool list (tool selection, not a barrier: builder and clerk have a positive allowlist; the Agent, WebFetch and WebSearch tools are removed, but Bash remains and can reach the network or start processes; the reviewer has no Edit or Write but keeps Bash); `.claude/hooks/tier_guard.py`, which refuses a launch of anything but the four tier agents, a `model` override, remote isolation, `name`, `team_name` or `effort` (`name` is the documented agent-team trigger; `team_name` is documented as ignored and refused as a precaution), and an oversized brief, and which refuses on unreadable input or its own errors. The hook is registered with `onFailure: "block"`, which blocks a launch when the hook cannot start, crashes or times out, on Claude Code v2.1.295 or later (documented; not tested here; what an older version does with the key is not documented).

**Not enforced:**
- The model that actually served a launch is not attested; settings or installed mods can override routing.
- The reviewer's read-only rule covers file tools only.
- The small-task rule, the escalation ladder and waiting for delegates are instructions; the ledger shows drift afterwards.
- One plan per checkout: two sessions on different plans in one checkout overwrite each other.
- No automatic fallback if a model is unavailable: switch plan by hand.
- Whether a brand-new cloud container loads the generated agent files has been seen once, with a delay. If the tier agents are missing, run `python3 .claude/hooks/model_plan.py --apply` and start a new session.

The hooks are a strong check, not a proof. `tests/test_model_tiers.py` pins the files and the hooks.
