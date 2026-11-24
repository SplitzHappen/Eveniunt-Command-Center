# Bourse: what other price tools get wrong, and what ours must do instead

Research for the Bourse, the market module (blueprint phase 4), done 2026-11-24 after the owner's answers
(`docs/bourse-questions.md`). The owner uses Teamcraft, the Universalis website, Saddlebag Exchange and the in-game
market board, and asked for nothing to be copied blindly: the method is the one used for Lists
(`docs/lists-research.md`).

## How this was gathered, and how far to trust it

- **Web search only, from summaries.** The session's network refused `universalis.app` (HTTP 403 from the proxy) and,
  as for Lists, direct fetches of issue threads were not made. Every point comes from search-result summaries, not from
  reading the full page. Nothing about Universalis could be tried live.
- **Trust levels used below:** *Official* (the project's own page or issue tracker, read through a summary);
  *Third-party listing* (API directories, wrappers; often old); *Guide* (game sites, blogs); *Code here* (this
  repository, read directly, the most reliable); *Memory* (what is known of the Universalis API from before, to be
  verified on the first build day and marked so in the spec).
- **Old issues.** Several Teamcraft issues are from 2020 to 2022 and may be fixed; they are lessons to design against,
  not claims about Teamcraft today.

## 1. Universalis: the only price source, and its limits

| Fact | Trust | Source |
| --- | --- | --- |
| Prices are crowd-sourced: a price is updated only when a player running an uploader plugin opens that item on the market board. Changing your own retainer's price does not update it. | Guide (Saddlebag), agrees with Universalis' own "about" page summary | [Saddlebag: updating price data](https://saddlebagexchange.com/blog/ffxiv/how-to-update-ffxiv-price-data-on-universalis), [Universalis about](https://universalis.app/about) |
| A listing seen as cheapest can be gone when you arrive ("lower than everything else, but when I hop it's not there"). | Guide (anecdote) | Reddit summary in search results |
| Rate limit about **25 requests a second (50 burst)** and **8 simultaneous connections per address**. One listing is about 1,700 days old. | Third-party listing, not confirmed | [publicapis.dev](https://publicapis.dev/resource/universalis/203ad1b6), [DeepWiki](https://deepwiki.com/Universalis-FFXIV/Universalis/2.1-market-data-api) |
| Endpoints: current data `GET /api/v2/{world, data center or region}/{up to 100 item ids}`; a lighter **aggregated** endpoint `GET /api/v2/aggregated/{place}/{ids}` with minimum prices, sales per day and recent purchases; **history** `GET /api/v2/history/{place}/{ids}`; **tax rates** `GET /api/v2/tax-rates?world={world}` (current rate per city on that world). | Third-party (DeepWiki reads the code), one example call | [DeepWiki](https://deepwiki.com/Universalis-FFXIV/Universalis/2.1-market-data-api), [api-evangelist](https://github.com/api-evangelist/universalis) |
| Each listing says its world, whether it is high quality, its quantity and price per unit; a reply says when each world was last uploaded. Lists and the Tracker already read `listings[].worldName`, `pricePerUnit`, `hq`, `recentHistory`, `regularSaleVelocity`, `lastUploadTime`. | Code here (`lists.js`, `live.js`); the rest Memory | this repository |
| Query parameters `listings`, `entries`, `hq`, `entriesWithin`, `statsWithin`, `fields` exist in some form. | Memory and wrappers, unverified | [universalis.js](https://npmjs.org/package/universalis.js) |
| No written terms of use or attribution rule was found. The app already credits Universalis on its pages and sends nothing but item numbers. | Not found | — |

**What it means for the Bourse.**
1. **Every price says its age and place** (rule CC-12); the age is the reply's own upload time for that world, not
   our fetch time. The owner's limits (default: 1 day "old", 7 days "very old" and left out of profit) apply to it.
2. **Region-wide is cheap per item**: one request for a region returns listings from every world, each tagged with its
   world, so the shopping trip needs one batch per 100 items, not one per world.
3. **"All recipes" is not cheap**: about 13,900 recipes, perhaps 10,000 sellable results, plus their materials, is
   100 or more batches per place. At a safe pace (well under the limit, at most 4 at once) that is a minute or more and
   a real load on a free community service. The profit ranking must fill progressively from a long-lived cache, start
   with what the owner filters to (a job, a level band), and never refetch all of it on a timer. This is the single
   biggest technical constraint and is handed to the spec as a decision.
4. **Quality is in the data**: listings carry `hq`, so high-quality and normal prices can be kept apart (owner answer
   22) and Lists can drop "High-quality price unknown" (answer 40).
5. **Tax rates per city are published per world**, so "this week's lowest rate, and every city's rate" (answer 23) is
   possible. The rate in a reply is a snapshot: the screen says when it was read.
6. **Being a good guest**: one shared price service, batches of 100, a cap on parallel requests, the 15-minute gate on
   automatic tries (already built), longer caches for slow-changing things (history, tax rates), no background polling
   except the watch-list alerts the owner asked for, which run only while a tab is open and at a slow pace.

## 2. Teamcraft's prices and profit

| Teamcraft limitation or request | Trust | Source |
| --- | --- | --- |
| Prices come from Universalis through a "pricing mode" on lists; profit figures are inexact on small servers with thin data. | Guide | [TheGamerCodex](https://thegamercodex.com/en/final-fantasy-xiv/tools/teamcraft) |
| Asked for: profitability in the Recipe Finder and a "basket optimiser" (cheapest way to buy a set of items), i.e. not there when asked. | Official (issue) | [#3140](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/issues/3140) |
| Universalis integration updated prices for the wrong server (2020). | Official (issue, old) | [#1451](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/issues/1451) |
| A price typed by hand in pricing mode did not carry to other lists (2022). | Official (issue) | [#2207](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/issues/2207) |
| Asked for: choose whether materials are costed at high-quality or normal vendor price (normal is the default). | Official (issue) | [#442](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/issues/442) |
| The automatic cheapest craft cost overrode a cheaper vendor price. | Official (issue) | [#543](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/issues/543) |
| Asked for: choose lowest, average or median price, and high or normal quality, in price-based guides. | Official (pull request; merged state unknown) | [PR #3324](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/pull/3324) |

**Ours.**
- **Every price names its place, world and age**; a price can never silently belong to another place (the cache is
  keyed by place, as `prices.js` already does).
- **Prices are never typed by hand** in version one (nothing to drift between lists); a price the app lacks is
  "unknown", never 0 (rule S5).
- **Material cost is the cheapest of merchant and market**, by quality, with gathered materials at market value and a
  switch for free (owner answer 21). A vendor price always wins over a dearer market price.
- **Sale price is shown both ways** (cheapest listing and the middle of recent sales) and ranked by sales (answer 20);
  low, middle and high are kept apart rather than one "price".
- **The "basket optimiser" is the shopping trip**: split by world with the owner's chosen priority and threshold
  (answer 26), grouped by data center with the biggest savings first (answer 27).

## 3. Saddlebag Exchange and other tools players use

| Tool | What players use it for | Lesson | Trust | Source |
| --- | --- | --- | --- | --- |
| Saddlebag Exchange | Reselling across worlds, market share (which items earn the most total gil on a server), craft profit simulator, undercut alerts; recommends current home-server minimum listings for crafting revenue; says raw sales figures beat its "demand" icon; some features paid | Show sales per day and total gil traded, not a vague demand score; profit at home with the region beside it | Official blog and wiki (summaries) | [Saddlebag TLDR](https://saddlebagexchange.com/blog/ffxiv/tldr), [craftsim](https://saddlebagexchange.com/blog/ffxiv/how-to-use-the-ffxiv-crafting-profit-simulator-craftsim), [wiki](https://github-wiki-see.page/m/ff14-advanced-market-search/saddlebag-with-pockets/wiki/TLDR:-How-to-earn-gil-with-cross-server-trading) |
| Universalis website | One item's listings on every world, history | Per-world comparison is the core screen; its many-column tables are what the owner asked to avoid | Guide | [Twinfinite](https://twinfinite.net/guides/ffxiv-universalis-explained/) |
| Ultros | Lists with market data, "undercut by one" price zones | Lists and market belong together | Official book | [book.ultros.app](https://book.ultros.app/print.html) |
| ffxiv.itinerare.net | Crafting and gathering profit tables per world | A plain table per world is the common default; ours is a ranked ledger with the answer first | Official page (title only) | [crafting](https://ffxiv.itinerare.net/crafting?world=lich) |
| Allagan Tools, Market Board plugins (Dalamud) | Retainer contents, undercuts, prices in the game | Read the game; the project never does (owner answer 8: no typed retainer listings in version one) | Guide | search summaries |

## 4. The game's own rules that the module must respect

| Rule | Trust | Source |
| --- | --- | --- |
| Market tax: Limsa Lominsa, Gridania and Ul'dah charge 5%; other cities can drop to about 3%, rarely 0%; rates change over time (no fixed weekly schedule found); the retainer vocate shows them in game. | Guide (wiki) and official forum | [Console Games Wiki](https://ffxiv.consolegameswiki.com/wiki/Market_Board), [forum](https://forum.square-enix.com/ffxiv/threads/358087-Taxes) |
| **Who pays the tax: both sides.** The buyer pays a flat 5% on top of the listed price; the seller loses the rate of the city where the retainer is placed (5%, or about 3% in a city with fewer retainers). Example: a 100,000 gil listing costs the buyer 105,000 and pays the seller about 95,000 (97,000 at the reduced rate). Found after the red team asked. | Guides (two recent, agree) and an official forum thread | [xivprofitability guide](https://xivprofitability.com/guides/ffxiv-market-board-guide), [timesaver.gg](https://timesaver.gg/blog/ffxiv-market-board-flipping-guide), [forum](https://forum.square-enix.com/ffxiv/threads/463574) |
| A market listing is bought whole: you buy the whole stack a seller put up, not part of it. | Game knowledge, not found in a source this session; the owner is asked to confirm | — |
| Visiting another data center: you **can buy** on its market board, but **cannot sell** or call retainers there. | Guide (several agree) | [Data Center Travel](https://ffxiv.consolegameswiki.com/wiki/Data_Center_Travel), [Inverse](https://inverse.com/gaming/final-fantasy-xiv-data-center-travel-use-restrictions) |
| Data-center travel is unavailable during maintenance and suspended 30 minutes before it; congested worlds can refuse or slow visitors (rules changed in Dawntrail patches; current state uncertain). | Guide, conflicting | [Siliconera](https://www.siliconera.com/new-ffxiv-data-center-travel-and-world-visit-regulations-added/), [Console Games Wiki](https://ffxiv.consolegameswiki.com/wiki/Data_Center_Travel) |

**Ours.** The trip groups stops by data center (answer 27) and says, once per trip, "you can buy on another data
center but not sell there; travel stops 30 minutes before maintenance". The Tracker already knows maintenance times
(`live.js` `maintNow`), so the trip can warn when a maintenance is near. Selling advice (profit, tax) always means
**your home world**, never a visited one. Congestion is not modelled: a stop on a congested world is the player's call.

## 5. What this repository already has (Code here, read directly)

- **Three price fetchers.** `prices.js` (shared: cache per place, 15-minute gate, one-hour freshness, batches of 100,
  `Promise.all` with no cap on parallel batches) used by Submersibles (average sale) and Lists (cheapest listing of any
  quality); the Tracker's Live → Market Board (`live.js`) fetches on its own with a 10-minute memory cache and keeps a
  shopping list in device storage only (`eveniunt-tracker-ui`, not synced). The owner chose that the Bourse replaces
  that page (answer 2).
- **Place.** The Tracker's place setting (data center, world, scope region/data center/world) is read by Lists and
  Submersibles from device storage; Lists hard-codes a region map of 12 data centers.
- **What the service cannot yet do:** keep several qualities or several worlds per item, read history or tax rates,
  cap parallel requests, or keep a long-lived cache for a ranking of thousands of items. The spec extends it; nothing
  is forked (brief, step 5).

## 6. What we will not copy

| Feature elsewhere | Why not | Ours instead |
| --- | --- | --- |
| Retainer listings and sales read from the game (plugins, Teamcraft desktop) | The project never reads the game | Nothing in version one (owner answer 8) |
| Uploading prices to Universalis | Comes from reading the game | Prices are only read |
| Paid or account-only features (Saddlebag's premium leads) | Needs a server | Everything on the device |
| A single "demand" score | Saddlebag itself says raw sales are better | Sales per day and the age of the data |
| Many-column listing tables | The owner asked to avoid wide tables | A ledger per world with the answer first |
