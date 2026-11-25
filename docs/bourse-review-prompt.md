# Outside review of the Bourse plan and the one look (prompt for ChatGPT and Mistral)

Prepared 2026-11-25 at the owner's request ("Yes, before building"). To be filed through the assignment bus in the
private Continuity repository (one assignment per reviewer); this file is the prompt body. The repository is public.

## What to review

Repository `SplitzHappen/Eveniunt-Command-Center`, pull request 10, branch `claude/loving-lamport-iy3cg1`. A plan, not
code: nothing under `tracker/` or `crafting/` changed.

1. `docs/bourse-spec.md`: the build spec of the Bourse, the market module (decisions D1 to D31, work items B0 to B15,
   checks C197 to C207). Read with `docs/bourse-questions.md` (the owner's answers, binding) and
   `docs/bourse-research.md`.
2. `docs/bourse-look-spec.md` (look v3) and the pictures in `docs/bourse/pictures/` (sheets `sheet-*.png`, screens
   `trip-*`, `item-*`, `profit-*`, `watch-*`, `states-*`, `settings-*`, `empty-*`).
3. `docs/one-look/v3/`: the four candidate looks for the whole app; the owner chose B (Atelier-led).

## What to check

- **Behaviour and data:** does the spec do what the owner's answers say? Are prices, profit (sale minus materials, both
  taxes, listings and sales apart, high and normal quality never mixed), the trip (seven data centers in three regions,
  fewest region hops, listings bought whole), price history, watch alerts on every page, and the save section correct
  and buildable? Can any path show an unknown price as 0, overstate profit, mix qualities, or delete saved data across
  devices without the player's choice?
- **Load on the free price site (Universalis):** is the pace, batching, caching and the per-session budget polite and
  testable, now that lookups go to three regions?
- **The shared save:** `tracker/src/core/save.js` is embedded in the Tracker, the Command Center and the Atelier; does
  the new `bourse` section survive an older build's write, and is every existing field kept readable?
- **Tests:** would each acceptance test fail without its change? Are work items small and unambiguous enough for a
  builder?
- **Appearance (design rules section 12, step 4):** check every screen against `docs/design-rules.md` and the look spec
  and report by rule number (C1 to C6, A1 to A7, F1 to F6, S1 to S5, T1 to T6, K1 to K8, P1 to P8, E1 to E3, W1 to W5).
  Known and chosen by the owner: the answer band's state blocks stay on the phone, so on screens without a strip the
  first row starts at 256 px against P3's 200 px.

## What to return

A verdict (pass or fail), then findings ranked blocking, serious, ordinary, each with the file and section, what fails,
and the fix in one sentence. Say what you could not check. Do not include personal data.
