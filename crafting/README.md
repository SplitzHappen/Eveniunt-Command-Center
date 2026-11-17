# FFXIV Cosmic Exploration Crafting Solver

Offline, step-by-step adaptive crafting assistant for Final Fantasy XIV Cosmic Exploration. One self-contained HTML file per destination.

- **Players:** download `dist/cosmic-crafting-solver.zip` (or a single `dist/cosmic-<planet>.html`) and read `docs/USER_README.md`.
- **What is verified and what is not:** `docs/MECHANICS.md`, `docs/DATA.md`, `docs/VALIDATION.md`.

## Layout

| Path | Contents |
| --- | --- |
| `src/engine/sim.js` | Deterministic crafting simulator (state + action → next state) |
| `src/engine/solver.js` | Rollout decision engine and base policy |
| `src/app/` | Interface (HTML template, CSS, JS) |
| `data/cosmic-db.json` | Generated mission/recipe database (all planets) |
| `data/actions-verified.json` | Action CP/levels from the game sheets (test reference) |
| `tools/extract.py` | Database generator (datamined CSVs → JSON, with validation) |
| `tools/build.js` | Bundles `dist/cosmic-<planet>.html` |
| `tools/package.py` | Builds the end-user ZIP |
| `tools/evaluate.js` | Batch evaluation against baselines |
| `tests/` | `sim.test.js`, `solver.test.js` (engine), `ui.test.js` (built files in Chromium, offline) |
| `validation/` | Raw batch-evaluation results |

## Rebuild and test

```
python3 tools/extract.py <ffxiv-datamining checkout> --commit <sha>   # only when game data changes
node --test tests/sim.test.js tests/solver.test.js
node tools/build.js && node --test tests/ui.test.js                   # needs Playwright + Chromium
python3 tools/package.py
node tools/evaluate.js --planet all --n 40 --rollouts 600 --stats high,mid --out validation/expert-all.json
```

No build step or runtime dependency is needed to *use* the HTML files.
