# Notes on the pictures

One honest line per screen, read off the desktop pictures (1440 x 1000) by eye, the bold test of design rules section 12.
Pictures: `<screen>-<1440|360>-<theme>-<mode>.png`, four sheets (`sheet-*`), and the Q1/Q2 variants
(`<screen>-1440-crystarium-dawnglass-light-caps.png`: capital headings and capital seal word). Figures are fixture
examples; the default theme is `crystarium-dawnglass`. `measures.json` holds every measure and the failures.

- Home: bold at the top (slab with three state blocks, ledger of four module blocks in four hues); still tame in the lower
  half, where Cosmic Exploration and On the way are two plain index lists with a lot of paper under them.
- Tracker: bold (slab with 45, 16 and 46,095, the Done and Started blocks in Social); still tame: four closed chapters of
  identical "0%" heads, because the fixture save has ticks in only one folder; the real figures are all there is.
- Atelier: bold (100% numeral, four kind blocks, the Solve seal); still tame in the lower half, which is a form of
  underlined fields and then a plain list; the work ledger shows one step, as the real solve gives.
- Submersibles: bold (1D 3H slab, solid and outlined and hatched lanes); closest to the approved board; the company heads
  now sit on paper, so the page is lighter than the approved one, as the spec warned.
- Lists: bold (slab with 1673, 221, 4766; green and gold ledgers with solid blocks); the rows repeat one anatomy, so the
  middle reads uniform, but the three states (solid, outlined, done) and the have-some line break it up.
- Settings: still tame: a form on paper under a slab whose only answer is "Not signed in"; one seal button and six
  secondary buttons carry the page.

Measures that fail (also listed in `measures.json`):

- P3 on a 360 px phone, Tracker: the first ledger row starts 496 px under the header, because four closed chapter heads
  come before the one open chapter (Social).
- P3 on a 360 px phone, Submersibles: 517 px (limit 256): the slab, the control strip and the company head with five
  blocks stand before the first lane.

Measures worth knowing: the largest-text measure leaves out the wordmark and the chapter numerals (they are fixed words,
not answers). The "Ctrl Enter" hint on the Solve seal is in the body face, not Plex (a Plex word without a digit breaks T2).
