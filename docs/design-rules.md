# Design rules: the house style of the Command Center

Written 2026-11-23. Every module (Tracker, Atelier, Submersibles, Lists and any later one) follows these rules. They
are drawn from what the owner has already decided in earlier rounds; each rule names the round it comes from. A rule
marked **new** was first written here, to stop the fault named beside it, and becomes standing when the owner approves
the first mock-ups made under it (`docs/lists-look-spec.md`, item M1).

How this file was made: from the Submersibles look spec and its four owner rounds, the colour-role list, the design-gaps
spec, `docs/STATE.md`, the project's private decision record (restated here, not quoted by path), the styles of the
shell, Submersibles, the Tracker and the Atelier, the approved Submersibles pictures
(`tracker/command-center/evidence/look-*.png`) and the rejected Lists pictures (`docs/lists-redesign/before/`). Nothing
was built or run. Pixel figures about the Lists pictures were read off the pictures and are approximate.

**Amended 2026-11-28 for the one look (look B, Atelier-led; owner, rounds four to six of `docs/bourse-questions.md`):**
rules C6 (restated with its limits), C7, C8, T7, K9 and the phone exception P3a, each checked by a browser check named in
the rule (C197 to C202, `tracker/command-center/check.js`) that is shown failing on a deliberately broken copy of the
approved look-B pages before it is trusted. The limits were measured on the approved look-B pictures
(`docs/bourse/mock/`, look v3). The owner confirmed on 2026-11-28 that section heads stay book-style chapters (the dark
capital bars chosen for the Bourse's Trip in round three were withdrawn when look B was chosen in round four).

A rule is written so that a person or a check can say yes or no. "Check:" names how it is measured; "by eye" means the
bold test of section 12.

## 1. The family

| # | Rule | Why | From |
| --- | --- | --- | --- |
| M1 | One header on every page, made by one shared helper: the "Main menu" button (icon and word, 40 px), the wordmark, a tool slot for the page's own tools, the app's pages from 701 px with the current one underlined, and a double rule beneath. A module never draws its own masthead. Its own views stay in a tab bar: a left rail from 701 px, a bar fixed to the bottom on a phone. Check: the drift check. | The way back was "not properly labeled and … small"; the app is one place. | Main menu round, 2026-11-12; one look, 2026-11-24 |
| M2 | Square corners and the family's motifs only: the molten rule, the 25° slash, the double rule, the dashed ledger line, the inverted slab, graph paper. No pills, no rounded cards, no glass, no neon, no look taken from a component library. | These are what already reads as "the app". | Submersibles look, 2026-11-18 (first spec and revision 2) |
| M3 | One theme everywhere: the 21 themes, light and dark, and the Appearance settings (contrast, text size, motion) apply to every screen of every module. A module never sets a shared token. | "The main menu, the tracker and all of the other modules should have the exact same theme." | Main menu round, 2026-11-12 |
| M4 | The same thing is drawn the same way on every screen (a route, a status, a way of getting an item, a count). One helper draws it. | A thing that changes shape between screens reads as a different thing. | Submersibles look, revision 4, 2026-11-19 |
| M5 | Icons are drawn for the app: stroked SVG, no fill, round caps. Never a Unicode symbol or an emoji. An icon that navigates always has its word beside it. | Symbols are drawn by whatever font the device has. | Submersibles look, 2026-11-18; main menu round, 2026-11-12 |
| M6 | Shared parts come from the shared stylesheet: section title, main-action seal, fields, secondary and quiet buttons, state block, index line, answer band. A module adds layout only; it never restyles a shared part or defines a shared token. Check: the drift check. | A part restyled in one module is the drift the one look removes. | one look, 2026-11-24 |

**Who it binds (one look, 2026-11-24; look B, 2026-11-28):** M1 and M3 bind every page now. C6, C7, C8, M6, T7, K9, P3a
and the T1 and T5 changes bind every new module now (the Bourse is built straight into them) and each existing screen from
its move, one pull request per module in the owner's order (Lists, Atelier, Tracker, Home and Settings, Submersibles);
until then its body keeps its look. A module's move adds its screens to the pages that checks C197 to C202 measure.
**Open for the Submersibles move:** the 2026-11-24 choice kept Submersibles' lanes, state blocks and top summary; look B
was drawn on the Atelier, Lists and the Bourse, not on Submersibles. Whether the Board's fleet timeline (its one idea, C1)
becomes ledgers under C7 is asked in the Submersibles look spec; until the owner answers, the Board's lanes stay.

## 2. Composition

| # | Rule | Why | From |
| --- | --- | --- | --- |
| C1 | One composed view per screen: each screen has one organising idea, said in one sentence in its look spec (the Board is a fleet timeline; the Log is a ledger by day; Earnings is a leaderboard on one scale). A screen that is a stack of boxes in the order the code made them has no idea. | The owner called three rounds "AI bland-ish" until each screen had one. | Submersibles look, revision 4, 2026-11-19 |
| C2 | The answer first. The largest thing on a screen is a number or a state word of 28 px or more that answers the screen's question (what is back, what to get, how many). Controls come after the answer and are smaller than it. Check: by eye (bold test). | "Nothing is large, nothing has weight" was the first rejection. | Submersibles look, revision 2, 2026-11-18 |
| C3 | A row shows the name and the answer until it is opened. Explanations, reasons and less-used controls appear when the row is opened. | "This looks very visual diarrhea like. I need something a lot cleaner." | Tracker layout round, 2026-11-08 |
| C4 | Every head says its state: a count or a short summary at the right of the head, so a closed section still answers. | A head that only names its section makes the player open it to learn anything. | Submersibles look, revision 4, 2026-11-19 |
| C5 | A card earns its frame: a name, a live figure from the save and its state. Like things in a column are one bordered ledger with dashed separators, never a box per row; a few small boxes in an empty page are not a layout. Check: at 1440 px the cards or rows of a screen's main group span the content width. | Sparse cards and boxed rows were named in the Lists rejection; the main menu's first version was "generic AI slop" until its tiles carried live lines. | Main menu round, 2026-11-12; Submersibles look, 2026-11-18; Lists, 2026-11-23 (**new** as a check) |
| C6 | A section head is a book chapter (the shared `ol-chap`): a Roman numeral in Fraunces italic in the accent, the title in Fraunces 600 (never uppercase) with an italic line under it, the state summary at the right (C4), and a 2 px solid rule under the whole head. Never a dark capital bar. Every section title (`h2`) of a screen's content is one. Limits: no fill behind the head; the head at least 64 px high from 701 px (48 px closed) and 44 px on a phone. Check: C197, at 1440 and 360. | The owner chose the Atelier's book style for every section title, and look B keeps it. | owner Q1, 2026-11-24; look B, round four, 2026-11-25; confirmed 2026-11-28 |
| C7 | One ledger per section. The items of a section sit in one bordered ledger (2 px solid outer rule) right under its chapter head, rows touching, separated by 1 px dashed lines; a row has no frame of its own (a row in the act-now state may carry its state's 2 px inset frame). From 701 px a dotted leader (the shared `--leader`, at least 24 px wide) runs from the name to the row's figure; on a phone the figure sits under the name and the leader is dropped. Check: C198, at 1440 and 360 (leaders at 1440). | Look B: the Atelier's ledger and index lines, quieter than separate lanes; the owner chose it over boxed lanes. | look B, round four, 2026-11-25 |
| C8 | The answer band opens every module screen: the shared `ol-slab` at most 24 px under the header (or beside the module's rail), holding the screen's one huge figure in the display face 900, at least 96 px from 701 px and 52 px on a phone, and at least one state block counting the screen's states. Its blocks are shown on the phone too, at least 44 px high. Check: C201, at 1440 and 360. | C2 made concrete for look B; the owner kept the blocks on the phone. | look B, round four, 2026-11-25; round three, 2026-11-25 (blocks on the phone) |

## 3. Actions

| # | Rule | Why | From |
| --- | --- | --- | --- |
| A1 | One primary action per row, card, sheet and notice: the accent fill. It is the thing most often done next. Check: at most one primary inside each. The screen's one main action is the seal (T5); at most one seal per screen. | The Board's send action is the one loud control on a lane; everything else is quiet. | Submersibles look, revision 2, 2026-11-18; one look, 2026-11-24 |
| A2 | Every other action of a row lives in its "More": one control (a "⋯" button, or the row itself with a chevron) that opens a small menu or a drawer under the row. At rest a row shows at most the primary, the opener and, from 701 px, one stepper. Never more than two bordered buttons side by side, except a sheet's footer and a segmented control. Check: counted per row at 1440 px and 360 px. | Rows of bordered buttons were the first thing named in the Lists rejection. | Lists, 2026-11-23 (**new**) |
| A3 | A destructive action is never at rest beside the primary. It sits in More, in the error role, and asks before it acts. | A slip must not delete. | Lists, 2026-11-23 (**new**); the save rule "nothing is deleted without the player's choice" |
| A4 | Moving between views is the tab bar's job; going back is the masthead's and the rail's. A view is never reached by a loose button above the content. | The Lists pictures had "Your lists" and the three views as bordered buttons in the page. | Submersibles design, 2026-11-10; Lists, 2026-11-23 |
| A5 | A choice between two to four views or modes is a segmented control; the chosen one is the inverted slab. A link looks like a link (underlined text), a button like a button; a whole card may be the "open" action. | Controls that look alike but act differently have to be read one by one. | Submersibles look, 2026-11-18; main menu round, 2026-11-12 |
| A6 | Tap targets: at least 36 px; 40 px up to 700 px wide; a sheet's main action is 48 px high and full width on a phone. Keyboard focus is always visible and never clipped; no `clip-path` on anything that takes focus. Check: measured at 360 px. | Thumbs and keyboards. | Submersibles look, 2026-11-18 |
| A7 | Every window can be closed: a labelled close, a tap outside, and Escape. The one exception is a window that must be seen (a rescue of unreadable saved data). | "If i press something outside the active window, the active window should close." | Settings round, 2026-11-12 |

## 4. Forms

| # | Rule | Why | From |
| --- | --- | --- | --- |
| F1 | Settings are folded away. A screen at rest shows no text box or select that configures; those live in a sheet opened from one labelled control. The exception is a field that is the screen's purpose (the search that adds an item, the fields of a "create" screen). Check: at rest, visible text boxes and selects are only those the look spec lists as purpose fields. | The Lists list screen opened with a five-field form above every answer. | Lists, 2026-11-23 (**new**); Tracker layout round, 2026-11-08 ("rows show only the name until opened") |
| F2 | A setting that belongs to the whole app lives in the main Settings, not inside a module. | "The settings cannot just be inside the tracker." | Settings round, 2026-11-12 |
| F3 | Every box has a visible label at every width. A hint inside an empty box is a hint, not the label. | The character and free company boxes "are not properly labeled". | Main menu round, 2026-11-12 |
| F4 | Labels are in the body face (12 to 13 px bold, or 11 px uppercase bold). Never monospace. | Monospace labels were named in the Lists rejection. | Lists, 2026-11-23 (**new**); Submersibles look, 2026-11-18 (type roles) |
| F5 | A count the player types is a stepper: minus, the figure, plus; the figure in the data face; each part 40 px on a phone. | "Large −/+ buttons for thumbs." | Submersibles design, 2026-11-10 |
| F6 | The value of a folded setting that changes what the screen shows is readable at rest, in the head's state line. | A hidden setting must not hide why the screen looks as it does. | Submersibles look, revision 4, 2026-11-19 |

## 5. Status and notices

| # | Rule | Why | From |
| --- | --- | --- | --- |
| S1 | A status message is a slim line with `role="status"`: one line of text (two at most on a phone), an accent edge, never the shape of a button. What it offers (Undo) is a text link inside it. Check: it is not a `button`, is at most 44 px high for one line, and has no four-sided button border. | Status messages styled as buttons were named in the Lists rejection. | Lists, 2026-11-23 (**new**) |
| S2 | One status place per screen, in a fixed spot that does not push the content: above the bottom bar on a phone. | A message that moves the rows makes the next tap miss. | Lists, 2026-11-23 (**new**) |
| S3 | An error or a refusal is the note form in the error role, with its words. Never colour alone. | A state told by colour alone is lost on some eyes and themes. | Submersibles look, revision 3, 2026-11-18 |
| S4 | A notice that wants an answer is a note block with its sentence, at most five lines before "show all", and one primary. | A wall of lines above the answer hides the answer. | Lists, 2026-11-23 (**new**) |
| S5 | A figure says where it comes from when sources differ (game data, calculated, learned, community estimate). A figure the app does not have is shown as unknown, never as 0. Decoration says that it measures nothing. | The app never presents an invented number as game data. | Submersibles design gaps, 2026-11-18; Submersibles look, 2026-11-18 |

## 6. Type

Five faces are shipped, in these weights only: Big Shoulders Display 900; Cinzel 700; Fraunces 400, 600, 900; Atkinson
Hyperlegible 400, 700; IBM Plex Mono 400, 600.

| # | Rule | Why | From |
| --- | --- | --- | --- |
| T1 | Each face has one job. Display (Big Shoulders, uppercase): fixed app words, answer numerals and state words. Kicker (Cinzel, uppercase, spaced): the small line over a head. Fraunces: section and page titles, names the player or the game supplies, window titles, the main-action seal. Body (Atkinson): everything read, labels, buttons. Data (IBM Plex Mono): figures. | A face used for everything says nothing. | Submersibles look, 2026-11-18; one look, 2026-11-24 |
| T2 | Monospace is for figures only: counts, times, countdowns, prices, codes and routes. Never a label, a sentence, a button, a name or a section title. In a sentence with a number, the sentence is in the body face. Check: every visible piece of text in the data face holds a digit, and no label, button, select or heading uses it. | Monospace labels were named in the Lists rejection. | Submersibles look, 2026-11-18; Lists, 2026-11-23 (**new** as a check) |
| T3 | Sizes: reading text 15 px, small text 13 px, nothing under 12 px except uppercase bold labels at 11 px. | Legibility on a phone. | Submersibles look, 2026-11-18 |
| T4 | Instructions use the second ink; the faintest ink is for decoration and disabled things only. | The faintest ink fails contrast as reading text. | Submersibles look, 2026-11-18 |
| T5 | Buttons are sentence case in the body face, bold. The screen's one main action is the seal: the accent fill with an inner frame and its word in Fraunces 900 italic, 64 px high (48 px on a phone). | Shouting buttons crowd the answer. | Submersibles look, 2026-11-18 (as built in revision 2); owner Q2, 2026-11-24 |
| T7 | Figures at reading size. A row's figure (its gil, count, time or price) is IBM Plex Mono 600 at 15 to 20 px (17 px as drawn on a computer); the figure's label beside it is in the body face. Inside a row nothing is drawn in the display face except the word or count of its state block: big display figures belong to the answer band (C8) only. Check: C199, at 1440 and 360. | Look B: figures at reading size; the big display answers of look A stay in the answer band. | look B, round four, 2026-11-25 |
| T6 | Ask only for shipped weights. The display face has one weight, 900. | A missing weight is faked by the browser and looks wrong. | Submersibles look, revision 4, 2026-11-19 (finding) |

## 7. Colour

| # | Rule | Why | From |
| --- | --- | --- | --- |
| K1 | Colour goes by role. Every colour on a screen is one tone of one named role (field, text on a field, graphic, coloured text, wash). No raw colour outside the module's token block. Check: a unit test over the style sheet and a browser check over the pictured screens. | "Divide where coloring goes … then you just have a list with all the colors … for each theme." | Submersibles look, revision 4, 2026-11-19 |
| K2 | The theme owns the page, the panels, the text, the slab, the accent and the molten gradient. | That is what makes a theme recognisable. | Submersibles look, revision 4, 2026-11-19 |
| K3 | A role with a meaning has one hue in every theme; the theme reaches it through lightness and strength only. | Gil was gold in one theme and rose in another. | Submersibles look, revision 4, 2026-11-19 |
| K4 | A meaning is always also a word or a shape. | Colour alone is not enough. | Submersibles look, revision 3, 2026-11-18 |
| K5 | Contrast in all 21 themes, light and dark: text 4.5:1, meaningful graphics 3:1, ink on a wash 7:1. A unit test is the authority, not a hand figure. | Hand figures were wrong more than once. | Submersibles look, 2026-11-18 |
| K6 | Text on the accent is chosen by measured contrast. No text on the molten gradient. No hover filter on a surface that carries text. | Nine theme-and-mode pairs had unreadable button text. | Shared fix, 2026-11-18 |
| K7 | Not two or three colours. A screen that shows several kinds of thing shows several role hues, strongly apart, and still of the theme. Check: the hue-distance floors of the module's evidence block. | "You chose 2-3 and went to the market with those … AI slop/laziness"; "A LOT of contrast between colors while maintaining the same vibe of the chosen theme." | Submersibles look, revision 3, 2026-11-18 |
| K8 | A module's role list is generated by a tool into a document, and a test fails when the two differ. | A hand-kept table drifts. | Submersibles look, revision 4, 2026-11-19 |
| K9 | Submersibles' state colours, in every module. A state block (`ol-sb`) and a row take their colour from one shared state role only: green `ol-r-back`, can act now (buy here, cheapest, under target); blue `ol-r-out`, next or later; amber `ol-r-idle`, waiting (old price, above target); `ol-r-locked`, unknown or not possible yet, always hatched (and a hatched block is always locked); red `ol-r-bad`, a loss or a failure; ink `ol-r-slab`, done, a rank or neutral; the accent `ol-r-seal`, the one main action and rank 1; gold `ol-r-gil`, gil bars and gil ranks only. The kind roles (craft, gather, merchant, market, ready, short) never colour a state block or a row. A block's fill is the shared token of its role, never a module's own value. Check: C200, at 1440 and 360. | One meaning, one colour, across the whole app; Lists' market purple read as a different app. | Bourse round two, 2026-11-25; look B, round four, 2026-11-25 |

## 8. Density and the phone

Budgets P2 to P4 are **new** (2026-11-23). They answer "phone rows a screen tall" and are measured by a browser check.

| # | Rule | Why | From |
| --- | --- | --- | --- |
| P1 | No sideways page scroll at 360 px. | The narrowest phone in use. | Every look spec since 2026-11-10 |
| P2 | On a 360 px phone a list row at rest is at most 96 px high; opened, at most 360 px. | A row a screen tall shows one item at a time. | Lists, 2026-11-23 (**new**) |
| P2a | **Exception (2026-11-23, owner requirement "every crafter shown"):** on a phone, a craft or wanted row whose crafter strip holds 5 or more crafters may be up to 140 px at rest and 430 px opened; every other row keeps 96 px and 360 px. The icons keep their abbreviations. | The owner asked for all the crafters to be shown; eight of them in labelled icons cannot fit one 150 px line. | Lists, 2026-11-23 (R5 ruling) |
| P3 | On a 360 × 800 phone the first row starts at most 200 px below the masthead (256 px when the screen has a strip of steps or filters), and at least four rows at rest are in view (three with the strip). | The answer must be on the first screen. | Lists, 2026-11-23 (**new**) |
| P3a | **Exception (owner, rounds three and six, 2026-11-25): the answer band's blocks on the phone.** On a 360 × 800 phone, a screen that opens with the answer band and its blocks (C8) may start its first row up to 273 px below the header and show 3 rows at rest in view (counted wholly between the header and the first fixed bar at the bottom). A screen without the answer band keeps P3. Check: C202, at 360 × 800. | The owner kept the blocks on the phone; with them the first row starts at 257 to 273 px on the approved pages. | Bourse rounds three and six, 2026-11-25 (look v3 measures) |
| P4 | At 1440 px a list row at rest is at most 64 px high and at least eight are in view at 1440 × 1000. | The Board holds 32 submarines on one screen; density is a feature here. | Submersibles design, 2026-11-10; Lists, 2026-11-23 (**new** as a figure) |
| P5 | Where columns would overlap on a phone, show one thing at a time with a one-tap picker; stack, and place nothing wider than its container. | "On the phone the 1–8 columns overlapped." | Tracker phone layout, 2026-11-10 |
| P6 | Long content is closed at first and only open sections are drawn; a closed head is at least 44 px and says its count (C4). | Speed on large data, and a short first screen. | Lists spec, 2026-11-22 |
| P7 | Motion: transitions of about 0.12 s; loops only as decoration; nothing animates on a redraw; both reduced-motion rules of the family apply. | The motion setting is the player's. | Submersibles look, 2026-11-18 |
| P8 | Nothing is hidden under a fixed bar: the content ends above the bottom bar and the status line; a sheet's actions stay in reach. | A last row under a bar cannot be tapped. | Submersibles look, 2026-11-18 |

## 9. Empty states

| # | Rule | Why | From |
| --- | --- | --- | --- |
| E1 | A screen that can be empty has the full empty state, in the theme's colours: a kicker, a display headline, one sentence, up to three numbered steps, one primary action, and a decoration panel that is hidden from screen readers and invents nothing. | On plain empty screens: "it bothers me tremendously. They should be in harmony with the chosen theme." | Submersibles look, revision 4, 2026-11-19 |
| E2 | An empty part of a screen is the empty line: a dashed frame at least 48 px high with a sentence that says what to do. | The same reason, one size down. | Submersibles look, revision 4, 2026-11-19 |
| E3 | Never a lone sentence or a small box in a blank page. | That is the default the owner rejected. | Lists, 2026-11-23 |

## 10. Wording

| # | Rule | Why | From |
| --- | --- | --- | --- |
| W1 | The player's own words, sentence case, no jargon and no internal names. | The owner must be able to act from the screen alone. | Lists spec, 2026-11-22; project rules |
| W2 | Say it once. A sentence that would repeat on every row is said once per screen, as a foot note. | Repetition is noise. | Lists spec, 2026-11-22 |
| W3 | A control is named for what it does ("Main menu", "Send on this route"). | "Should be properly labeled." | Main menu round, 2026-11-12 |
| W4 | No generic or filler text; every sentence tells the player something they can use. | "I do not want generic or shallow text anywhere." | Tracker content round, November 2026 |
| W5 | The app says what it does not do where it matters, once: "You type what you have. This app never reads the game." | The app never automates or reads the game, and says so. | Lists spec, 2026-11-22 |

**64 rules:** family 6, composition 8, actions 7, forms 6, status 5, type 7, colour 9, density 8, empty states 3,
wording 5 (the exceptions P2a and P3a are not counted).

## 11. Anti-patterns, with the Lists screens as the worked example

The Lists module as first built (2026-11-22; pictures in `docs/lists-redesign/before/`) passed every test it had and
broke the house style on every screen. Figures are read off the pictures.

| What was on screen | Picture | Rule broken | What the rule asks for instead |
| --- | --- | --- | --- |
| A craft row with five bordered buttons in a line ("Made 1", "Made all", "Bought it", "Got it another way", "Solve in the Atelier") and a select under them | `lists-craft-*` | A1, A2 | One primary; the rest in the row's More |
| "Remove list" at rest beside "Open" on every card; "Remove" beside "Finished" on every wanted row | `lists-lists-*`, `lists-wanted-*` | A3 | Removal in More, with its confirm |
| "Your lists", "To get", "To craft", "Wanted" as loose bordered buttons above the content | all list pictures | A4, M1 | The rail and the bottom bar |
| A form always open above the answer: list name, character, new step, hide completed, order of ways, price place, refresh; about 520 px of a phone before the first row | `lists-get-phone-dark` | F1, P3, C2 | A head that says the answer and the state; one "List settings" control |
| "I have" box, minus, plus, "Have all" and a "Get it by" select open on every row | `lists-get-*` | C3, F1 | Name and answer at rest; the rest when the row is opened |
| A phone row about 460 px high (a screen holds less than two) | `lists-get-phone-dark` | P2 | 96 px at rest |
| "Undo: Chose how to get Mythril Bolt" and "Buy the rest too: on the market" drawn as bordered buttons at the top of the page | `lists-get-*`, `lists-left-*` | S1, S2 | A slim status line with a text link |
| "List name", "Character", "I have", "Get it by", the section heads, the totals sentence and the reason sentences in monospace | all | T2, F4 | Body face; monospace for the digits only |
| The largest thing on every screen is the wordmark; the counts ("26 to get, 10 to craft") are a 13 px sentence inside the form | all | C2, C4 | The counts as display numerals in the head |
| Two cards 290 px wide with two facts each in a 1440 px page, the rest empty | `lists-lists-desktop-light` | C5 | A group head with the character's totals; cards that fill the width and carry a live figure |
| One box with a border per row, in a box per section, in a box per screen | `lists-get-*` | C5, M2 | One ledger with dashed separators under a solid head |
| Pale washes with a thin edge for every meaning; the screen reads as one tint | `lists-get-*` | K7, C2 | Solid role fields for heads and count blocks |
| "No lists yet…" in a small dashed box in an empty page; "Set up your characters…" as a lone sentence with "Back" | `lists-empty-*`, `lists-log-*` | E1, E3 | The full empty state |
| "This applies wherever … needs this item." under more than one row | `lists-get-*` | W2 | Once per screen |
| No organising idea: every screen is the same stack of boxes | all | C1 | One idea per screen, said in the look spec |

Other defaults that are not the house style, whatever the module: rounded cards with soft shadows; pill buttons; a
grey "No data" box; icon-only buttons without a word; a settings page inside a module for something app-wide; a modal
that cannot be closed; a colour that means something only by being that colour; a table where a ledger or a timeline
would say more; centred text blocks under a centred icon; hairlines carrying the whole layout.

## 12. How a module's look is approved

**Adopted 2026-11-23:** the measured limits of this file (row heights, controls and primaries per row, the first row's distance
from the masthead, rows in view) are standing rules for every module, not only Lists (owner, answer to the Lists look spec's Q3).


Behaviour and look are planned, reviewed and checked separately. A module is not built before its look is approved.

1. **A look spec.** One document per module (`docs/<module>-look-spec.md`): for every screen, its one idea (C1), what is
   shown first, the row anatomy with sizes, where each action lives, how it folds at 360 px, and which colour roles it
   uses. It lists the purpose fields (F1) and any rule it asks to depart from, with the reason.
2. **Static mock-up screens in the real theme.** One page per screen, built from fixture data with real names from the
   pinned game data, loading the site's own fonts, shared styles and theme script. No behaviour. Screenshots at
   1440 px light and 360 px dark, with the measured figures of the checkable rules beside them. A figure that is an
   example (typed stock, a market price) is labelled as an example on the page.
3. **The owner approves from the screenshots**, before any implementation item starts. "Approved", or what to change;
   a change is drawn again, not argued.
4. **Every plan review and every code review prompt carries an appearance section.** It names this file, the look spec
   and the approved screenshots, and asks the reviewer to check each screen against the rules and report by rule
   number. A review without that section does not cover appearance and must say so.
5. **Browser checks measure the checkable rules** on the built module, at 1440 px and 360 px: controls visible per row
   at rest (A2) and primaries per row (A1); row height at rest and opened (P2, P4); where the first row starts and how
   many rows are in view (P3); no monospace outside figures (T2, F4); the status line's form (S1); no configuring field
   at rest (F1); every colour a role (K1); contrast (K5); no sideways scroll (P1); tap sizes (A6). The module's evidence
   block regenerates its screenshots on every run. The look-B checks C197 to C202 (C6, C7, T7, K9, C8, P3a) measure the
   approved look-B pages (`docs/bourse/mock/`, four screens) and every moved screen at 1440 and 360, in the default light
   theme and Azure Dragoon dark, and each is also run on a broken copy of an approved page (a dark capital bar, boxed
   rows, no leaders, display-size row figures, a kind colour or a module's own fill on a state block, the phone's blocks
   hidden, a small answer figure, a first row pushed below 273 px) that it must fail; a check that does not fail its
   broken copy fails itself. The drift check (M1, M6) injects one of every shared part into each
   live page and measures the header and the parts at 1440 px and 360 px: they must compute the same on every page.
6. **The bold test, by eye, on every regenerated picture** (from the Submersibles rounds): the largest thing is a
   number or a state word of 28 px or more; an inverted slab is in view; the heaviest line is 2 px or more and no
   hairline carries the layout; it does not read as a plain list, table or form. The builder writes one plain
   sentence per picture: "bold" or "still tame: <what>". "Still tame" is reported, never hidden.
7. **The owner sees the built screens before `ship`**, beside the approved mock-ups. A difference is listed, not
   explained away.

Changing a rule here is the owner's decision. A module that needs to depart from one says so in its look spec, as a
question to the owner with every option.
