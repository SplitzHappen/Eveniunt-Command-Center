# Where the Command Center stands

Last updated: 2026-11-19.

## Recently shipped

- **Submersibles: rank, progress and voyage grade on return, with learning** (2026-11-15). On a submarine's return the
  player can note the voyage grade (C, B, A, S, SS) and type the rank and experience the game shows; the app learns the
  bonus per grade from exactly typed returns, and refuses entries the game cannot show. Browser checks C76 and C77.
- **Submersibles step S5: what came back, the voyage log and earnings** (2026-11-15).
- **Settings and Submersibles: cross-device integrity fix** (2026-11-15). A free company and its submarines are decided
  together; nothing is deleted across devices without the player's explicit choice.
- **Sub-agent tiers** (2026-11-17): Opus orchestrates and reviews, Fable plans (Opus on the pro plan), Sonnet builds, Haiku does routine work; `docs/model-tiers.md`.
- **Sub-agent tiers, revised** (2026-11-19, awaiting the owner's `ship`): effort pinned per tier (clerk low, builder medium,
  reviewer and architect high); Haiku takes small test-covered build items outside the shared save; wide checks are split
  across clerks; the reviewer is briefed with the request and the diff; `tier_usage.py` reports the model, effort and
  tokens really used; the start-up note names the session's real model. Tier tests now exist and run in `Checks`.
- **This repository became the working home** (2026-11-17), with free automatic checks. The Atelier was rebuilt with the
  current shared save code (its copy predated the rank feature and dropped the new learning fields when it saved).

## Next

1. Submersibles step S6: gil advice from the player's own log (best routes by gil per hour once there is enough data, and
   part advice at the gil step).
2. Then step S4: the sea map.
3. Sub-agent tiers: after a few weeks of work, read the usage reports in the pull requests and decide whether to
   widen or narrow what Haiku builds, and whether the effort levels are right.

## Parked by the owner

- A new app icon.

## Known limits

- The "between half and four times the route's usual experience" refusal on return is a guard, not a measured game
  limit; if a real voyage falls outside it, widen it.
- `check.js` check C26b (real push delivery) does not run in automated environments.
