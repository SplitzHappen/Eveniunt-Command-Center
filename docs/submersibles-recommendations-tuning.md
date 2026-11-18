# Submersibles recommendations: how the default numbers were chosen

Written by `node tracker/tools/recs-tune.js --write` (spec section 4.6, item R4). Do not edit by hand: run the tool again. The file holds no dates or timings, so a second run writes the same text.

## What changed in this run

- The previous run measured 122 scenarios (levelling and unlocking, ranks 1 to 130, no gil) and its rule gave a fuel allowance of 10% and accepted the 5% band.
- This run adds rank 145 to the test fleet and a third scenario, *gil*, and measures it on estimated merchant gil per hour and per tank (the estimate of `drops.js`, from community drop records). It measures 201 of 211 scenarios.
- At rank 145 the Leveling stage is skipped, so a levelling scenario there has another lead and is not measured (the tables below show it).
- The rule is unchanged. Result on all three scenarios: no clear answer (no knee: every step paid, so the rule would return 50 and no allowance is chosen). The 5% band: accepted.
- What the new tables show: levelling and unlocking, ranks 1 to 130 (exactly the previous run's scenarios): 10%; levelling and unlocking, ranks 1 to 145: no clear answer; gil only (ranks 20 to 145): 15%; all three scenarios together: no clear answer. See "The same rule on parts of the scenarios" below.
- **The default allowance is the owner's choice: 15%.** It was chosen by the owner, informed by the gil-only result above (15%), and it is no longer the output of the rule over the whole fleet. Stored player values are not changed by it, only the default for a setting never changed.
- The shipped constants in this run: `RECS.GIVE_UP` = 15% (the owner's choice: they agree), `RECS.BAND` = 5%.

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

- Fuel allowance (`RECS.GIVE_UP`): **15%, the owner's choice**, informed by the gil-only result (15%). It is not the output of the rule over the whole fleet, which gives no clear answer (no knee: every step paid, so the rule would return 50 and no allowance is chosen).

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

## A fixed sample, re-run by the routine unit test

The scenarios below (levelling at rank 30, unlocking at rank 50, gil at rank 20; every class at that rank) are re-run by the unit test on every routine run and compared with these rows. Columns: the lead; g; share of the top priority's per-hour score given up (L, percent); gain per tank (E, percent); whether the route changed.

| Scenario | Rank | Class | Lead | g (%) | L | E | route changed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| gil | 20 | Shark | G | 5 | 0.00 | 7.42 | yes |
| gil | 20 | Shark | G | 10 | 4.03 | 138.36 | yes |
| gil | 20 | Shark | G | 15 | 4.03 | 138.36 | yes |
| gil | 20 | Shark | G | 20 | 4.03 | 138.36 | yes |
| gil | 20 | Shark | G | 25 | 4.03 | 138.36 | yes |
| gil | 20 | Shark | G | 30 | 4.03 | 138.36 | yes |
| gil | 20 | Shark | G | 35 | 4.03 | 138.36 | yes |
| gil | 20 | Shark | G | 40 | 4.03 | 138.36 | yes |
| gil | 20 | Shark | G | 45 | 4.03 | 138.36 | yes |
| gil | 20 | Shark | G | 50 | 4.03 | 138.36 | yes |
| gil | 20 | Unkiu | G | 5 | 0.00 | 0.00 | no |
| gil | 20 | Unkiu | G | 10 | 0.00 | 0.00 | no |
| gil | 20 | Unkiu | G | 15 | 0.00 | 0.00 | no |
| gil | 20 | Unkiu | G | 20 | 0.00 | 0.00 | no |
| gil | 20 | Unkiu | G | 25 | 0.00 | 0.00 | no |
| gil | 20 | Unkiu | G | 30 | 0.00 | 0.00 | no |
| gil | 20 | Unkiu | G | 35 | 0.00 | 0.00 | no |
| gil | 20 | Unkiu | G | 40 | 0.00 | 0.00 | no |
| gil | 20 | Unkiu | G | 45 | 0.00 | 0.00 | no |
| gil | 20 | Unkiu | G | 50 | 0.00 | 0.00 | no |
| levelling | 30 | Shark | X | 5 | 3.13 | 31.79 | yes |
| levelling | 30 | Shark | X | 10 | 3.13 | 31.79 | yes |
| levelling | 30 | Shark | X | 15 | 3.13 | 31.79 | yes |
| levelling | 30 | Shark | X | 20 | 16.69 | 65.73 | yes |
| levelling | 30 | Shark | X | 25 | 16.69 | 65.73 | yes |
| levelling | 30 | Shark | X | 30 | 16.69 | 65.73 | yes |
| levelling | 30 | Shark | X | 35 | 16.69 | 65.73 | yes |
| levelling | 30 | Shark | X | 40 | 35.03 | 207.96 | yes |
| levelling | 30 | Shark | X | 45 | 44.14 | 243.81 | yes |
| levelling | 30 | Shark | X | 50 | 44.14 | 243.81 | yes |
| levelling | 30 | Unkiu | X | 5 | 0.00 | 17.79 | yes |
| levelling | 30 | Unkiu | X | 10 | 3.57 | 24.58 | yes |
| levelling | 30 | Unkiu | X | 15 | 7.51 | 28.05 | yes |
| levelling | 30 | Unkiu | X | 20 | 7.51 | 28.05 | yes |
| levelling | 30 | Unkiu | X | 25 | 19.87 | 43.08 | yes |
| levelling | 30 | Unkiu | X | 30 | 23.69 | 43.08 | yes |
| levelling | 30 | Unkiu | X | 35 | 31.67 | 111.26 | yes |
| levelling | 30 | Unkiu | X | 40 | 35.71 | 183.10 | yes |
| levelling | 30 | Unkiu | X | 45 | 35.71 | 183.10 | yes |
| levelling | 30 | Unkiu | X | 50 | 43.37 | 216.05 | yes |
| levelling | 30 | Whale | X | 5 | 0.70 | 25.38 | yes |
| levelling | 30 | Whale | X | 10 | 0.00 | 28.52 | yes |
| levelling | 30 | Whale | X | 15 | 7.26 | 36.30 | yes |
| levelling | 30 | Whale | X | 20 | 14.86 | 52.31 | yes |
| levelling | 30 | Whale | X | 25 | 14.86 | 52.31 | yes |
| levelling | 30 | Whale | X | 30 | 14.86 | 52.31 | yes |
| levelling | 30 | Whale | X | 35 | 31.75 | 124.89 | yes |
| levelling | 30 | Whale | X | 40 | 32.40 | 201.35 | yes |
| levelling | 30 | Whale | X | 45 | 38.38 | 236.43 | yes |
| levelling | 30 | Whale | X | 50 | 47.26 | 260.41 | yes |
| unlocking | 50 | Shark | U2 | 5 | 0.00 | 71.43 | yes |
| unlocking | 50 | Shark | U2 | 10 | 5.14 | 200.00 | yes |
| unlocking | 50 | Shark | U2 | 15 | 5.14 | 200.00 | yes |
| unlocking | 50 | Shark | U2 | 20 | 5.14 | 200.00 | yes |
| unlocking | 50 | Shark | U2 | 25 | 5.14 | 200.00 | yes |
| unlocking | 50 | Shark | U2 | 30 | 25.12 | 500.00 | yes |
| unlocking | 50 | Shark | U2 | 35 | 25.12 | 500.00 | yes |
| unlocking | 50 | Shark | U2 | 40 | 25.12 | 500.00 | yes |
| unlocking | 50 | Shark | U2 | 45 | 25.12 | 500.00 | yes |
| unlocking | 50 | Shark | U2 | 50 | 25.12 | 500.00 | yes |
| unlocking | 50 | Unkiu | U2 | 5 | 4.77 | 20.00 | yes |
| unlocking | 50 | Unkiu | U2 | 10 | 4.77 | 20.00 | yes |
| unlocking | 50 | Unkiu | U2 | 15 | 4.77 | 20.00 | yes |
| unlocking | 50 | Unkiu | U2 | 20 | 4.77 | 20.00 | yes |
| unlocking | 50 | Unkiu | U2 | 25 | 23.08 | 100.00 | yes |
| unlocking | 50 | Unkiu | U2 | 30 | 23.08 | 100.00 | yes |
| unlocking | 50 | Unkiu | U2 | 35 | 33.60 | 300.00 | yes |
| unlocking | 50 | Unkiu | U2 | 40 | 33.60 | 300.00 | yes |
| unlocking | 50 | Unkiu | U2 | 45 | 33.60 | 300.00 | yes |
| unlocking | 50 | Unkiu | U2 | 50 | 33.60 | 300.00 | yes |
| unlocking | 50 | Whale | U2 | 5 | 0.00 | 30.00 | yes |
| unlocking | 50 | Whale | U2 | 10 | 0.00 | 30.00 | yes |
| unlocking | 50 | Whale | U2 | 15 | 0.00 | 30.00 | yes |
| unlocking | 50 | Whale | U2 | 20 | 17.53 | 333.33 | yes |
| unlocking | 50 | Whale | U2 | 25 | 17.53 | 333.33 | yes |
| unlocking | 50 | Whale | U2 | 30 | 17.53 | 333.33 | yes |
| unlocking | 50 | Whale | U2 | 35 | 17.53 | 333.33 | yes |
| unlocking | 50 | Whale | U2 | 40 | 17.53 | 333.33 | yes |
| unlocking | 50 | Whale | U2 | 45 | 17.53 | 333.33 | yes |
| unlocking | 50 | Whale | U2 | 50 | 17.53 | 333.33 | yes |
| unlocking | 50 | Coelacanth | U2 | 5 | 0.00 | 71.43 | yes |
| unlocking | 50 | Coelacanth | U2 | 10 | 5.66 | 200.00 | yes |
| unlocking | 50 | Coelacanth | U2 | 15 | 5.66 | 200.00 | yes |
| unlocking | 50 | Coelacanth | U2 | 20 | 5.66 | 200.00 | yes |
| unlocking | 50 | Coelacanth | U2 | 25 | 20.89 | 500.00 | yes |
| unlocking | 50 | Coelacanth | U2 | 30 | 20.89 | 500.00 | yes |
| unlocking | 50 | Coelacanth | U2 | 35 | 20.89 | 500.00 | yes |
| unlocking | 50 | Coelacanth | U2 | 40 | 20.89 | 500.00 | yes |
| unlocking | 50 | Coelacanth | U2 | 45 | 20.89 | 500.00 | yes |
| unlocking | 50 | Coelacanth | U2 | 50 | 20.89 | 500.00 | yes |
| unlocking | 50 | Syldra | U2 | 5 | 0.00 | 0.00 | no |
| unlocking | 50 | Syldra | U2 | 10 | 0.00 | 0.00 | no |
| unlocking | 50 | Syldra | U2 | 15 | 0.00 | 0.00 | no |
| unlocking | 50 | Syldra | U2 | 20 | 0.00 | 0.00 | no |
| unlocking | 50 | Syldra | U2 | 25 | 0.00 | 0.00 | no |
| unlocking | 50 | Syldra | U2 | 30 | 0.00 | 0.00 | no |
| unlocking | 50 | Syldra | U2 | 35 | 0.00 | 0.00 | no |
| unlocking | 50 | Syldra | U2 | 40 | 0.00 | 0.00 | no |
| unlocking | 50 | Syldra | U2 | 45 | 0.00 | 0.00 | no |
| unlocking | 50 | Syldra | U2 | 50 | 0.00 | 0.00 | no |
| unlocking | 50 | Modified Whale | U2 | 5 | 0.00 | 30.00 | yes |
| unlocking | 50 | Modified Whale | U2 | 10 | 0.00 | 30.00 | yes |
| unlocking | 50 | Modified Whale | U2 | 15 | 0.00 | 30.00 | yes |
| unlocking | 50 | Modified Whale | U2 | 20 | 0.00 | 30.00 | yes |
| unlocking | 50 | Modified Whale | U2 | 25 | 18.01 | 116.67 | yes |
| unlocking | 50 | Modified Whale | U2 | 30 | 25.57 | 333.33 | yes |
| unlocking | 50 | Modified Whale | U2 | 35 | 25.57 | 333.33 | yes |
| unlocking | 50 | Modified Whale | U2 | 40 | 25.57 | 333.33 | yes |
| unlocking | 50 | Modified Whale | U2 | 45 | 25.57 | 333.33 | yes |
| unlocking | 50 | Modified Whale | U2 | 50 | 25.57 | 333.33 | yes |
| unlocking | 50 | Modified Unkiu | U2 | 5 | 0.00 | 0.00 | no |
| unlocking | 50 | Modified Unkiu | U2 | 10 | 6.09 | 20.00 | yes |
| unlocking | 50 | Modified Unkiu | U2 | 15 | 6.09 | 20.00 | yes |
| unlocking | 50 | Modified Unkiu | U2 | 20 | 6.09 | 20.00 | yes |
| unlocking | 50 | Modified Unkiu | U2 | 25 | 6.09 | 20.00 | yes |
| unlocking | 50 | Modified Unkiu | U2 | 30 | 25.18 | 100.00 | yes |
| unlocking | 50 | Modified Unkiu | U2 | 35 | 25.18 | 100.00 | yes |
| unlocking | 50 | Modified Unkiu | U2 | 40 | 38.87 | 300.00 | yes |
| unlocking | 50 | Modified Unkiu | U2 | 45 | 38.87 | 300.00 | yes |
| unlocking | 50 | Modified Unkiu | U2 | 50 | 38.87 | 300.00 | yes |
| unlocking | 50 | Modified Shark | U2 | 5 | 0.00 | 50.00 | yes |
| unlocking | 50 | Modified Shark | U2 | 10 | 0.00 | 50.00 | yes |
| unlocking | 50 | Modified Shark | U2 | 15 | 0.00 | 50.00 | yes |
| unlocking | 50 | Modified Shark | U2 | 20 | 0.00 | 50.00 | yes |
| unlocking | 50 | Modified Shark | U2 | 25 | 18.28 | 150.00 | yes |
| unlocking | 50 | Modified Shark | U2 | 30 | 18.28 | 150.00 | yes |
| unlocking | 50 | Modified Shark | U2 | 35 | 18.28 | 150.00 | yes |
| unlocking | 50 | Modified Shark | U2 | 40 | 18.28 | 150.00 | yes |
| unlocking | 50 | Modified Shark | U2 | 45 | 39.00 | 400.00 | yes |
| unlocking | 50 | Modified Shark | U2 | 50 | 39.00 | 400.00 | yes |
| unlocking | 50 | Modified Coelacanth | U2 | 5 | 0.00 | 30.00 | yes |
| unlocking | 50 | Modified Coelacanth | U2 | 10 | 0.00 | 30.00 | yes |
| unlocking | 50 | Modified Coelacanth | U2 | 15 | 0.00 | 30.00 | yes |
| unlocking | 50 | Modified Coelacanth | U2 | 20 | 0.00 | 30.00 | yes |
| unlocking | 50 | Modified Coelacanth | U2 | 25 | 20.10 | 116.67 | yes |
| unlocking | 50 | Modified Coelacanth | U2 | 30 | 20.10 | 116.67 | yes |
| unlocking | 50 | Modified Coelacanth | U2 | 35 | 34.72 | 333.33 | yes |
| unlocking | 50 | Modified Coelacanth | U2 | 40 | 34.72 | 333.33 | yes |
| unlocking | 50 | Modified Coelacanth | U2 | 45 | 34.72 | 333.33 | yes |
| unlocking | 50 | Modified Coelacanth | U2 | 50 | 34.72 | 333.33 | yes |
| unlocking | 50 | Modified Syldra | U2 | 5 | 0.00 | 0.00 | no |
| unlocking | 50 | Modified Syldra | U2 | 10 | 0.00 | 0.00 | no |
| unlocking | 50 | Modified Syldra | U2 | 15 | 0.00 | 0.00 | no |
| unlocking | 50 | Modified Syldra | U2 | 20 | 0.00 | 0.00 | no |
| unlocking | 50 | Modified Syldra | U2 | 25 | 0.00 | 0.00 | no |
| unlocking | 50 | Modified Syldra | U2 | 30 | 0.00 | 0.00 | no |
| unlocking | 50 | Modified Syldra | U2 | 35 | 0.00 | 0.00 | no |
| unlocking | 50 | Modified Syldra | U2 | 40 | 0.00 | 0.00 | no |
| unlocking | 50 | Modified Syldra | U2 | 45 | 0.00 | 0.00 | no |
| unlocking | 50 | Modified Syldra | U2 | 50 | 0.00 | 0.00 | no |

## Fingerprint

The key numbers of the whole run and a SHA-256 of every table row above (all lines that begin with `|`). The same block is written to `docs/submersibles-recommendations-tuning.fingerprint.json`. The routine unit test checks the document against it; `node tracker/tools/recs-tune.js --check` recomputes everything.

```json
{
  "ownerDefault": 15,
  "band": 5,
  "scenarios": 211,
  "measured": 201,
  "ruleAll": null,
  "ruleParts": [
    {
      "name": "levelling and unlocking, ranks 1 to 130 (exactly the previous run's scenarios)",
      "count": 122,
      "result": 10
    },
    {
      "name": "levelling and unlocking, ranks 1 to 145",
      "count": 132,
      "result": null
    },
    {
      "name": "gil only (ranks 20 to 145)",
      "count": 69,
      "result": 15
    }
  ],
  "bandAccepted": true,
  "tablesSha256": "414946afe8dfbc9bd7cf3622fd7368322b18b8edd50754506a32a62b02795aab"
}
```
