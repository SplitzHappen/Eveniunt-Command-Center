# Where the Command Center stands

Last updated: 2026-11-21.

## Recently shipped

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

- **Lists: the crafting planner (phase 3)**, built 2026-11-22 on pull request 4, spec `docs/lists-spec.md`, research `docs/lists-research.md`, review record `docs/lists-review-adjudication.md`.
  - Lists are kept per character, each with its steps. Each character has one stock, typed by hand.
  - Every row says "get it by". Gil merchants come first. "Bought it" can be used at any time, with undo.
  - Views: To get, To craft, Wanted, and a combined view for each character.
  - A list can start from the crafting log. The Tracker links to it (inside the Command Center only). "Solve in the Atelier" opens the recipe there.
  - Market prices come from one shared price service, also used by Submersibles. Timed nodes show their next window.
  - A notice appears when game data changes a list's recipe.
  - The save: a new `modules.lists` section. Older builds keep it. A sync never deletes a list or an item without the player's answer.
  - Reviews: one Claude review, plus ChatGPT and Mistral reviews of the plan. 35 findings were applied (20 and 15). The permanent model test found and fixed 2 more.
  - Tests: unit 570 of 570, browser 61 of 61, full check 171 of 171. C26b was not run (its browser push service is unreachable from the session).
  - Final code review by Claude (same model family, so not independent), 2026-11-22: ship after one fix. Fixed: the
    tests against the old build were pinned to the last build without Lists (31cb0ba), which would otherwise have turned
    the checks red after merging. Two notes kept as known limits (below).
  - Outside code reviews, 2026-11-22 (third round, owner's request): ChatGPT "do not publish", Mistral "publish after
    fixes". Seven findings accepted and fixed (W14), one accepted in part; `docs/lists-code-review-adjudication.md`.
    Totals after the fixes: unit 576 of 576, browser 61 of 61, full check 175 of 175 (C26b not run).
  - Review of the fixes, 2026-11-22 (fourth round, owner's request): Mistral "publish", ChatGPT "publish after
    fixes" (two fixes incomplete, two minor). All four fixed (W15). Totals: unit 577 of 577, browser 61 of 61, full
    check 179 of 179 (C26b not run). The owner's own checks (a real sync, two tabs, a phone) are not done.

## Decided, being planned

- **Lists** (blueprint phase 3): built and waiting for the owner's `ship`; see the entry under "Built, waiting for the
  owner's `ship`" above. The spec is `docs/lists-spec.md`.

## Module order (blueprint, owner decision of 2026-11-09, confirmed 2026-11-21)

| Phase | Modules | State |
| --- | --- | --- |
| 1 | Shell, one shared save, cloud sync | Shipped |
| 2 | Submersibles | Shipped 2026-11-21 |
| 3 | Lists (crafting planner) with "Solve in the Atelier" | Built, waiting for ship |
| 4 | Market (profit, shopping list split by world); Gathering (alarms, routes) | Planned |
| 5 | Currencies & Collectables, Levequests, Ventures & Voyages (retainers and airships) | Planned |
| 6 | Gear, Treasure Maps, desynthesis in the item details | Planned |
| 7 | Polish: share lists as links, a phone layout pass, a full audit | Planned |

## Next

1. The owner's own checks, which no automated run covers: a real sync between two devices (one still on the version published before 2026-11-21), two tabs saving at the same moment, a pass on a phone, and a real push notification ("Send a test" in Settings).
2. Done 2026-11-18: the chart's orientation was compared with a game screenshot and matches; the built module was
   compared with the original design (kept outside this repository) and the gaps closed.
3. Not planned, by the owner's decision of 2026-11-19: combining a submarine's own record when it was renamed on one
   device and sent on the other (still asked between devices; the later save wins between tabs).

## Parked by the owner

- A new app icon.

## Known limits

- Lists: an orphaned wanted item (left without its list by an old build's sync) that one device removed is removed by
  the next sync without a question when the other device holds it unchanged; the removal was the player's own action
  on that device (ChatGPT advised asking; ruled otherwise, Mistral agreed). The Restored list card's actions have no
  undo; Remove asks first.

- Lists: a page writing from an out-of-date copy wins a clash on the same stock count with another tab without a
  question (the rule every module uses; the page reloads on any change and when the tab is shown again). Undo is
  protected separately.
- Lists: a trade offer is identified by its seller, the amount it gives and its first currency; two offers that differ
  only in a later currency share one identity, and a stored choice takes the first.

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
- Lists: stock is typed by hand; retainers, alts and the free-company chest are whatever the player types.
- Lists: one way per item per character. An item cannot be crafted for one list and bought for another at the same time, except crafting-log entries, which are always crafted. Moving a list to another character puts it under that character's stock, ways and order.
- Lists: a craft's or purchase's spare output is shown but not planned with. Once recorded it is typed stock that everything uses, so before a multi-yield craft is recorded, another need of the same item can look larger than it will be.
- Lists: the character's totals never rise from a removal or from more stock. One list's or one step's own figures can, because a craft can move from one list's share to the next.
- Lists: collectables and crafting-log entries are always planned as crafts, even if a merchant sells the item; collectability ratings are not tracked.
- Lists: "I have enough of this" is the player's word; the amount shows as not in typed stock and is not checked.
- Lists: recording a craft the typed materials do not cover is allowed; the counts go to 0 and the page asks the player to check them.
- Lists: an item that is part of a loop is listed under Other and not planned further.
- Lists: yields are not cross-checked (the Atelier holds none). Market price is the cheapest listing of any quality, before tax, from community reports; it is not split by world (that is Market).
- Lists: "buy from a merchant first" looks only at whether a gil merchant sells the item, not at the price. An expensive merchant item is still planned as bought, with its price on the row and "Craft it instead" one tap away. The data does not say whether a merchant needs a quest or a housing plot, and does not mark allied-society NPCs, so a gil offer that needs allied reputation is planned like any merchant; the row names the seller and place, and a Grand Company rank when the data gives one.
- Lists: a trade is chosen by a fixed rule, not by cost for the amount; the row lists the other trades to choose from.
- Lists: a high-quality need goes to a merchant only for an offer marked high quality; whether a market listing is high quality is not checked.
- Lists: the patch notice compares recipes only, and only as far back as the first data file this app shipped.
- Lists: undo covers the last 20 changes of one visit, is gone after a reload, and is refused when the same thing was changed again since; a way can always be changed back by hand.
- Lists: "Left over" shows unused stock of items in this list's tree; it cannot know why the stock is there.
- Lists: the same unit changed in two tabs means the later save wins. A stock count changed on two devices is asked about.
- Lists: sync questions name the list and the character but show items by number, because Settings does not hold the item names.
- Lists: size limits stop new entries on a device; a sync can still bring a save above them, and nothing is dropped.
- Lists: a device still on the old version syncs lists unit by unit and by the old rules, so it can leave a kept list empty, an entry without its list, or delete on its own side what the other device changed. The new page shows entries without a list as "Restored list". This ends when every device has updated.
- Lists: the Tracker's link appears only inside the Command Center and only in an open group. With several characters the character is chosen in Lists, because the Tracker has no current character.
- Lists: timed nodes show the next window only; alarms belong to the Gathering module. Fishing windows are not shown.
- Lists: sources other than merchant, craft, gather, trade and market (drops, quests, desynthesis, reduction) are "Other": to get, your own way. Sharing a list by link or file is a later phase.
