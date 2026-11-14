# Eveniunt Command Center — instructions for Claude

A public, offline-first set of FFXIV tools (the Command Center shell, the Tracker and the Atelier), published to GitHub Pages from `main`. `README.md` has the layout and each module's own README has its commands; do not guess build or test commands.

## Rules for this repository

- It is public: never commit secrets, tokens or personal data. Never automate the game or invent game data; label unverified assumptions.
- A push to `main` redeploys the site (`.github/workflows/pages.yml`). Work on a branch and open a pull request; merging is the owner's call.

## Models: who does which job (`docs/model-tiers.md`)

The session's main model orchestrates: it decomposes the request, delegates, tracks progress and writes the final synthesis. Delegate only to these tier agents (`.claude/agents/`, generated from `.claude/agent-sets/`):

- `architect` (Fable, Opus on the pro plan): architecture and difficult planning; one written spec.
- `builder` (Sonnet): implementation and testing of a fully specified item.
- `clerk` (Haiku): routine and repetitive work, file discovery, log reading.
- `reviewer` (Opus): independent review and debugging, read-only.

Do small work (about three tool calls) yourself. Plan once. Escalate clerk, then builder, then reviewer, then architect. Keep briefs under 6,000 characters and results to a few lines. Wait for delegates before ending the turn. A Claude review of Claude-built work is same-family, never called independent. The plan (max or pro) follows `.claude/model-plan.json` and drops to pro on a Sonnet or Haiku start; start sessions on Opus for the max plan. `.claude/hooks/tier_guard.py` refuses any other launch. Details and limits: `docs/model-tiers.md`.
