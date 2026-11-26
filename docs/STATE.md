# Where the Command Center stands

Last updated: 2026-11-24.

## Recently shipped

- **One look, step 2: the shared foundation** (shipped 2026-11-24, merged into `main` as `3f6c3fe`; this entry still read "waiting" until the Bourse plan noticed; pull request 8; spec `docs/one-look-foundation-spec.md`; mock-ups of
  step 1 in `docs/one-look/`). One header on all six pages (Home, Settings, Tracker, Atelier, Submersibles, Lists), built
  from one helper, with a tool slot that keeps the Tracker's search and clock and the Atelier's language menu; the
  module's own settings read "Tracker settings" and "Atelier settings", and the Tracker's own "Menu" reads "Index". One
  shared stylesheet (`tracker/src/app/one-look.css`, every class `ol-`) in the three builds, with the book-style section
  title, the Solve block, fields, buttons, the state block, the index line and the answer band for new modules. The
  Atelier now follows the app-wide theme choice (it read only its own stored choice; its own record is kept and used
  when no app-wide choice exists), and Electrope Skyline is defined once, in the Atelier's list of 21 themes. The drift
  check C196 and a unit test fail when a page's header, title, Solve block or fields differ or a module redefines a
  shared token; the design rules carry the owner's choices (M1, M6, C6, T1, T5, A1). The bodies of existing screens
  are unchanged and move later, one pull request each. Measured: full check 203 of 203 at `324f84c` (C26b not run);
  unit and browser tests and the hosted checks pass at `e14c747`. **Not tested:** Firefox, Safari, a real phone.
- **Lists, the crafting planner (blueprint phase 3; shipped 2026-11-24, owner's `ship`; pull request 7, merge `df139ee`).** The crafting planner that was taken back on
  2026-11-23 is rebuilt under the house style `docs/design-rules.md` (look spec `docs/lists-look-spec.md`; mock-ups
  `docs/lists-redesign/after/`; the screens as built, 1,440 px light and 360 px dark, are in
  `docs/lists-redesign/build/` and copied into the check's evidence as `lists-*.png`). Every crafter of an item is
  shown with its job icon, and gathering spots carry the game's node names and map coordinates. A red team and a
  pre-mortem (`docs/lists-redteam.md`) were fixed in steps R1 to R6: currencies to earn (tomestones, scrips and
  gemstones kept apart from the shopping totals), high quality (a per-material choice and one for every material),
  master books (the book name, stars and a "book not ticked" warning on a craft row), crystals in their own section,
  gathering grouped by zone with the spot chosen along the route, vendors grouped by city, "Copy name", submarine and
  airship parts as project lists with one step per phase, and patch safety (a written refresh checklist, a unit test
  that the game-data pins of Tracker, Atelier and Lists match, and the data version on the list head). An outside
  look and code review (ChatGPT and Mistral, sixth round, rulings in `docs/lists-code-review-adjudication.md`) was
  fixed in F1: prices by quality, phone rows with the node kind and area, spearfishing node names, sub-heads with room
  and unclipped focus rings (the hosted failure at `ec24562`), and the smaller wording and look items listed there,
  each pinned by a check seen failing without its fix (new checks C190 to C195). After the owner found the computer
  screens one colour per section (2026-11-24), look v2 (`docs/lists-look-v2.md`) put the section and job heads on the
  theme's dark bar with one small colour block, and gave each row its own state (can be done now, some in hand with a
  progress line, waiting, done); C160 now accepts every tone of the six roles, and the new check LV2 pins the row
  states. The owner chose to ship this look now and restyle Lists with the whole app afterwards (see Next). The first publish
  of the merge was refused by the Pages service ("Deployment failed, try again later"); one fresh run of the publish
  workflow on `main` succeeded the same morning. Measured
  at `f80b87e`: unit tests all passing, browser tests all passing, full check 202 of 202 (the real push delivery,
  C26b, cannot run from a session and was not run).
  **Not tested:** Firefox, Safari, a real phone, a real two-device sync, the live price service (Universalis).
  **Known limits:** vendors that need reputation still say "buy"; the master-book warning reads the Tracker's ticks and
  not its "does not apply" mark; a project list's stamp ("Submarine part") is matched by the list's name; the phases
  of a project are numbered because the game gives them no names; sync questions shown in the Tracker name Lists items
  by number, because the Tracker does not load the Lists data (to be fixed after shipping); the window length of a
  timed node keeps Teamcraft's minutes (labelled "Teamcraft" on the row); offers that differ only in a later currency
  share one saved choice; job icons are single-colour game shapes.
- **Submersibles: the pull request of 17 to 21 November** (shipped 2026-11-21, owner's `ship` after five outside review rounds; specs in `docs/submersibles-*.md`). Its parts:
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
  - **Submersibles: the new look** (built 2026-11-18, revision 4 on 2026-11-19; `docs/submersibles-look-spec.md`). The
    whole module restyled to match the shell, Tracker and Atelier. Colour goes by role: 27 roles, listed for every
    theme in `docs/submersibles-colour-roles.md` (generated; a test fails when it is out of date). Roles with a meaning
    (rank, gil, loot, route, the statuses, the seven seas, the chart's markers) keep the same hue in every theme;
    page, panel, text and accent come from the theme. The Board is a fleet timeline on one shared time axis; the Log is
    a ledger by day; Earnings is a leaderboard on one scale; every screen that can be empty has an empty state in the
    theme's colours; the Map has a sea chain and a chart where no label meets a mark. A check fails if any colour on a
    pictured screen is outside the roles. Screenshots of every screen in three themes and at phone width:
    `tracker/command-center/evidence/look-*.png`. Browser checks C97, C103 to C112, C114, C115 and the evidence block
    L1.
  - **Submersibles: gaps against the original design** (built 2026-11-18; `docs/submersibles-design-gaps-spec.md`). The
    planner lists what a route can bring and says why a sector cannot be taken; every figure is labelled game data,
    calculated, learned or community estimate; alternatives say how they differ from the plan; part advice appears only
    when Gil Farming leads or a build is stuck; "Send all back" for the whole fleet; which free companies to show; a
    rank-up plan per submarine; earnings by submarine; the return sheet asks which sectors a voyage revealed, offering
    only the ones it could have. By the owner's decision the sea map stays read-only and there is no availability
    window. Discoveries can also be ticked in a list in Setup, where one press marks or clears a whole sea. Browser
    checks C100 to C102.
  - **Submersibles: fixes from two reviews** (built 2026-11-19). The market-price fetch no longer loops when the price
    service fails or leaves an item out: one automatic attempt per 15 minutes per price place and per device (the attempt record is kept in device
    storage next to the price cache, so a reload or a second tab honours it; Refresh ignores it), a plain message on
    failure that says whether the last known market prices or only merchant prices are shown, and a fetch time per item
    (C113, C117). The Setup form writes only what the player changed in it, on top
    of what is saved at that moment, so it no longer undoes a discovery, a slot, a rank or a voyage recorded since it
    was opened, and a free company removed elsewhere stays removed (C116, C120, C121). The Board's one-second tick no
    longer rebuilds advice (C118).
  - **Saves: a free company changed in two places at once is combined** (built 2026-11-19;
    `docs/submersibles-merge-spec.md`, with the owner's decisions). Discoveries recorded for one free company on two
    devices or in two tabs are combined and a sync never removes a sector; when both sides changed the slot count differently the higher is kept, and a count changed on one side only is taken as that side set it; a question is
    asked only when the name, the world or the linked character differ, and it says what differs. No stored field
    changed; a device still on the old version behaves as before. `save.js` and `merge.js` changed, so the Tracker, the
    Command Center and the Atelier were rebuilt. Browser checks C119 and C122.
  - **Submersibles: one rule set for stale writes and moved submarines** (built 2026-11-21;
    `docs/submersibles-integrity-spec-2.md`, with the owner's decisions: refuse a second save of a submarine changed in
    another tab, leave a moved submarine out of the sync's slot question, the proposed wording). The store refuses a
    stale write that would leave a submarine without its company, bring back a submarine or logged voyage removed
    elsewhere, undo a slot another page rearranged, or save a submarine over another tab's change to it, each with a
    plain "Not saved on this device: ..." line. A sync no longer asks about a submarine both devices hold in different
    slots and never removes it by a slot answer. The Setup form writes a submarine where another tab saved it and says
    so; a refused write's recovery cancels an edit scheduled during its re-read. A permanent randomized model test
    (`tracker/tests/subs-model.test.js`, in `npm run test:unit`) states the rules for both models. Unit tests SI-1 to
    SI-8, browser checks C134 to C140. `save.js` and `merge.js` changed; all three apps rebuilt.
    The page saves one write at a time; a follow-up save after a merged one is a stale write against what was sent, so the
    same rules check it, and a reload never replaces a change that is waiting for its save (unit tests in
    `tracker/tests/subs-page.test.js`, browser checks C143 and C144). A write in flight for 15 seconds shows "Still saving…".
  - **Fixes from two cross-family reviews** (built 2026-11-20; ChatGPT: fail, three serious findings; Mistral: pass,
    minor findings; `docs/submersibles-integrity-spec.md`, with the owner's decisions). A free company removed on
    purpose stays removed, also when the page had not heard of the removal (the store refuses the write); only a
    still-empty company that the automatic duplicate clean-up would remove again is saved back. A Setup form opened on
    an empty slot that was filled elsewhere uses the saved submarine and applies what was typed; the store refuses any
    write that would add a second submarine to a slot. A sync that finds three or more submarines in one slot asks one
    question for the slot; a save that already holds duplicates shows a notice on the Board with "Keep this one", and
    logged voyages stay in the history. `save.js` and `merge.js` changed; all three apps rebuilt. Also: a truthful
    price-failure message, the price attempt limit kept on the device, a plain reason when no priority can be served,
    larger phone tap circles on the chart, small text at 4.5:1 in every theme, less scrolling on the phone. Browser
    checks C123 to C127 and C132.
  - **Shared fixes** (built 2026-11-18 and 2026-11-19). Text on the accent colour now reaches 4.5:1 in all 21 themes,
    light and dark (Tracker, Atelier and Command Center rebuilt). The Atelier no longer reloads over a first-visit click
    on Command Center. A failing browser check no longer ends the whole check run, and `CHECK_ONLY=<ids> npm run check`
    runs single checks. The crafting solver's "next craft" button waits for a running solve; its resume test no longer
    depends on the test browser keeping storage across a reload.
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

Nothing.

## Next

0a. **The Bourse, the market module (blueprint phase 4; plan on pull request 10, branch `claude/loving-lamport-iy3cg1`).**
   Interviewed (three rounds, `docs/bourse-questions.md`), researched (`docs/bourse-research.md`), drawn twice (look v1,
   then look v2 toward Submersibles, `docs/bourse-look-spec.md`, `docs/bourse/`), build spec with 16 work items and a
   same-family red team (`docs/bourse-spec.md`). **Paused by the owner (2026-11-25) until one look for the whole app is
   settled** (item 0): the Bourse is then built straight into that look. No module code.

0. **One look for the whole app: step 3, settle the one look (owner, 2026-11-25).** The owner sees every module still
   looking like a different app (the bodies never moved after the shared foundation). Decided: pause the Bourse; draw screens both ways for the owner to pick from (done: `docs/one-look/v3/`, four
   candidates); **the owner chose B, Atelier-led** (book chapters, one ledger per section, leaders, figures at reading size,
   Submersibles' state colours, the answer band's blocks shown on the phone); then redraw every screen in
   the chosen look, change the house rules to match (the owner has since chosen dark capital section bars and the
   answer band's blocks on the phone, which change the 2026-11-24 choices), and move each module in its own pull request.
   **2026-11-25, owner: the Bourse in look B is approved; next is a pull request that writes look B into the house
   rules with its checks, then one pull request per module (Lists, Atelier, Tracker, Home and Settings, Submersibles),
   the Bourse last; an outside review (ChatGPT and Mistral) of the Bourse plan and look comes before any build, prompt
   `docs/bourse-review-prompt.md`, filed 2026-11-25 in the private Continuity repository as
   `ASG-20261125-bourse-plan-review-chatgpt-001` and `ASG-20261125-bourse-plan-review-mistral-001` (candidate: pull
   request 10 at `0df8781`); returned 2026-11-25: ChatGPT FAIL (2 blockers, 14 major), Mistral PASS (minor only); every finding accepted
   (`docs/bourse-review-adjudication.md`); spec and look corrected; owner's sixth round recorded; work items B0 and B1
   (facts only) ran and are committed (B0 report `docs/bourse/b0-report.md`; B1 saved replies and test); the second
   outside review was filed 2026-11-25 as `ASG-20261125-bourse-plan-review-chatgpt-002` and
   `ASG-20261125-bourse-plan-review-mistral-002` (candidate: pull request 10 at `f6610c6`); returned 2026-11-26:
   ChatGPT FAIL again (1 blocker: the optional "also add to I have in Lists" setting can lose a purchase when two
   devices sync; 16 major), Mistral PASS (minor only); every finding accepted except one part of the tax finding,
   rejected on the 139 saved listings (`docs/bourse-review-adjudication-2.md`); look, examples and saved replies
   corrected (`25bd63f`); spec corrected by the planning agent (29 work items, new section 16, same-family and
   unreviewed). Owner, round seven (2026-11-26): build the rule that keeps the Lists count and the purchases together
   (question 14 (a)); run a third outside review round on the corrections (question 15 (a)), filed as
   `ASG-20261126-bourse-plan-review-chatgpt-003` and `ASG-20261126-bourse-plan-review-mistral-003`. The Bourse stays
   paused until the plan passes; the one-look rules pull request can go on meanwhile. Returned 2026-11-26: ChatGPT FAIL
   (3 blockers: an older Tracker's "Erase everything" wipes every module of a version-2 save, confirmed in
   `storage.js`; the credit rule's limits; the cloud overwrite's approval), Mistral PASS on two claims found wrong in
   the code (`docs/bourse-review-adjudication-3.md`). Owner, round eight: keep building the credit rule; the erase fix
   is the Bourse work's first step (B29, 30 days before the version rises); a fourth round with both reviewers. Look
   corrected (`27d2897`); spec corrected (31 work items, section 17, same-family and unreviewed); fourth round filed as
   `ASG-20261126-bourse-plan-review-chatgpt-004` and `ASG-20261126-bourse-plan-review-mistral-004`; returned 2026-11-26:
   ChatGPT FAIL (4 blockers, 9 major), Mistral PASS (`docs/bourse-review-adjudication-4.md`). Owner, round nine: fix
   everything with the scope unchanged; a fifth round with both reviewers. Look corrected (`fb378e4`); spec corrected
   (D64 to D70, section 18, same-family and unreviewed); fifth round filed as
   `ASG-20261126-bourse-plan-review-chatgpt-005` and `ASG-20261126-bourse-plan-review-mistral-005`; returned 2026-11-26:
   ChatGPT FAIL (2 blockers, both in the Lists credit setting; 8 major), Mistral PASS
   (`docs/bourse-review-adjudication-5.md`). Owner, round ten: keep the setting; a sixth round with both reviewers.
   Look corrected (`80ac214`); spec corrected (D71 to D79, section 19, same-family and unreviewed); sixth round filed as
   `ASG-20261126-bourse-plan-review-chatgpt-006` and `ASG-20261126-bourse-plan-review-mistral-006`.**
   Earlier history of this item follows.
   **One look for the whole app** (owner, 2026-11-24: "this is ONE app so all the aesthetics of everything need to look
   cohesive"). An audit found four styles and four different page headers across Home, Tracker, Atelier,
   Submersibles, Lists and Settings, and the Atelier ignoring the chosen game theme. Step 1, mock-ups of the six
   screens in one shared style (`docs/one-look-spec.md`, `docs/one-look/`), is done and the owner chose, 2026-11-24:
   section titles in the Atelier's book style (Roman numeral, serif title, italic line) everywhere; every screen's main
   button as the Atelier's "Solve" block; Submersibles changes only its shared parts (header, company heads, fields,
   current tab), its lanes, state blocks and top summary stay. Next: plan the build (shared header, fields and buttons,
   the Atelier following the chosen theme, then one module per pull request, and a check that stops modules drifting),
   then the design-rules change these choices need. The owner sees this as "for now": once every module exists, one
   final pass makes sure the whole app fits together.
1. The owner's own checks, which no automated run covers: a real sync between two devices (one still on the version published before 2026-11-21), two tabs saving at the same moment, a pass on a phone, and a real push notification ("Send a test" in Settings).
2. Done 2026-11-18: the chart's orientation was compared with a game screenshot and matches; the built module was
   compared with the original design (kept outside this repository) and the gaps closed.
3. Not planned, by the owner's decision of 2026-11-19: combining a submarine's own record when it was renamed on one
   device and sent on the other (still asked between devices; the later save wins between tabs).

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
- A sync slot question whose answer keeps the side holding a submarine only one device has can remove a submarine both
  devices held in that same slot, as the question's text says (the earlier two-record policy, pinned by INT-C3).
- Page scheduling (the write timer, a write finishing while the player edits again) is covered by browser checks
  (C141 and C142), not by the model test.
- The default fuel allowance (15%) is the owner's choice; the tuning rule gives no single answer over the whole fleet.
- With the default ranking, a submarine below the top rank in a free company that has found everything is levelled
  before it farms gil, until the player moves Gil Farming up.
- A sync never removes a discovered sector (the owner's choice): a sector unticked on one device comes back if the
  other device changed the same free company before they met; the app says so and it can be unticked again.
- Reviews: several by Claude on Claude-built work (same-family), then five outside rounds: ChatGPT and Mistral on
  2026-11-20 (fail, pass), ChatGPT twice more (fail, fail), Mistral on 2026-11-21 (fail), and Mistral again on
  2026-11-21 (pass at commit `35e9ace`, with two notes; the one that mattered, a deferred reload on a blocked page, was
  fixed after that review and checked by tests only). Every serious finding was repaired and pinned by a test. Results:
  `.ai/assignments/ASG-2026112*-submersibles-pr2-*` in the private Continuity repository.
- A still-empty free company removed on purpose is treated like the automatic duplicate clean-up when another company
  of the same character would beat it in that clean-up (a non-empty one, or an empty one that sorts first): its old
  open Setup form can store it again, and a submarine added to it from a stale page is moved to that other company.
  Telling that apart from a clean-up would need a new stored marker. A company that would itself win the clean-up is
  never stored again, and a submarine added to it from a stale page is refused.
- The market-price attempt limit (one automatic attempt per 15 minutes) is per price place and per device for reloads
  and ordinary use of several tabs; two tabs that try at the same instant can each make one attempt.
- On a 360 px phone the closest sectors of two seas have tap circles of about 30 px.
- The crafting solver's resume test once found the test browser's storage empty after a reload; the cause was not
  found. The app saves on every step and the test now restores from what the page saved.
- Each recommendation control is stored on its own, so different controls changed in two tabs or on two devices are
  both kept. The same control changed in two tabs on one device takes the later change without asking, as every part
  of the save does.
- Not guarded by the new store rules (`docs/submersibles-integrity-spec-2.md` section 4): the Tracker's own save and the
  end of a Settings sync (refusing them would lose ticks), an old cached page (it writes by the old rules), and
  preferences or one logged voyage changed in two tabs (the later save wins). A save from an older build that already
  holds an orphan submarine (its company removed) can still have a plain Tracker save bring that removed company back
  through its unanswered question; nothing is deleted or orphaned and the Board and the next sync's question repair it
  (pinned by unit test SI-8; the randomized model's MT9 holds from a start with no orphan stored).
- No screen changes a saved submarine's slot, and only the duplicate clean-up changes its company, so the moved-submarine
  cases need a save changed outside the screens. After a sync two submarines can share a slot; the Board's "Keep this
  one" settles it and removes one.
- `check.js` check C26b (real push delivery) does not run in automated environments.
