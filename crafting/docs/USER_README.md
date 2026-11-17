# Cosmic Crafting Solver — how to use it

Four files, one per destination: `cosmic-sinus-ardorum.html`, `cosmic-phaenna.html`, `cosmic-oizys.html`, `cosmic-auxesia.html`. Each one works on its own, offline.

## Open it

Double-click the file for the planet you are on. It opens in your browser (Chrome, Edge, Firefox or Safari; desktop, tablet or phone). Nothing is installed and nothing is downloaded; it needs no internet connection, server or account. Keep it on a second monitor or a tablet next to the game.

The tool is a manual assistant: it never reads the game or presses keys for you.

## Set up (once per class)

1. Tap your **class** (CRP … CUL).
2. Enter **Level, Craftsmanship, Control and CP** exactly as the character window shows them **with food and medicine active**.
3. Tick **Specialist** if that class is a specialist (enables Careful Observation, Heart and Soul, Quick Innovation), **Manipulation learned**, and **Cosmic tool phase 9+** if your tool is phase 9 or later (its Good-condition bonus is ×1.75).
4. Your stats are saved per class profile. Use **New/Rename** for several gear sets. Settings → **Export profiles** saves them to a file; **Import** loads them back (useful if your browser does not keep data for files opened from disk).

## Start a craft

1. Pick the **mission** (filter by rank, “Expert only”, or search by name or item).
2. If the mission has several recipes, pick the one you are crafting now.
3. Pick the **quality target** for this craft: Tier 1/2/3 for collectables (thresholds from the game data), the required quality for intermediates, max quality, or a custom number. Default: the highest tier.
4. Check the **special-action charges** (filled in from the mission) and how many crafts the mission needs. The solver spreads the charges over the crafts.
5. Choose **Reliable** (default: highest chance to hit the target) or **Fast** (fewer steps if the chance stays similar), then **Start craft**.

## Each step

1. Do the big **Recommended** action in game.
2. Look at the new condition the game shows and **tap it** (or press its key: N Normal, G Good, E Excellent, P Poor, C Centered, S Sturdy, L Pliant, M Malleable, R Primed, O Good Omen, B Robust). One tap per step.
3. For actions that can fail (Hasty Touch, Rapid Synthesis, Daring Touch) there is a second row for **failed** (or hold **Shift** with the key).
4. If you used something else, press **I used a different action…** (or **A**), pick it, then report the condition.

The line under the action explains why it was chosen. “Simulated chance” is the share of simulated crafts that reached your target if you follow the advice from here; it is an estimate (see limits below) and tends to be on the low side.

Material Miracle runs on a 45-second clock in game; the tool shows a countdown. If it is off, fix it under **Correct state**.

## Fix mistakes

- **Undo** (or **U**, Ctrl+Z): steps back one report, as many times as needed.
- **Correct state**: set progress, quality, durability, CP, condition, buffs, Inner Quiet, charges or the Material Miracle seconds to what the game shows. The correction itself can be undone.
- **Restart craft**: same mission and settings, fresh craft.
- **Change setup**: back to missions and stats.
- **Action history**: every step with its gains and the condition you reported.
- If the page is closed or reloaded, the craft in progress is restored (when the browser allows saving).

When the craft ends, **Next craft** keeps the mission's remaining charges and counts the craft.

## Limits you should know

- **Mission score:** the game data gives the bronze/silver/gold score thresholds but not how many points one crafted item earns. The tool aims at the quality target you choose for each craft; it does not compute the mission score.
- **Condition odds** are community estimates; two tools disagree. Settings lets you switch between them. Simulated chances depend on them.
- **Material Miracle:** which of its six conditions appears is assumed to be equally likely.
- **Lower levels:** rank D/C/B missions scale to your level; ranks A and above need level 100.
- The data is from game version 7.57 (October 2026). A later patch that changes recipes needs a rebuilt file.
