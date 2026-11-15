# The anonymous clients, live: eBay and Depop for a person who is not signed in

Run 2026-11-15, about 07:20 Central, from the Windows machine, by the orchestrator. One script, `publicClients` from `app/src/edge/harness/public-client.ts` (main at 556e6b64) over a Browser Use cloud browser (`browserUseCloud` and `cdpLauncher`), handed to the existing `ebayPageAdapters` and `depopAdapters`. Nobody signed in, no request intercepted, no challenge met. Every figure below is observed in this one run: two reads a site, not a distribution.

| Site | Read | Query | Rows | Seconds | Fields on the first row |
|---|---|---|---|---|---|
| eBay | cold (the browser opens) | mid century walnut dresser | 60 | 4.57 | 8 |
| eBay | warm (same browser, 11 s later) | levis 501 jeans | 60 | 3.83 | 8 |
| Depop | cold | levis 501 jeans | 24 | 2.95 | 9 |
| Depop | warm (4 s later) | carhartt jacket | 24 | 1.35 | 9 |

Closing both browsers took 0.15 s. The module wrote 9 log lines, none with a query string.

## What it shows

- Both sites answer a person who is not signed in through the module the runtime can compose. Before this, the composed product gave both a plain `fetch`, which both refuse, so only Dupe and Poshmark answered (bench run `2026-11-15T10-24-39-853Z-ours`: 2 sources per answer).
- A warm browser saves 0.7 s on eBay and 1.6 s on Depop against a cold one (*inferred* from one pair each; the queries differ).
- eBay's warm read still spends 1.5 s in a fixed wait the module carried over from the live script. Waiting for the first result card is the next cut, worth about a second (*inferred*).
- eBay returned its default page of 60. The same search asked for 240 a page returns 242 cards (observed the same morning in a plain browser); the reader does not ask for it yet.

## The same check with the whole page, about 08:50 Central

Main at c7016230: the eBay page lane asks for 240 listings and reads every fact a card shows. Same script, same queries, nobody signed in, observed in one run.

| Site | Read | Rows | Seconds | Fields on the first row |
|---|---|---|---|---|
| eBay | cold | 240 | 6.18 | 15 |
| eBay | warm | 240 | 6.01 | 17 |
| Depop | cold | 24 | 2.62 | 9 |
| Depop | warm | 24 | 1.86 | 9 |

One eBay read went from 60 rows of 8 fields to 240 rows of 15 to 17 fields: about eight times the facts for about two more seconds, and about 40 rows a second against 13 to 16 before (*computed* from the two tables). Parsing 242 cards on the server takes 12.7 ms at the median over 10 runs on the Mac (the worker's test), so the added time is the larger page arriving, not the parsing. The next cut is to parse inside the page and return rows instead of 4 MB of HTML; a worker is building it, and its saving will be measured as bytes out of the page and seconds a read.

## Thirty-two reads a site, about 10:55 to 11:05 UTC

The adaptation slice's 32 queries (16 items, a branded and an off-brand query each), run once on each site through the same module, eBay at one read every 10.5 s and Depop at one every 3.5 s. Observed; nearest-rank percentiles over the 32 reads of each site.

| Site | Answered | Rows kept | Seconds, p50 | Seconds, p95 | Failures |
|---|---|---|---|---|---|
| eBay, 240 a page | 31 of 32 | 6,327 | 5.03 | 9.21 | 1 timeout |
| Depop | 32 of 32 | 470 | 1.08 | 1.80 | none |

No challenge and no refusal on either site in 64 reads. eBay averaged 204 rows an answered read; Depop 15 (its search page gives a slug, a price, a brand and likes, and no title or condition). The rows are in a git-ignored file for the brand measure and are not in the repo.

## Not shown

No distribution (20 reads a site at the product's pace is the benchmark's job), no cost per read (browser minutes were not read back from the vendor), no sold search, no Facebook, no Mercari.
