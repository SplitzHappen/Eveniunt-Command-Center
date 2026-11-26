# Saved Universalis replies (work item B1 of docs/bourse-spec.md)

Asked once each on 2026-11-25 from `https://universalis.app/api/v2/`. Names of retainers, buyers and creators (and the
retainer, seller and creator ids) are removed. Each item is trimmed to 5 listings and 10 sales (`capped-item` keeps its
60 listings; sales trimmed to 10); the count fields (`listingsCount`, `recentHistoryCount`) are the reply's own.
The test `../../bourse-replies.test.js` reads only these files.

Limit headers: none of the replies carried a `Retry-After`, `RateLimit` or `X-RateLimit` header (only `cf-ray`,
`cache-control: no-store` and similar). The service answers a one-id request with the item itself, not wrapped in `items{}`.
Two first tries (`region-batch`: 504, `world-one-item`: 502, gateway errors) were asked a second time after 3 seconds;
the saved files are the second, 200, answers.

| File | Exact path asked (after `/api/v2/`) | Status | Limit headers | Size before trimming (bytes) |
| --- | --- | --- | --- | --- |
| region-two-items | `North-America/44162,44166?listings=60&entries=20` | 200 | none | 53,477 |
| region-europe-two-items | `Europe/44162,44166?listings=60&entries=20` | 200 | none | 52,227 |
| region-oceania-two-items | `Oceania/44162,44166?listings=60&entries=20` | 200 | none | 9,593 |
| region-batch | `North-America/44162,44166,44001,5?listings=60&entries=20` | 200 (after a 504) | none | 110,112 |
| world-one-item | `Gilgamesh/44162?listings=60&entries=20` | 200 (after a 502) | none | 6,877 |
| world-batch | `Gilgamesh/44162,44166,44001,5?listings=60&entries=20` | 200 | none | 55,900 |
| slim-two-items | `North-America/44162,44166?listings=0&entries=40` | 200 | none | 17,376 |
| history-one-item | `history/North-America/44162?entriesWithin=2592000` | 200 | none | 36,089 |
| item-all-listings | `North-America/44162?listings=300&entries=0` | 200 | none | 49,730 |
| capped-item | `North-America/5?listings=60&entries=20` | 200 | none | 29,741 |
| tax-rates | `tax-rates?world=63` | 200 | none | 114 |
| unknown-item | `North-America/999999999?listings=60&entries=20` | 404 | none | 162 |
| unknown-place | `Nowhereland/44162?listings=60&entries=20` | 404 | none | 162 |
| hq-filter | `North-America/44162?listings=60&entries=20&hq=true` | 200 | none | 26,716 |

Real request names for the three regions: `North-America`, `Europe`, `Oceania` (each answered 200 and echoes its name in
`regionName`). An unknown item and an unknown place both give 404 with the same body shape (`status`, `title`, `type`; the request trace number removed),
so the two cannot be told apart by the reply. World id 63 is Gilgamesh (from `/api/v2/worlds`).

## Fields of spec section 3 marked [verify]

| Field | Found or missing | Fallback taken |
| --- | --- | --- |
| `listings[].quantity` | found (integer) | none needed |
| `listings[].total` | found; equals price x quantity in all 734 listings checked | none needed |
| `listings[].tax` | found (integer) | none needed (the 5% computation stays the spec's fallback) |
| `recentHistory[].hq` | found (boolean) | none needed |
| `recentHistory[].timestamp` | found (seconds) | none needed |
| `recentHistory[].worldName` | found (also `worldID`) | none needed |
| `recentHistory[].quantity` | found | none needed |
| `worldUploadTimes` | found on region replies (world id to milliseconds; 5 worlds in Oceania); not present on a world reply, where `lastUploadTime` is the world's time | none needed for regions |
| `listings=60` caps per item | found (60 listings returned, `capped-item`) | none needed |
| `listings=300` accepted | found (134 listings returned, no error) | none needed |
| unit of every time | `lastUploadTime` and `worldUploadTimes`: milliseconds; `recentHistory[].timestamp`, history `entries[].timestamp`, `listings[].lastReviewTime`: seconds | none needed |
| `minPriceNQ`, `minPriceHQ` | found, also with `listings=0` | none needed |
| slim `recentHistory[].hq`, `.timestamp`, `.worldName` | found | none needed |
| history endpoint `history/{region}/{id}?entriesWithin=` | found: `entries[]` with `pricePerUnit`, `hq`, `quantity`, `timestamp`, `worldName`, `worldID` (230 entries in 30 days for item 44162, NA) | none needed |
| `tax-rates?world=` | found: one rate per city (8 cities), a whole number | none needed |
| unit of a rate | whole percent (5, 3, 0) | none needed |

Nothing is missing, so no fallback of the spec was used.

## The tax model (D36), measured

- Unit of a city rate: percent as a whole number (`Limsa Lominsa: 5`, `Ishgard: 3`, `Crystarium: 0`), not 0.05.
- `total` does not include `tax`: `total` = `pricePerUnit` x `quantity` in all 734 listings and 200 sales checked.
- `tax` is rounded down: of 338 listings near 5% where the exact tax had a fraction, `floor` matched all 338, `round` 112,
  `ceil` none. The tax is an integer. One listing from `retainerCity` 4 had about 2.8%, consistent with a 3% city (the
  city-number to name mapping is an assumption, not read from the reply).

## Redaction boundary (2026-11-26, after the round-two outside review)

Removed from every saved reply when it was saved: retainer, seller, buyer and creator names and ids. Removed afterwards
(finding R20 of the second outside review): every listing number (`listingID`) and the request trace number (`traceId`)
of the error replies; no test needs them. What remains is market data only: prices, quantities, quality, times, the world
and the retainer's city number. `bourse-replies.test.js` checks every key of every saved file, at any depth, against an
allowed list (numeric keys such as item and world numbers are allowed), with a control proving the check refuses an
unexpected key.
