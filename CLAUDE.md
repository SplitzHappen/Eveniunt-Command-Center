# Working on the Eveniunt Command Center

This repository is the home of the Eveniunt Command Center: the app at the website's root, with its modules (Tracker,
Submersibles, Atelier, Cosmic guides). Every push to `main` publishes the website. Read this file, then `docs/STATE.md`,
before changing anything.

## Layout

| Path | What it is |
| --- | --- |
| `tracker/src/` | Tracker source; `tracker/src/core/save.js` is the **one save shared by every module** |
| `tracker/command-center/` | The Command Center app: `src/` (shell, Settings, Submersibles), `build.js`, `check.js` (browser checks), `site/` (built) |
| `tracker/tests/` | Tracker and Submersibles unit tests, Tracker browser tests |
| `tracker/dist/`, `tracker/site/` | Built Tracker (single file, installable site) |
| `crafting/atelier/` | Atelier source, tests, built `dist/` and `site/` |
| `crafting/` (rest) | Cosmic Exploration solver and guides |
| `.github/workflows/checks.yml` | Every check, on each pull request and push to `main` |
| `.github/workflows/pages.yml` | Publishes the website from `main` |

## Build and test

```bash
npm ci && npx playwright install chromium   # once per machine
npm run build          # restores fonts and solver files, rebuilds everything, fails if a built copy changes
npm run test:unit
npm run test:browser
npm run check          # the Command Center browser checks (about 10 minutes)
```

Built copies (`dist/`, `site/`) are committed. After changing a source, run `npm run build` and commit the rebuilt files.
`save.js` is embedded in the Tracker, the Command Center **and the Atelier**: a change to it needs all of them rebuilt,
or a module with an old copy will strip the new fields from the shared save when it writes. The `Checks` workflow
refuses a pull request whose built copies are out of date.

## How a change ships

1. Work on a branch, never directly on `main`.
2. Add or update a test or check for every behaviour change, and run the suites above.
3. Open a pull request; `Checks` must be green at its latest commit.
4. The owner decides whether it ships. Merging into `main` publishes the website, so merge only on the owner's `ship`.
5. Record what shipped, and the next step, in `docs/STATE.md`.

## Models: who does which job (`docs/model-tiers.md`)

The session's main model orchestrates: it decomposes the request, delegates, tracks progress and writes the final
summary. It delegates only to these tier agents (`.claude/agents/`, generated from `.claude/agent-sets/`), which need no
per-task permission from the owner:

- `architect` (Fable; Opus on the pro plan; high effort): architecture and difficult planning; one written spec.
- `builder` (Sonnet; medium effort): implementation and testing of a fully specified item; always the shared save,
  service workers, build scripts, workflows and `.claude/`.
- `clerk` (Haiku; low effort): routine and repetitive work, file discovery, running suites, log reading, one piece of a
  split check, and a small build item that is fully specified, covered by a named test, inside one module and outside
  the builder's list above. One failed attempt goes to the builder.
- `reviewer` (Opus; high effort): review and debugging, read-only; briefed with the request and the diff, never with
  the builder's own summary.

Do small work (about three tool calls) yourself. Plan once. Split a wide check into small pieces across clerks and
confirm each claim. Escalate clerk, then builder, then reviewer, then architect. Keep briefs under 6,000 characters and
results to a few lines. A Claude review of Claude-built work is same-family, never called independent. The plan (max or
pro) follows `.claude/model-plan.json` and drops to pro on a Sonnet or Haiku start; a session started on the
architect's model plans for itself. `.claude/hooks/tier_guard.py` refuses any other launch. Before the final report run
`python3 .claude/hooks/tier_usage.py` and put its lines (model, effort and tokens really used per tier) in the report
and the pull request.

## Rules

- **Keep saves compatible.** The save's app tag `eveniunt-completionist-tracker` and every existing field stay readable;
  never drop or reinterpret data a player already has. A cross-device merge never deletes anything without the player's
  explicit choice.
- **Public repository.** Everything here is public: no personal names, e-mail addresses, private paths, keys or tokens.
- **No background work** (timers, watchers, subscriptions to pull-request events) unless the owner asks in the current
  conversation; then say what is running and how to stop it.
- **Owner decisions in plain language.** When the owner must choose, list every option (always including "keep things as
  they are") with what happens, what it costs, what risk is left and how sure you are, and give one recommendation. No
  internal codes or jargon in the options.
- **Report plainly.** Say what was done, what was tested and what was not; a skipped step or a failure is reported as such.
