# Benchmark results

Updated: November 15, 2026, 15:58 UTC by the machine clock. Kept by the orchestrator (Nate's side); Nate asked for them pushed ([words](../product/words.md#2026-11-15-nate-benchmarks-readme-and-docs-current-stale-docs-out-then-audit-and-testflight)). These are **development readings** on our own machines. None goes on a public page or into the pitch until Nate and Ben have both seen it (the house rule). Each row says where it ran and how to run it again.

## Search: one query, every marketplace

16 branded queries, each on a cold server, as a signed-out visitor, following the job's stream (`node scripts/bench/search16.mjs`, from 761b483b). "On target" is the share of the first ten kept results whose title holds the query's brand words.

| Pace and sources | Answered | First rows p50 | Settled p50 / p95 | Sources at settle | Top ten on target | Listings found / kept |
|---|---|---|---|---|---|---|
| One search every 7 s, all sources | 16 of 16 | 0.62 s | 1.39 / 5.11 s | 3.31 | 0.93 | 1,921 / 880 (eBay arrives late in 11 of 16, +1,929 kept) |
| One every 7 s, eBay off | 16 of 16 | 0.57 s | 1.26 / 2.06 s | 3.31 | 0.93 | 1,900 / 873 |
| One every 3.5 s, all sources | 16 of 16 | 1.09 s | 7.25 / 10.33 s | 3.19 | 0.93 | 1,826 / 871 |
| One every 3.5 s, eBay off | 16 of 16 | 1.04 s | 7.90 / 10.19 s | 3.25 | 0.93 | 1,864 / 857 |

At one search every 3.5 s (17 a minute) the settle is bound by the sites' own pace limits, not by eBay. Before the settle fix (14:15 UTC, main b3b72c6c) the same 16 queries settled at 7.99 s median with every source.

51 items (20 branded, 31 everyday), 14:49 to 15:04 UTC, by the Databricks lead: 46 answered (49 counting answers from Dupe alone), first rows 0.96 s p50, top ten on target 0.91, a median of 3 sources and 48 kept listings an item. That run predates the settle fix (settled 10.0 s p50).

## The chat: answers grounded in the listings

| Run | Result |
|---|---|
| Ten real questions after real searches (main 1f0e6f3c) | 10 of 10 answered, $0.37 for all ten |
| Planted false prices the number check must stop | 20 of 20 held (2 of 20 before the rewrite, eng-gate-5) |
| BC4 scored set, 25 questions, judged | low effort: mean 0.80, 25 of 25 answered, p50 3.7 s, p95 10.1 s, $0.006 an answer; on w/eng-final 0.774 |

## Valuation: what an item is worth

Backtest on 41,988 held-out real sales (StockX, a time split), the served engine with every part on:

| Engine | Median error | Within 10% | Within 20% | 80% range holds |
|---|---|---|---|---|
| secondhand, all on | 3.89% | 84% | 96.0% | 86.0% calibrated (77.0% raw) |
| Last sale of the product | 3.25% | | 97.4% | 79.8% |
| The product's 90-day median | 5.76% | | 89.1% | 82.7% |

All on beats the 90-day median by 7.4 points within 20% and trails last sale by 1.0 point. A live valuation of a captured item: done in 3.6 s from 31 Poshmark sold listings.

## Capture: photo to item

| Run | Result |
|---|---|
| Every family through the real API (14 families) | 14 of 14 open, take their type and ask exactly their own shots, 3 to 12 ms a capture |
| The live walk, `node scripts/capture-e2e.mjs` (two people, real uploads, identify, answer, finish, the second person locked out) | 25 of 25 steps, five runs of five (2 of 5 before the upload fix in e4291715) |

## The server

Five journey runs, 1,515 requests over all 100 routes, sources stubbed (server work only): p50 0.7 ms, p95 1.9 ms, max 15.1 ms. `/healthz` on a separate process: 0.7 ms. A second person is refused every route of the first (`server/journey.test.ts`, 19 steps).

## The check

`node .agents/check.mjs` on Windows and the Mac; Python 618 pass; type check clean. What remains red and why is in [finalization §13](../spec/plans/finalization.md#13-what-works-kept-by-the-orchestrator).
