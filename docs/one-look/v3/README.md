# One look, step 3: A or B (comparison mock-ups, 2026-11-25)

The owner asked when the app would stop looking like several apps (round three, `docs/bourse-questions.md`) and chose to
settle one look first, drawn both ways before every screen is redrawn. These pages show the same three screens with the
same content and the same state colours (Submersibles' green, blue, amber, hatched; the theme's accent for the main
action) in two structures:

- **A, Submersibles-led:** dark capital section bars with a state strip, separate lanes with big state wedges, tracks
  (bars, listings), big display answers.
- **B, Atelier-led:** book-style chapters (Roman numeral, serif title), one ledger per section with dashed separators,
  small count blocks, dotted leaders, figures at reading size, index lines for reference lists (the Atelier's recipes).

Two mixes, drawn at the owner's request (same screens and content):

- **C, lanes under book titles:** A's lanes, wedges, tracks and big answers under B's book-style chapters.
- **D, dark bars over ledgers:** A's dark capital bars, state strips and answer band over B's quieter ledgers (dashed
  separators, small count blocks, leaders, figures at reading size).

`sheet-<theme>.png` shows A above B; `sheet-mix-<theme>.png` shows C above D.

All four keep the shared parts already built: one header, the answer band with one huge figure and state blocks, the seal,
fields, buttons, the theme.

Screens: the Atelier (a solved recipe), Lists (To get), the Bourse (Trip). `make.mjs` writes `mock/`, `shoot.mjs` writes
`pictures/` (1,440 px in Crystarium Dawnglass light, Azure Dragoon dark and Ul'dah Sultanate Gilt light, 360 px in
Crystarium Dawnglass dark) and one sheet per theme with A above B. No sideways scroll at 360 px in any picture; no page
errors. Not measured: the house-rule figures (row heights, rows in view), which apply once a look is chosen.

Found while drawing: in the shared stylesheet the job switcher (`ol-seg ol-jobs`) overflows a 360 px phone when its items
are links (a computer-width rule outranks the phone rule). No live page uses it yet; offered as a separate task.

Next: the owner picks A, B, C or D (or names a change); every screen is redrawn in it; the house rules (`docs/design-rules.md`) change
to match; each module then moves in its own pull request, and the Bourse is built straight into the chosen look.
