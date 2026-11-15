# Every source lane that works, and the product's own search, on the same 16 products

Researched 2026-11-15 by Nate (Claude Code orchestrator, Fable). Feature: cross-cutting.

Run 2026-11-15, 12:31 to 12:45 UTC, from the Windows machine, on Nate's word: "revaluate and run competitive benchmarks on the areas we are considering done ... whatever is working" ([words](../../../../product/words.md#2026-11-15-nate-re-evaluate-and-benchmark-what-is-working-against-competitors)). Main at e93a5717. Nobody signed in, nothing intercepted, no challenge met. Every figure is *observed* in this one run unless marked; one run is not a distribution.

**What was asked.** Sixteen branded product queries (four clothes, four shoes, one electronics, four furniture, three small goods; the adaptation slice's branded side, for example "carhartt detroit jacket j97 brown large"), each sent once to every lane, each lane at its own pace (eBay one read every 10.5 s, Depop 3.5 s, Poshmark and Dupe 3.2 s). Only counts, seconds, match shares and price quantiles were kept: no listing row was written to disk.

**"On target"** is a crude, uniform measure made for this run: of a lane's first ten rows, the share whose title holds at least 60% of the query's words. It rewards literal titles and says nothing about condition or price. Depop's search rows carry no title, so its titles are read from the listing's address and score low for that reason.

## 1. The lanes, raw

| Lane | Answered | Rows in all | Rows a query, median | Fields a row, median | Seconds, p50 | Seconds, p95 | On target, first ten | Cost |
|---|---|---|---|---|---|---|---|---|
| eBay, our page read in the cloud browser | 16 of 16 | 2,727 | 158 | 17 | 7.97 | 9.41 | 0.87 | browser minutes, not read back |
| Depop, our page read in the cloud browser | 16 of 16 (11 with rows) | 205 | 10 | 9 | 1.07 | 2.54 | 0.38 | browser minutes, not read back |
| Poshmark, our plain page read | 11 of 16 (5 empty) | 528 | 48 | 15 | 0.75 | 1.26 | 0.75 | none |
| Dupe, the licensed search interface | 16 of 16 | 636 | 40 | 11 | 2.42 | 11.14 | 0.72 | none |
| Google Shopping through treg (Serper) | 16 of 16 | 592 | 40 | 8 | 1.09 | 1.84 | 0.65 | $0.032 for 16 |
| eBay through the Apify actor (5 queries) | 4 of 5 (1 blocked) | 32 | 8 | 11 | 18.59 | 47.17 | 0.94 | about $0.10 (*inferred* from the actor's earlier measured price) |
| Facebook Marketplace through the Apify actor (5 queries) | 5 of 5 | 40 | 8 | 9 | 6.09 | 15.46 | 0.17 | about $0.20 (*inferred*, same basis) |
| A plain request to eBay's search page (3 queries) | 0 of 3 | 0 | | | 0.09 | | | none |
| A plain request to Depop's search page (3 queries) | 0 of 3 | 0 | | | 0.01 | | | none |

Both plain requests were refused with 403 every time: that is what a tool without a browser lane gets from those two sites.

Rows a query by kind of product (median; in brackets, queries that returned rows):

| Lane | Clothes | Shoes | Electronics | Furniture | Small goods |
|---|---|---|---|---|---|
| eBay | 240 (4/4) | 134 (4/4) | 217 (1/1) | 80 (4/4) | 129 (3/3) |
| Depop | 24 (4/4) | 24 (4/4) | 4 (1/1) | 0 (0/4) | 0 (1/3) |
| Poshmark | 48 (4/4) | 48 (4/4) | 48 (1/1) | none (0/4) | 48 (2/3) |
| Dupe | 40 (4/4) | 40 (4/4) | 40 (1/1) | 40 (4/4) | 40 (3/3) |
| Google Shopping | 40 (4/4) | 40 (4/4) | 32 (1/1) | 22 (4/4) | 40 (3/3) |

## 2. The product's own search, as a visitor gets it today

The same 16 queries through `POST /v1/search` on the dev server, 12:41 to 12:45 UTC, read back from the job.

| Measure | Value |
|---|---|
| Answered | 16 of 16 |
| Settled, seconds | p50 1.48, p95 2.86 |
| Sources that returned rows, mean | 1.7 of the 5 asked (Poshmark and Dupe; Depop and eBay answered `no_route`, Mercari needs an account) |
| Listings found, then kept | 1,125 found, 510 kept (45%) |
| Dropped, by reason | wrong item 452, duplicate 118, bundle 38, spam 7 |
| On target, first ten | 0.82 |
| Product resolved | 0 of 16 |

Furniture and two of the three small goods were answered by Dupe alone, with 4 to 25 listings kept.

## 3. What it says

- **eBay is the lane that carries the most, and it is not in the product.** Our own read returns about 170 rows a query at 17 fields, on target 0.87, for every kind of product including furniture. It is the slowest lane at 8 s here, slower than the 5 s measured alone this morning (*inferred* cause: five lanes sharing the machine and one cloud session; the search lead's speed work is row SR7).
- **Against the paid eBay actor, our read is faster, wider and more reliable.** 16 of 16 against 4 of 5; 158 rows a query against 8 asked of it; 8 s against 19 s at the median and 47 s at the tail. The actor's first rows are slightly more literal (0.94 against 0.87). This supports keeping our read first and the actor behind it.
- **The product's filter earns its place.** Its two raw sources score 0.75 and 0.72 on target; what it keeps and ranks scores 0.82, after dropping 452 listings as the wrong item. It settles in 1.5 s.
- **Coverage is the gap, not speed or ranking.** A visitor gets 1.7 sources. Composing the two browser lanes (row SR1) would add the widest lane and the only other one with furniture.
- **Poshmark and Depop do not cover furniture or most small goods**; eBay, Dupe and Google Shopping do. Facebook Marketplace rows are local and loose (0.17 on target): useful shown, weak as comps.
- **Asking prices differ by lane for the same query**, which is why raw rows cannot price an item. For the Aeron chair the median ask was $144 on eBay (parts and accessories share the query), $674 through Dupe and $824 new on Google Shopping; for the Carhartt jacket $244, $275, $390, $239 and $300 across eBay, Depop, Poshmark, Dupe and Google Shopping. The same-product filter and sold prices are what turn these into a range.
- **No product was resolved in 16 searches.** Every answer came back with `product: null`, so nothing links a search to a product page or a price history yet.

## 4. Not shown

- Sold prices and sale dates: no lane here returns them; they need a person's own sign-in. So no pricing engine was scored live; the valuation engine's score is the backtest on 41,988 past sales, which the engines lead is rerunning.
- Overlap between lanes: Dupe returns its own redirect addresses and the actor's eBay addresses are shaped differently from ours, so matching by address found nothing and proves nothing.
- Mercari (no signed-out lane), the signed-in lanes, and any rival product: the benchmark has no named rival coded.
- Cost of the cloud browser minutes, and a second run: the search lead's proof for SR1 repeats the product numbers twice once the lanes are composed.

The run's aggregate files are in the orchestrator's scratchpad (`xsource-full.json`, `product-bench.json`) and are not in the repo.
