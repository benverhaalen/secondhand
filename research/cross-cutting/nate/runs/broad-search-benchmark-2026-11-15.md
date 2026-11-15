# The product's search on 51 items, everyday ones among them

Researched 2026-11-15 by Nate (Claude Code, the Databricks lead, Opus), on his word: "benchmark the search engine, run a bunch of searches" ([words](../../../../product/words.md)). Feature: cross-cutting. Every figure is *observed* in this one run unless marked; one run is not a distribution.

**How.** 14:49 to 15:04 UTC, main at about c8b871b6, `node server/main.ts` on Windows (`.claude/launch.json` entry `search-live`, port 8094, a scratch data folder), as a visitor, through `bench/run.mjs`'s `run()` over HTTP with a 30 s timeout. The item set: the 20 branded `market_items` of `spec/items/manifest.json` plus 31 everyday items written for this run (for example "lodge cast iron skillet 12 inch", "vintage pyrex mixing bowls", "canon ae-1 film camera", "wooden rocking chair", "pokemon charizard card"), kept outside the repo with the raw answers. No listing row was kept in the repo. The runner rejects the new `google_shopping` lane ("unknown source lane"); this run passed it a source list with that lane mapped to `official` instead of editing the runner (the integration lead's follow-up).

## Results

| Items | Answered with listings | Sites a search, median | Listings a search, median | First results, p50 | Full answer, p50 / p95 |
|---|---|---|---|---|---|
| All 51 | 46 (49 counting Dupe, which the runner leaves out of `sites`) | 2 | 47 | 0.96 s | 10.0 / 12.5 s |
| 20 branded | 16 | 1 | 24 | 1.03 s | 10.0 / 12.4 s |
| 31 everyday | 30 | 2 | 54 | 0.95 s | 10.0 / 18.2 s |

| Source | Reads | Answered with rows | Rows when it answered | Read time p50 | Otherwise |
|---|---|---|---|---|---|
| Poshmark | 49 | 44 | 48 | 0.73 s | 5 empty |
| Depop | 49 | 40 | 21 | 1.26 s | 9 empty |
| Dupe | 49 | 46 | 40 | 2.63 s | 2 failed, 1 timeout |
| eBay | 49 | 11 | 193 | 2.89 s | **38 timed out** |
| Google Shopping (treg) | 49 | 0 | | | 49 failed: no treg key on this server |
| Mercari | 49 | 0 | | | 49 failed: needs an account |

Two searches (new balance 990v5, champion hoodie) returned nothing within 30 s. The three answered by Dupe alone were the Aeron chair, the Kallax shelf and the Le Creuset oven.

## What it says

- **One search is fast; a batch queues on eBay.** First results come in about 1 s. The full answer waits for eBay up to the 10 s settle deadline. eBay reads one page every 10 s across all searches, so when searches come every few seconds the queue passes the deadline: 38 of 49 eBay reads were dropped as timeouts, although each read took 2.9 s when it ran and returned the most rows (193). The search lead's `search-late-1` (eBay arrives late instead of being dropped) is the fix; this run is the case it is for.
- **Everyday, vague items do at least as well as branded ones:** 30 of 31 answered with a median of 54 listings, against 16 of 20 and 24 for exact models. Exact-model furniture and cookware are the weak spot when eBay times out: only Dupe had them.
- **Two lanes were off in this run:** Google Shopping for want of a key on this server, Mercari by design (it needs an account).
- **Valuation answered `needs_user` for every visitor**, as designed; the valuation engine's own accuracy is measured by the backtest, not here.
