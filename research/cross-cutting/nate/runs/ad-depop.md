# What did the ad-depop live runs establish?
Researched 2026-11-15 by Nate (Claude). Feature: harness, site Depop.

*Observed*: These are two runs of `node --no-warnings app/src/edge/harness/sites/depop/live.ts [query]`. Each used one anonymous Browser Use Cloud browser (timeout 2 min, stopped in a `finally`) and the adapter in `app/src/edge/harness/sites/depop/adapter.ts`. Images, media and fonts were blocked. No sign-in and no challenge happened. The shop is the seller of the first search result. Its handle stayed in memory and was not printed. This file is not a `scripts/runs.mjs` record.

| read | run 1 (q "carhartt hoodie"): count, ms | run 2 (q "levis 501"): count, ms |
|---|---|---|
| connect | 463 | 463 |
| search (page, Next flight) | 24, 1680 | 24, 1512 |
| read one listing (by-slug + extended) | 1, 739 | 1, 743 |
| still up (by-slug) | 1, 147 | 1, 175 |
| read_storefront (shop page + aggregates) | 1, 1044 | 1, 1241 |
| read_listings (products + sold) | 6, 573 | 41, 1253 |
| reviews (feedback) | 1, 458 | 4, 213 |
| search with no hits | 0 (ok []), 655 | 0 (ok []), 694 |
| whole run, to stop | 6198 | 7034 |

*Observed*: read_storefront returned followers, following, rating, review_count, sold_count, active_count and shop_id on both runs. Every read returned ok. Every row passed the manifest's required fields through `classifyRead`.

*Observed*: Recon earlier the same day used four cloud browsers. It found that plain Node fetch gets 403 on www and webapi, and that `/api/v3/search/products/` answers 410 with code 9001. It found no public sold search. The login page answered 200 and was only looked at. Six cloud browsers were used in total.

*Inferred*: Two runs give timings, not a p95. read_listings reads only the first page of 24 for each status. In run 2, 41 rows means the shop has more than 24 of one status.

*Not run*: The signed-in verbs (read_inbox, read_offers, read_orders, read_stats and all eight writes) need a linked account, and none is linked. Their tests run on synthetic fixtures marked as such.
