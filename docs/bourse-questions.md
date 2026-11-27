# Bourse, the market module (blueprint phase 4): questions for the owner

Written 2026-11-24, before any research or design. "Market" was the working name; the owner named the module **Bourse** (question 1) and the files
were renamed. Every question has a suggested default, so "default" (or "all defaults") is a valid answer.
Answer by number, for example: "1 Bourse; 5 I world-visit a lot; everything else default".

What was read first: `CLAUDE.md`, `docs/STATE.md`, `docs/model-tiers.md`, `docs/design-rules.md`,
`docs/one-look-spec.md`, `docs/one-look-foundation-spec.md`, `tracker/src/app/one-look.css`, the foundation pictures,
`docs/lists-research.md`, the price and market parts of `docs/lists-spec.md`, the blueprint (Market row, rule CC-12,
phase 4), the shared price service `tracker/command-center/src/prices.js` and its two callers (Submersibles
`earn.js`, Lists `lists.js`), and the Tracker's own Market Board (`tracker/src/app/live.js`).

Three facts from that reading are behind some questions:
- There are three price fetchers today. Submersibles and Lists share one service (with different questions to it);
  the Tracker's Live → Market Board has its own, and its own shopping list kept on one device only (not synced).
- Lists counts the cheapest listing of any quality, so it cannot tell a high-quality price from a normal one; it
  shows "High-quality price unknown" instead.
- The app never reads the game. Anything about your own retainers or sales would be typed by hand.

## A. Name and place in the app

1. **Name.** The word appears as the big wordmark in the header (like ATELIER, LISTS) and in the page list.
   Options: *Market* (plain, what players say); *Bourse* (French "exchange"; pairs with Atelier); *Exchange*;
   *Comptoir* (French trading post; less known); *Bazaar*; *Ledger*; *Gil Ledger*; *Sapphire Avenue* (the name of
   Ul'dah's market in the game; ties the module to one city and to a game place name); *Mercantile*; *Counting House*.
   Default: **Market**. (If you want the Atelier's flavour, Bourse is the best match: short, fits the wordmark.)
2. **The Tracker's Live → Market Board page.** (a) The new module replaces it: that page becomes a link to the new
   module, and its shopping list is copied over once; (b) keep both; (c) keep things as they are. Default: **(a)**,
   as the Lists plan already foresaw.
3. **Scope of this round.** The blueprint pairs Market with Gathering in phase 4. Default: **Market only now**;
   Gathering gets its own round.

## B. How you use the market board today

4. **Where you play.** Which region and data center, and which home worlds do your characters have? Do all eight
   share one world? Default: **use what is already set in the Tracker and in each character** (I will read it from
   the app, not ask again).
5. **Travel.** Do you visit other worlds of your data center to buy? Other data centers of your region? Or stay home?
   Default: **visit worlds in my data center freely; other data centers only for big purchases**.
6. **Buying or selling.** Mostly buying materials, mostly selling, or both? Default: **both**.
7. **Why you craft.** Mostly for your own use (collections, gear), mostly for profit, or both? Default: **mostly my
   own use, sometimes for profit**.
8. **Your retainers' sales.** The app cannot see what your retainers are selling. Would you type in what you put up
   (item, quantity, price) so the app can tell you when you are undercut and keep a ledger of what sold? Default:
   **no, not in the first version**; you would check undercuts in the game.
9. **What you look up most.** Name up to three things you look up today. Default: **an item's price across worlds;
   what is profitable to craft; where to buy a list's materials cheapest**.
10. **Platform.** PC, PlayStation, or Mac? (On PC, "Copy name" pastes straight into the game's market search.)
    Default: **PC**.

## C. Other price tools

11. **What you use now.** Teamcraft, the Universalis website, Saddlebag Exchange, Garland Tools, in-game only,
    something else? Default: **Teamcraft and the Universalis website**.
12. **What you dislike in them,** and **what you would keep.** Free text. Default: **no strong views; follow the
    research** (I will gather the community's complaints, as for Lists).

## D. Screens and devices

13. **Which screens you would open most.** Pick up to three: an item's prices on every world; a profit ranking of
    crafts; a shopping trip that buys a list's materials world by world; an item's price history; a watch list.
    Default: **shopping trip, item prices, profit ranking**.
14. **Which device for which, and what the module opens on.** Default: **computer for profit and history; phone in
    hand at the market board for the shopping trip. It opens on the shopping trip when a list has items to buy on the
    market, otherwise on the item search**.

## E. Prices: place and freshness

15. **The default price place.** Your home world, your data center, or the whole region (every data center you can
    travel to)? Default: **my data center for the shopping trip and profit; the item screen shows every world of the
    region side by side**.
16. **When a price is too old.** Prices are what other players' game clients last reported, minutes to days ago.
    The age is always shown; past which age should a price be marked "old"? Default: **older than 12 hours is
    "old", older than 3 days is "very old" and not used for profit**.
17. **Fetching.** Fetch on opening a screen (one automatic try per 15 minutes per place and device, as Lists and
    Submersibles do now, plus Refresh), or only when you press Refresh? Default: **on opening, same rule**.
18. **Quantity-aware prices.** The cheapest listing may be 1 unit when you need 99. Should prices be worked out for
    the amount you need (walking up the listings), with a note when the cheapest is a single unit? Default: **yes**.
19. **Bait listings.** Ignore listings far below the usual price (often gone in minutes, or a lone unit)? Default:
    **never hide them; mark them "far below recent sales" and price the amount you need anyway**.

## F. Profit

20. **The sale price used for profit.** (a) The cheapest current listing minus 1 gil (what you would undercut to);
    (b) the middle price of recent sales (what actually sold); (c) both shown, ranked by one. Default: **(c), ranked
    by recent sales, with the current cheapest beside it**.
21. **Material cost.** Each material at its cheapest of merchant or market price? Materials you gather yourself: at
    their market value (what you could have sold them for) or free? Default: **cheapest of merchant or market;
    gathered materials at market value, with a switch to count them as free; crystals and shards at market price**.
22. **High quality.** Assume you sell high quality when an item can be high quality, with materials at normal-quality
    prices? Default: **yes; the item's high-quality and normal prices are both shown, never mixed**.
23. **Tax.** The market tax depends on the city your retainer sells from and changes over time (the community price
    site publishes the current rates). Default: **use the rate of a city you name; if none is named, use the highest
    current rate, so profit is never overstated**.
24. **What is ranked, and sales speed.** Gil per craft, or gil per gil spent (return)? (Gil per hour needs the craft
    time, which the app does not know.) And should crafts that sell less than once a day sink? Default: **gil per
    craft, with the return and the sales per day beside it; sink below one sale a day; never hide**.
25. **Which recipes are ranked.** All recipes, only those your characters can make now (levels and ticked master
    books from the Tracker), or a list you choose? Default: **those my characters can make now**.

## G. The shopping trip, fed by Lists

26. **Splitting by world.** Buy each item on its cheapest world, or fewer stops for a little more gil? Default:
    **fewest stops while paying at most 10% more than the cheapest split; a split stack across worlds when one world
    has too few**.
27. **Route order and other data centers.** Default: **home world first, then the other worlds of my data center by
    most items; other data centers left out, with one switch to include them (then visited last)**.
28. **What "done" means.** Ticking an item bought (all or part of the amount) also adds it to "I have" in the Lists
    list it came from, with Undo. Default: **yes**.
29. **Which lists feed the trip.** One list, several lists combined (as Lists' combined view), or every list of a
    character? Default: **the lists I choose, combined**.

## H. Price history

30. **How far back.** Default: **7 days of sales shown, 30 days when the price site has them**.
31. **How it is shown.** A small chart, a table of recent sales, or a line of figures (low, middle, high, sales per
    day)? Default: **the line of figures plus one small chart on the item screen**.
32. **Keeping history on the device.** Only what the price site gives at the time, or also a record of prices the
    app has seen? Default: **only what the price site gives; nothing stored** (the save stays small).

## I. Watched items and alerts

33. **A watch list** of items with a target price, synced with your save. Default: **yes**.
34. **Alerts** ("tell me when X is below N gil") can work only while the app is open in a tab. Default: **no alerts
    in the first version; the watch list marks what is below its target when you open it**.

## J. The look

35. **Which existing screens it should feel closest to.** The Atelier's book (serif titles, index lines with
    leaders, the Solve block), Submersibles' bold slabs and huge numerals, Lists' ledger, or Home? Default: **the
    shared "workbook": the Atelier's book for the item and profit pages, with Submersibles' bold answer slab on top
    of each screen**.
36. **What to avoid.** Default: **no stock-ticker look (no candlesticks, no red and green arrows as the only
    signal), no wide many-column tables, no pill badges or rounded cards**.
37. **Density.** Default: **dense on a computer (at least 8 rows in view, like the Board), one thing at a time on a
    phone**.
38. **The big answer of each screen.** Default: **item screen: the cheapest price now and where; profit: the best gil
    per craft; shopping trip: the total gil and the number of stops; history: this week's middle price against last
    week's**. Gil figures in the gold "gil" colour Submersibles already uses.

## K. Save and data

39. **What is kept in the shared save (synced between devices).** Default: **the watch list, the shopping trip's
    ticks, the profit settings and the price place; prices themselves never** (they stay on each device, as now).
40. **High-quality prices in Lists.** Once the shared price service can ask for prices by quality, Lists would show
    high-quality prices too instead of "unknown". Default: **yes, in the same pull request**.

## Answers (owner, 2026-11-24)

The owner asked to be interviewed interactively rather than answer the written batch, so the questions were asked in
five short rounds of multiple choice. Answers are given against the numbers above; where a round worded a question
differently, the answer is recorded as the owner gave it. Questions not asked in the rounds take their default and are
marked "default (not asked)"; the owner can change any of them.

| # | Answer |
| --- | --- |
| 1 | **Bourse.** |
| 2 | (a) The Bourse replaces the Tracker's Live → Market Board; that page becomes a link and its shopping list is copied over once, then syncs. |
| 3 | Default (not asked): the Bourse only; Gathering gets its own round. |
| 4 | Default (not asked): read from the Tracker's place setting and each character. |
| 5 | **The whole region**: the owner travels to other data centers regularly for the cheapest price. |
| 6, 7 | **All of the above**: buying, selling, crafting for own use and for profit. |
| 8 | Not in version one: no typed retainer listings, undercut watching or sales ledger. |
| 9 | All four screens matter: shopping trip, item prices, profit ranking, watch list and history. |
| 10 | **PC.** |
| 11 | Teamcraft, the Universalis website, Saddlebag Exchange and the in-game market board. |
| 12 | Not asked: follow the research. |
| 13 | **All four**: shopping trip, item prices, profit ranking, watch list and history. |
| 14 | Default (not asked): computer for profit and history, phone for the trip; opens on the trip when a list has market items. |
| 15 | Default (not asked), adjusted to answer 5: the region for the trip and the item screen; profit at the owner's home data center with the region beside it. |
| 16 | **The owner sets the limits in the module settings**; defaults are the looser pair: older than 1 day is "old", older than 7 days is "very old" and left out of profit. |
| 17-19 | Default (not asked): fetch on opening (one automatic try per 15 minutes per place and device, plus Refresh); prices for the amount needed; bait listings marked, never hidden. |
| 20 | (c) Both shown, ranked by the middle of recent sales, the cheapest current listing beside it. |
| 21 | Gathered materials at market value, with a switch to count them as free; cheapest of merchant or market; crystals at market price. |
| 22 | High-quality and normal prices always separate; profit assumes the high-quality sale when the item can be high quality, materials at normal price. |
| 23 | **This week's lowest city rate, and the app lists every city's rate for the week** so the owner can see whether to move retainers to another city. |
| 24 | Default (not asked): gil per craft, with the return and sales per day beside it; slow sellers sink, never hidden. |
| 25 | **All recipes** (what the characters cannot make yet is marked). |
| 26 | **All three ways, chosen by the owner**: cheapest whatever the stops, fewest stops, or a set trade-off; the owner picks which comes first and the threshold (default 10%). |
| 27 | **Fewest data-center hops, with the biggest savings first.** |
| 28 | **Both, chosen in the module settings; default: tick only** (a tick does not change Lists unless the owner turns that on). |
| 29 | Default (not asked): the lists chosen, combined. |
| 30, 31 | 7 days of sales (30 when available), a line of figures plus one small chart. |
| 32 | Default (implied by 31): nothing stored beyond what the price site gives. |
| 33, 34 | **A watch list with in-app alerts** (alerts fire only while the app is open in a tab; the screen says so). |
| 35 | The workbook mix: the Atelier's book with Submersibles' bold answer slab on top. |
| 36 | Avoid all four: stock-ticker look, wide tables, pills and rounded cards, small grey numbers. |
| 37 | Dense on a computer (at least 8 rows in view), one thing at a time on a phone. |
| 38 | **Show both in the mock-ups** (the proposed answers and a savings-led version); the owner chooses from the pictures. |
| 39 | Default (not asked): watch list, trip ticks, profit and Bourse settings, price place in the save; prices never. |
| 40 | Yes, in the same pull request: Lists shows high-quality prices. |

## Second round (owner, 2026-11-25), after the first mock-ups, the research and the spec

| Question | Answer |
| --- | --- |
| Approve the look? | **Change something**, on every screen: too busy, not bold enough, colours off, does not feel like one app. Closest existing screen: **Submersibles**. |
| Colours | **Submersibles' state colours** (green act now, blue next, amber waiting, hatched unknown, the accent for the main action) instead of Lists' market purple; gil gold only for gil bars, as on Earnings. |
| Section heads | **Draw both** (Submersibles' dark capital bars, and the book-style titles of the one-look rule) on the Trip screen; the owner chooses from the pictures. |
| Trip's big number | **A: the total to spend.** |
| Where prices are read (replaces answers 5 and 15) | **The whole travel area: North America (Aether, Primal, Crystal, Dynamis), Europe (Chaos, Light) and Oceania (Materia)**, because travel between North America and Europe is opening and Oceania is reachable; every figure the app can use should cover these seven data centers. The sale price for profit is read over the same area. |
| Travel area | **Exactly these seven data centers** (the owner: "there are only 7"; they match the app's own world list, `tracker/data/live.json`). |
| Another region on the trip | **Fewest region hops first**: grouped by region, then data center, biggest savings first in each; another region only when the saving beats the threshold. |
| A market listing is bought whole | **Yes, the whole stack.** |
| Where watch alerts run | **On every page of the app** (not the recommendation; a small price script and paced lookups on every page). |

## Third round (owner, 2026-11-25), after look v2

| Question | Answer |
| --- | --- |
| Approve look v2? | Not yet. The owner asked when the app will stop looking like several apps: "each module looks like a different app instead of one cohesive look because this also looks different from subs and from the atelier". |
| One cohesive look | **Settle one look first**: pause the Bourse build, redraw the existing screens and the Bourse in one look, approve it, change the house rules, then move each module (one pull request each) and build the Bourse straight into it. |
| Which look every module moves to | **A mix, drawn both ways**: two or three screens drawn Submersibles-led and Atelier-led; the owner picks from the pictures before everything is redrawn. |
| Trip section heads (look v2) | Dark capital bars (to be confirmed by the one-look choice above, since it changes the book-style rule of 2026-11-24 for every module). |
| Answer-band blocks on the phone | Show them (an exception to the phone's first-row limit, or a rule change, decided with the one look). |
| The downloaded single-file Tracker | Its Market Board points to the Command Center and shows no prices. |

## Fourth round (owner, 2026-11-25): the one look for the whole app

| Question | Answer |
| --- | --- |
| Which look every module moves to (A Submersibles-led, B Atelier-led, C lanes under book titles, D dark bars over ledgers; `docs/one-look/v3/`) | **B, Atelier-led** (the recommendation was D). |
| Consequences | The dark-bars Trip variant is withdrawn; the Bourse is redrawn in B (look v3). The answer band's blocks stay on the phone, as answered in round three. |

## Fifth round (owner, 2026-11-25)

| Question | Answer |
| --- | --- |
| Approve the Bourse in look B (look v3)? | **Approved.** The builder copies `docs/bourse/pictures/` and `docs/bourse-look-spec.md`, look v3. |
| Next step for the one look | **Rules, then module moves:** a pull request that writes look B into `docs/design-rules.md` (with the phone exception) and its checks; then one pull request per module (Lists, Atelier, Tracker, Home and Settings, Submersibles); the Bourse built last, straight into it. |
| Outside review before building | **Yes:** ChatGPT and Mistral through the assignment bus; prompt in `docs/bourse-review-prompt.md`. |
| Tax-rate fallback and ranking pace | The owner asked why tax rates would ever be unreadable (answered in the conversation: offline, the price site down or slowing the app, or a world nobody has reported lately). The 5% labelled fallback stays as a safety net; the ranking pace takes the recommended default (about 30 presses over a day). |

## Sixth round (owner, 2026-11-25), after the round-one outside reviews

| Question (`docs/bourse-spec.md` section 11) | Answer |
| --- | --- |
| 10. Old copies of the app | **(a) Old pages stop saving until reloaded** (the save becomes version 2; an older page refuses it with "Reload the page to update"). |
| 13. Fact-finding before the second review | **(b) Run work items B0 and B1 first** (a read-only report and real price-site replies saved as test files); the second review then judges facts. The session's network was given the price site for this (a personal environment, "Eveniunt Command Center"). |
| Phone rows with the answer band's blocks | **Keep the blocks, 3 resting rows** on Item, Profit and Watch on a phone; the house rule gets this exception written in with the one-look rules. |
| 5, 11, 12 | **All three recommendations:** the standing sentences as written; Lists says "before the 5% buyer's tax" beside its prices; one home world for the whole Bourse, switched in settings. |

## Seventh round (owner, 2026-11-26), after the round-two outside reviews

| Question (`docs/bourse-spec.md` section 11) | Answer |
| --- | --- |
| 14. "Also add to I have in Lists" when you use two devices | **(a) Build a rule that keeps count and purchases together** (after a sync the count is the player's own part plus every purchase that added to it; if the rule fails its tests, the setting is left out). |
| 15. A third outside review | **(a) Run a third round on the corrections only**, before any Bourse code; the one-look work can go on meanwhile. |

## Eighth round (owner, 2026-11-26), after the round-three outside reviews

| Question (`docs/bourse-review-adjudication-3.md`) | Answer |
| --- | --- |
| The optional "Also add to I have in Lists" setting, after the round-three findings | **Keep building it now** (the rule is corrected for the count limit, backups and codes, Undo on another device and fallback storage; if its tests fail, it is left out, as in round seven). |
| The old Tracker's "Erase everything" over a newer save | **Fold the fix into the Bourse work:** its first step, shipped well before the save version rises; no separate pull request now. |
| A fourth outside review after the corrections | **Yes, both reviewers** (ChatGPT and Mistral), before any Bourse code. |

## Ninth round (owner, 2026-11-26), after the round-four outside reviews

| Question (`docs/bourse-review-adjudication-4.md`) | Answer |
| --- | --- |
| How to go on after round four | **Fix everything and review again:** the plan keeps its scope (the Lists setting's rule included); all 15 findings are fixed; then a fifth outside round. |
| Who reviews | **Both reviewers** (ChatGPT and Mistral). |

## Tenth round (owner, 2026-11-26), after the round-five outside reviews

| Question (`docs/bourse-review-adjudication-5.md`) | Answer |
| --- | --- |
| The optional "Also add to I have in Lists" setting | **Keep it in this plan** (its five findings are fixed; it is still left out by itself if its tests fail). |
| How the corrections are checked | **A sixth outside round, both reviewers** (ChatGPT and Mistral). |

## Eleventh round (owner, 2026-11-26), after the third in-house red team

| Question (`docs/bourse-review-adjudication-5.md`, last section) | Answer |
| --- | --- |
| How to go on when in-house red teams keep finding new serious faults | **Keep red-teaming in-house:** fix, then a fresh check, repeated until one finds no serious fault; then the sixth outside round (both reviewers). Not chosen: sending round six now; a separate project for sync deletions first; pausing. |

## Twelfth round (owner, 2026-11-26), after the sixth in-house red team

| Question (`docs/bourse-review-adjudication-5.md`, last section) | Answer |
| --- | --- |
| The in-house checks stalled at 3 serious faults; two sat in the old-file checkpoint | **Simplify the move:** the old cloud file is read once, by the first device to update; every other device brings its own save when it updates; the checkpoint mechanism goes. Accepted cost: changes an older-app device makes after another device has updated reach the others only when that device itself updates. Then fix the remaining fault (an old open tab's sync record) and run another in-house check. |

## Thirteenth round (owner, 2026-11-27), after the seventh in-house red team

| Question | Answer |
| --- | --- |
| Who finishes the save-and-sync part of the plan | **ChatGPT redesigns it** (an owner override of the usual split, in which ChatGPT reviews and does not write plans): an assignment asks ChatGPT to write a fresh design for the save, merge, cloud and migration rules, with every finding so far as input; then the requester red-teams it in-house, and an outside review follows. Not chosen: the requester fixing the two narrow open faults and sending round six; Mistral writing it; pausing. |

## Fourteenth round (owner, 2026-11-27), after ChatGPT's save-and-sync design and its in-house red team

| Question (`docs/bourse-review-adjudication-6.md`) | Answer |
| --- | --- |
| The design (a history of edits with a record for every deletion) | **Adopt it; ChatGPT revises it** for the 6 major and 6 minor findings of the in-house red team; then an in-house check and an outside review. |
| A browser without room for the safety copy | **Save locally only:** it keeps working and moves data by backup file, with no cloud sync; updated apps never write the old cloud file. |
| Reading the old cloud file only once | **A record on the sign-in service**, in a free Cloudflare D1 database (one row per account; the owner creates the database once). Asked first: "would this record in the sign-in service be free?" Answer given: yes, on Cloudflare's free plan (D1: 100,000 row writes and 5 million row reads a day, 5 GB), with setup effort and the risk that the free plan changes. |
