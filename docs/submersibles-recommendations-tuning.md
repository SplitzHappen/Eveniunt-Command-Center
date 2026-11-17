# Submersibles recommendations: how the default numbers were chosen

Written by `node tracker/tools/recs-tune.js --write` (spec section 4.6, item R4). Do not edit by hand: run the tool again. The file holds no dates or timings, so a second run writes the same text.

## The test fleet and the scenarios

Everything comes from `tracker/data/submarines.json`: no number is invented, no voyage log is used and no price is used.

- Ranks: 1, 10, 20, 30, 40, 50, 70, 90, 110, 130. At each rank, one build for every submarine class the rank allows, made of that class's own four parts (hull, stern, bow, bridge). That gives 61 builds.
- Every sub has 4 unlocked slots, no voyage on another sub, no experience into its rank.
- Scenario *levelling*: every sector of rank at most R is found (R is the sub's rank); Leveling is ranked first. Intended lead: experience (stage X).
- Scenario *unlocking*: every sector of rank at most R/2 (rounded down) is found, and always the two sectors A and B of the first sea; Unlocking is ranked first. Intended lead: new sectors (stage U2).
- Scenarios: 122. With the intended lead: 122 (61 levelling, 61 unlocking). Only these are measured. The rest have another lead (for example no sector able to reveal a new one), which these tables do not describe.
- Scenarios in which some allowance from 5 to 50 changed the route compared with fuel off: 75 of 122.

| Rank | Classes | Levelling lead | Unlocking lead |
| --- | --- | --- | --- |
| 1 | Shark | X | U2 |
| 10 | Shark | X | U2 |
| 20 | Shark, Unkiu | X, X | U2, U2 |
| 30 | Shark, Unkiu, Whale | X, X, X | U2, U2, U2 |
| 40 | Shark, Unkiu, Whale, Coelacanth | X, X, X, X | U2, U2, U2, U2 |
| 50 | Shark, Unkiu, Whale, Coelacanth, Syldra, Modified Whale, Modified Unkiu, Modified Shark, Modified Coelacanth, Modified Syldra | X, X, X, X, X, X, X, X, X, X | U2, U2, U2, U2, U2, U2, U2, U2, U2, U2 |
| 70 | Shark, Unkiu, Whale, Coelacanth, Syldra, Modified Whale, Modified Unkiu, Modified Shark, Modified Coelacanth, Modified Syldra | X, X, X, X, X, X, X, X, X, X | U2, U2, U2, U2, U2, U2, U2, U2, U2, U2 |
| 90 | Shark, Unkiu, Whale, Coelacanth, Syldra, Modified Whale, Modified Unkiu, Modified Shark, Modified Coelacanth, Modified Syldra | X, X, X, X, X, X, X, X, X, X | U2, U2, U2, U2, U2, U2, U2, U2, U2, U2 |
| 110 | Shark, Unkiu, Whale, Coelacanth, Syldra, Modified Whale, Modified Unkiu, Modified Shark, Modified Coelacanth, Modified Syldra | X, X, X, X, X, X, X, X, X, X | U2, U2, U2, U2, U2, U2, U2, U2, U2, U2 |
| 130 | Shark, Unkiu, Whale, Coelacanth, Syldra, Modified Whale, Modified Unkiu, Modified Shark, Modified Coelacanth, Modified Syldra | X, X, X, X, X, X, X, X, X, X | U2, U2, U2, U2, U2, U2, U2, U2, U2, U2 |

## The fuel allowance

For each allowance g the top priority may give up (fuel efficiency on), over the 122 scenarios:

- `L(g)`: mean share of the top priority's per-hour score given up, against fuel off, in percent.
- `E(g)`: mean gain in the top priority's amount per tank, against fuel off, in percent.

| g (%) | L(g) | E(g) | step cost (L) | step gain (E) | step pays (E gain >= L cost) | scenarios whose route changed |
| --- | --- | --- | --- | --- | --- | --- |
| 0 (fuel off) | 0.00 | 0.00 | | | | |
| 5 | 0.15 | 13.18 | 0.15 | 13.18 | yes | 22 |
| 10 | 1.30 | 17.88 | 1.15 | 4.70 | yes | 39 |
| 15 | 3.41 | 19.34 | 2.11 | 1.46 | no | 52 |
| 20 | 4.76 | 23.60 | 1.35 | 4.26 | yes | 57 |
| 25 | 6.70 | 30.27 | 1.94 | 6.67 | yes | 61 |
| 30 | 9.17 | 35.83 | 2.46 | 5.56 | yes | 68 |
| 35 | 11.17 | 40.85 | 2.01 | 5.02 | yes | 73 |
| 40 | 12.93 | 44.85 | 1.75 | 4.00 | yes | 75 |
| 45 | 14.29 | 47.54 | 1.37 | 2.70 | yes | 75 |
| 50 | 14.81 | 48.95 | 0.52 | 1.41 | yes | 75 |

**The rule, in one sentence:** the default allowance is the largest g up to which every step of 5 points bought at least as much extra gain per tank as it cost in lost per-hour score (`E(g) - E(g-5) >= L(g) - L(g-5)`, with fuel off as `E = L = 0`).

**Chosen numbers**

- Fuel allowance (`RECS.GIVE_UP`): **10%** (the first step that does not pay is 15%).
- Band between priorities (`RECS.BAND`): 5%, fixed (accepted by the table below).

## The band between priorities

Fuel off. The first priority is the scenario's lead (experience in a levelling scenario, new sectors in an unlocking one); the second is the other of the two (new sectors, or experience), in the scenarios where it can be live (122 of 122). Both columns are in percentage points of the best score any route reaches for that priority per hour; the gain is counted against a band of 0%.

| Band | Mean loss on the first priority | Mean gain on the second priority |
| --- | --- | --- |
| 0% | 0.00 | 0.00 |
| 2% | 0.15 | 2.90 |
| 5% | 0.77 | 5.10 |
| 10% | 1.65 | 8.60 |

Accepted at 5% when the second priority gains more than the first loses: 5.10 against 0.77, so accepted.

## What this does and does not show

- **10% is where the rule stops, not the best value.** It is the first allowance at which a 5-point step stops paying (the step to 15%: gain 1.46 against cost 2.11). 7 of the 7 steps after it pay again, and the gap between E and L keeps growing: 16.58 at 10%, 34.14 at 50% (the 50% row: L 14.81, E 48.95, route changed in 75 of 122 scenarios). The table does not show which allowance is best; the rule only picks the first point where the gain falls short of the cost.
- **E and L are different units.** E is a gain in the amount per ceruleum tank; L is the share of the top priority's per-hour score given up. Comparing them (`E gain >= L cost`) puts a tank and an hour of that score on one scale, and the data gives no exchange rate between them, so "pays" is only the rule's word.
- **The next-slot stage is never measured.** Every scenario has 4 slots unlocked, so the stage that looks for the sector granting the next submarine slot (U1) has nothing to do in any of them.
- **The 95% per-tank filter was not tuned.** After the allowance, only routes within 95% of the best gain per tank stay (spec 4.4); that 95% is fixed, and no other value was tried.
- **Gil and loot are left out.** The repository holds no voyage log and no item prices, so any gil figure would be invented; the data gives no drop odds for loot, so any loot figure would be invented too. The tables describe only experience and new sectors.

## What was left out, and why

- **Gil:** the repository holds no voyage log and none is made up, and there are no item prices; a gil figure would have to be invented.
- **Loot:** the data lists which items can drop in which sector but gives no drop odds; any odds would be invented.
- Times are "calculated, not yet confirmed" and experience is a floor (see the data's notes), so the tables describe how the rule behaves on the data, not what the game pays.
- Searches above 8 visitable sectors in a sea return the best route found, not a proven best, exactly as in the advisor.

