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

Both on one pull request, not yet merged; spec in `docs/submersibles-s6-s4-spec.md`.

- **Submersibles step S6: gil advice from the player's own log** (built 2026-11-17). Earnings ranks routes by gil per
  hour once a route has 10 logged voyages; the Board then advises routes from the log, using the prices cached on the
  device; part advice in gil only for swaps that lower none of surveillance, retrieval and favor. "Send on this route"
  keeps the typed loot and discoveries and sends exactly the route it shows. Browser checks C78 to C81 and C83.
- **Submersibles step S4: the sea map** (built 2026-11-17). The Map tab draws each of the seven seas from the sector
  positions in the data, and a route planner opens the send window with the planned route. The map saves nothing.
  Browser checks C82 and C84.

## Next

1. The owner compares the Deep-sea Site chart with the game's map (one constant, `CHART.Y_DOWN`, flips it), then decides
   whether steps S6 and S4 ship.
2. The Submersibles design document is not in this repository; the owner adds it to `docs/` after a privacy check, and
   the S4 and S6 work is then checked against it.

## Parked by the owner

- A new app icon.

## Known limits

- The "between half and four times the route's usual experience" refusal on return is a guard, not a measured game
  limit; if a real voyage falls outside it, widen it.
- The sea map is drawn by the app, not the game's pictures; its orientation is unverified until the owner's comparison.
- Gil advice assumes a part swap brings back the same items; the effect of surveillance, retrieval and favor on loot is
  not modelled.
- `check.js` check C26b (real push delivery) does not run in automated environments.
