# Where the Command Center stands

Last updated: 2026-11-17.

## Recently shipped

- **Submersibles: rank, progress and voyage grade on return, with learning** (2026-11-15). On a submarine's return the
  player can note the voyage grade (C, B, A, S, SS) and type the rank and experience the game shows; the app learns the
  bonus per grade from exactly typed returns, and refuses entries the game cannot show. Browser checks C76 and C77.
- **Submersibles step S5: what came back, the voyage log and earnings** (2026-11-15).
- **Settings and Submersibles: cross-device integrity fix** (2026-11-15). A free company and its submarines are decided
  together; nothing is deleted across devices without the player's explicit choice.
- **Sub-agent tiers** (2026-11-17): Opus orchestrates and reviews, Fable plans (Opus on the pro plan), Sonnet builds, Haiku does routine work; `docs/model-tiers.md`.
- **This repository became the working home** (2026-11-17), with free automatic checks. The Atelier was rebuilt with the
  current shared save code (its copy predated the rank feature and dropped the new learning fields when it saved).

## Built, waiting for the owner's `ship`

All on one pull request, not yet merged; specs in `docs/submersibles-s6-s4-spec.md`,
`docs/submersibles-recommendations-spec.md`, `docs/submersibles-droprates-spec.md` and `docs/submersibles-look-spec.md`.

- **Submersibles step S6: gil advice from the player's own log** (built 2026-11-17). Earnings ranks routes by gil per
  hour once a route has 10 logged voyages; the Board then advises routes from the log, using the prices cached on the
  device; part advice in gil only for swaps that lower none of surveillance, retrieval and favor. "Send on this route"
  keeps the typed loot and discoveries and sends exactly the route it shows. Browser checks C78 to C81 and C83.
- **Submersibles step S4: the sea map** (built 2026-11-17). The Map tab draws each of the seven seas from the sector
  positions in the data, and a route planner opens the send window with the planned route. The map saves nothing.
  Browser checks C82 and C84.
- **Submersibles: Customizable Recommendations** (built 2026-11-17). A panel in Setup: a ranking of four priorities
  (default: Unlocking Routes, Leveling Submersible Rank, Gil Farming, Loot Farming), a fuel-efficiency switch with a
  tunable allowance (default 15%) and five loot pickers. The first priority that can be served leads; each lower one
  chooses only among routes within 5% of the best for those above. The settings live in a save section of their own;
  `save.js` is unchanged. How the defaults were chosen: `docs/submersibles-recommendations-tuning.md`. Browser checks
  C85 to C89.
- **Submersibles: community drop rates** (built 2026-11-18). The data holds the community's voyage results for all 143
  sectors and each sector's surveillance, retrieval and favor thresholds (MIT-licensed source, pinned; see
  `tracker/data/SOURCES.md`). From them the app estimates merchant gil for any route and build. Gil Farming ranks the
  community gil routes a submarine can run by that estimate; a route with 10 logged voyages is ranked by the player's
  own log; a route found by the app leads when it is at least twice as good. At rank 145 Leveling is skipped. Loot
  Farming ranks by expected quantity per hour; part advice is valued by the estimate. Rates are shown on the Map, the
  send window and Earnings. This replaces S6's rules that the own log alone picks the gil route and that part advice
  refuses swaps lowering a stat. Browser checks C90 to C96, C98 and C99.
- **Submersibles: the new look** (built 2026-11-18). The whole module restyled to match the shell, Tracker and Atelier
  ("Dive console", revision 2): slab heads, slanted state fields, display numerals, the action slab, a sonar sea chart
  drawn by the app, and a voyage gauge on submarines that are out. Screenshots of every screen:
  `tracker/command-center/evidence/look-*.png`. Browser check C97 and the evidence block L1.
- **Submersibles: gaps against the original design** (built 2026-11-18; `docs/submersibles-design-gaps-spec.md`). The
  planner lists what a route can bring and says why a sector cannot be taken; every figure is labelled game data,
  calculated, learned or community estimate; alternatives say how they differ from the plan; part advice appears only
  when Gil Farming leads or a build is stuck; "Send all back" for the whole fleet; which free companies to show; a
  rank-up plan per submarine; earnings by submarine; the return sheet asks which sectors a voyage revealed, offering
  only the ones it could have. By the owner's decision the sea map stays read-only and there is no availability
  window. Browser checks C100 and C101.
- **Shared fixes** (built 2026-11-18). Text on the accent colour now reaches 4.5:1 in all 21 themes, light and dark
  (Tracker, Atelier and Command Center rebuilt). The Atelier no longer reloads over a first-visit click on Command
  Center. A failing browser check no longer ends the whole check run.

## Next

1. The owner decides whether the work above ships.
2. Done 2026-11-18: the chart's orientation was compared with a game screenshot and matches; the built module was
   compared with the original design (kept outside this repository) and the gaps closed.

## Parked by the owner

- A new app icon.

## Known limits

- The "between half and four times the route's usual experience" refusal on return is a guard, not a measured game
  limit; if a real voyage falls outside it, widen it.
- The sea map is drawn by the app, not the game's pictures. Its orientation was checked against one game screenshot
  of the Deep-sea Site (the start, A and B).
- Gil and loot figures are estimates from community records. The records hold only the first item of a survey; the
  second is assumed to be drawn like the first, which is about 45% of a typical gil figure. Above a threshold, extra
  surveillance, retrieval or favor is counted as worth nothing (the community's reading, not confirmed).
- The only licensed list of community routes holds ten routes, six of them the OJ family; other seas rely on routes the
  app finds from the drop rates.
- The default fuel allowance (15%) is the owner's choice; the tuning rule gives no single answer over the whole fleet.
- With the default ranking, a submarine below the top rank in a free company that has found everything is levelled
  before it farms gil, until the player moves Gil Farming up.
- Each recommendation control is stored on its own, so different controls changed in two tabs or on two devices are
  both kept. The same control changed in two tabs on one device takes the later change without asking, as every part
  of the save does.
- `check.js` check C26b (real push delivery) does not run in automated environments.
