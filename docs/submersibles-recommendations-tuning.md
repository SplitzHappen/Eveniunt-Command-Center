# Submersibles recommendations: how the default numbers were chosen

Written by `node tracker/tools/recs-tune.js --write` (spec section 4.6, item R4). Do not edit by hand: run the tool again. The file holds no dates or timings, so a second run writes the same text.

## What changed in this run

- The previous run measured 122 scenarios (levelling and unlocking, ranks 1 to 130, no gil) and its rule gave a fuel allowance of 10% and accepted the 5% band.
- This run adds rank 145 to the test fleet and a third scenario, *gil*, and measures it on estimated merchant gil per hour and per tank (the estimate of `drops.js`, from community drop records). It measures 201 of 211 scenarios.
- At rank 145 the Leveling stage is skipped, so a levelling scenario there has another lead and is not measured (the tables below show it).
- The rule is unchanged. Result on all three scenarios: no clear answer (no knee: every step paid, so the rule would return 50 and no allowance is chosen). The 5% band: accepted.
- What the new tables show: levelling and unlocking, ranks 1 to 130 (exactly the previous run's scenarios): 10%; levelling and unlocking, ranks 1 to 145: no clear answer; gil only (ranks 20 to 145): 15%; all three scenarios together: no clear answer. See "The same rule on parts of the scenarios" below.
- The shipped constants in this run: `RECS.GIVE_UP` = 10%, `RECS.BAND` = 5%. They are not changed by this run: the choice is left to the owner.

## The test fleet and the scenarios

Everything comes from `tracker/data/submarines.json`: no number is invented and no voyage log is used. The only prices are the data's own merchant prices, used by the gil scenario.

- Ranks: 1, 10, 20, 30, 40, 50, 70, 90, 110, 130, 145. At each rank, one build for every submarine class the rank allows, made of that class's own four parts (hull, stern, bow, bridge). That gives 71 builds.
- Every sub has 4 unlocked slots, no voyage on another sub, no experience into its rank.
- Scenario *levelling*: every sector of rank at most R is found (R is the sub's rank); Leveling is ranked first. Intended lead: experience (stage X).
- Scenario *unlocking*: every sector of rank at most R/2 (rounded down) is found, and always the two sectors A and B of the first sea; Unlocking is ranked first. Intended lead: new sectors (stage U2).
- Scenario *gil*: every sector is found, Gil Farming is ranked first, ranks from 20. Intended lead: gil (stage G). The amount is the estimated merchant gil of the voyage for that build (`DROPS.route` with the build's own surveillance, retrieval and favor), per hour and per tank like the other amounts. Community routes come first, as in the advisor.
- Scenarios: 211. With the intended lead: 201 (61 levelling, 71 unlocking, 69 gil). Only these are measured. The rest have another lead (for example no sector able to reveal a new one), which these tables do not describe.
- Scenarios in which some allowance from 5 to 50 changed the route compared with fuel off: 111 of 201.

| Rank | Classes | Levelling lead | Unlocking lead | Gil lead |
| --- | --- | --- | --- | --- |
| 1 | Shark | X | U2 | not run |
| 10 | Shark | X | U2 | not run |
| 20 | Shark, Unkiu | X, X | U2, U2 | G, G |
| 30 | Shark, Unkiu, Whale | X, X, X | U2, U2, U2 | G, G, G |
| 40 | Shark, Unkiu, Whale, Coelacanth | X, X, X, X | U2, U2, U2, U2 | G, G, G, G |
| 50 | Shark, Unkiu, Whale, Coelacanth, Syldra, Modified Whale, Modified Unkiu, Modified Shark, Modified Coelacanth, Modified Syldra | X, X, X, X, X, X, X, X, X, X | U2, U2, U2, U2, U2, U2, U2, U2, U2, U2 | G, G, G, G, G, G, G, G, G, G |
| 70 | Shark, Unkiu, Whale, Coelacanth, Syldra, Modified Whale, Modified Unkiu, Modified Shark, Modified Coelacanth, Modified Syldra | X, X, X, X, X, X, X, X, X, X | U2, U2, U2, U2, U2, U2, U2, U2, U2, U2 | G, G, G, G, G, G, G, G, G, G |
| 90 | Shark, Unkiu, Whale, Coelacanth, Syldra, Modified Whale, Modified Unkiu, Modified Shark, Modified Coelacanth, Modified Syldra | X, X, X, X, X, X, X, X, X, X | U2, U2, U2, U2, U2, U2, U2, U2, U2, U2 | G, G, G, G, G, G, G, G, G, G |
| 110 | Shark, Unkiu, Whale, Coelacanth, Syldra, Modified Whale, Modified Unkiu, Modified Shark, Modified Coelacanth, Modified Syldra | X, X, X, X, X, X, X, X, X, X | U2, U2, U2, U2, U2, U2, U2, U2, U2, U2 | G, G, G, G, G, G, G, G, G, G |
| 130 | Shark, Unkiu, Whale, Coelacanth, Syldra, Modified Whale, Modified Unkiu, Modified Shark, Modified Coelacanth, Modified Syldra | X, X, X, X, X, X, X, X, X, X | U2, U2, U2, U2, U2, U2, U2, U2, U2, U2 | G, G, G, G, G, G, G, G, G, G |
| 145 | Shark, Unkiu, Whale, Coelacanth, Syldra, Modified Whale, Modified Unkiu, Modified Shark, Modified Coelacanth, Modified Syldra | G, G, G, G, G, G, G, G, G, G | U2, U2, U2, U2, U2, U2, U2, U2, U2, U2 | G, G, G, G, G, G, G, G, G, G |

## The fuel allowance

For each allowance g the top priority may give up (fuel efficiency on), over the 201 scenarios:

- `L(g)`: mean share of the top priority's per-hour score given up, against fuel off, in percent.
- `E(g)`: mean gain in the top priority's amount per tank, against fuel off, in percent.

| g (%) | L(g) | E(g) | step cost (L) | step gain (E) | step pays (E gain >= L cost) | scenarios whose route changed |
| --- | --- | --- | --- | --- | --- | --- |
| 0 (fuel off) | 0.00 | 0.00 | | | | |
| 5 | 0.26 | 11.68 | 0.26 | 11.68 | yes | 48 |
| 10 | 1.21 | 16.52 | 0.95 | 4.84 | yes | 70 |
| 15 | 2.61 | 18.21 | 1.41 | 1.70 | yes | 83 |
| 20 | 3.49 | 20.99 | 0.87 | 2.77 | yes | 89 |
| 25 | 4.77 | 25.21 | 1.28 | 4.22 | yes | 94 |
| 30 | 6.70 | 28.80 | 1.93 | 3.60 | yes | 104 |
| 35 | 8.02 | 31.85 | 1.32 | 3.05 | yes | 109 |
| 40 | 9.13 | 34.29 | 1.11 | 2.44 | yes | 111 |
| 45 | 9.97 | 36.09 | 0.84 | 1.80 | yes | 111 |
| 50 | 10.25 | 36.95 | 0.28 | 0.86 | yes | 111 |

**The rule, in one sentence:** the default allowance is the largest g up to which every step of 5 points bought at least as much extra gain per tank as it cost in lost per-hour score (`E(g) - E(g-5) >= L(g) - L(g-5)`, with fuel off as `E = L = 0`).

**Chosen numbers**

- Fuel allowance (`RECS.GIVE_UP`): no result from the rule: no knee: every step paid, so the rule would return 50 and no allowance is chosen. The shipped value stays at 10% until the owner decides.

The same rule on parts of the scenarios, to show where the answer comes from (first column: the scenarios used; "pays" lists the steps 5, 10, ... 50 in order):

| Scenarios | Count | Result | Steps that pay |
| --- | --- | --- | --- |
| all three | 201 | none (no knee: every step paid, so the rule would return 50 and no allowance is chosen) | y y y y y y y y y y |
| levelling and unlocking, ranks 1 to 130 (exactly the previous run's scenarios) | 122 | 10% | y y n y y y y y y y |
| levelling and unlocking, ranks 1 to 145 | 132 | none (no knee: every step paid, so the rule would return 50 and no allowance is chosen) | y y y y y y y y y y |
| gil only (ranks 20 to 145) | 69 | 15% | y y y n n n y y y y |

- Band between priorities (`RECS.BAND`): 5%, fixed (accepted by the table below).

## The band between priorities

Fuel off. The first priority is the scenario's lead (experience in a levelling scenario, new sectors in an unlocking one); the second is the other of the two (new sectors, or experience), in the scenarios where it can be live (181 of 201). Both columns are in percentage points of the best score any route reaches for that priority per hour; the gain is counted against a band of 0%.

| Band | Mean loss on the first priority | Mean gain on the second priority |
| --- | --- | --- |
| 0% | 0.00 | 0.00 |
| 2% | 0.12 | 2.01 |
| 5% | 0.87 | 3.51 |
| 10% | 2.43 | 6.06 |

Accepted at 5% when the second priority gains more than the first loses: 3.51 against 0.87, so accepted.

## What this does and does not show

- No step failed to pay, so the table gives no stopping point.
- **E and L are different units.** E is a gain in the amount per ceruleum tank; L is the share of the top priority's per-hour score given up. Comparing them (`E gain >= L cost`) puts a tank and an hour of that score on one scale, and the data gives no exchange rate between them, so "pays" is only the rule's word.
- **The next-slot stage is never measured.** Every scenario has 4 slots unlocked, so the stage that looks for the sector granting the next submarine slot (U1) has nothing to do in any of them.
- **The 95% per-tank filter was not tuned.** After the allowance, only routes within 95% of the best gain per tank stay (spec 4.4); that 95% is fixed, and no other value was tried.
- **Loot is left out.** Which items a player picks cannot be derived from data, so there is no loot scenario. The tables describe experience, new sectors and estimated merchant gil.

## What was left out, and why

- **Gil, still left out:** market prices (the gil scenario uses merchant prices only), the player's own voyage log (none is made up), and the price of a ceruleum tank (not in the data, so fuel stays counted in tanks). The gil figure is an estimate: what the second item of a survey is, is not in the community records, and the thresholds are the community's reading.
- **Loot:** which items a player picks cannot be derived from data, so no loot scenario was run.
- Times are "calculated, not yet confirmed" and experience is a floor (see the data's notes), so the tables describe how the rule behaves on the data, not what the game pays.
- Searches above 8 visitable sectors in a sea return the best route found, not a proven best, exactly as in the advisor.

