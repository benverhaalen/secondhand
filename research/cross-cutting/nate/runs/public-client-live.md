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

## Not shown

No distribution (20 reads a site at the product's pace is the benchmark's job), no cost per read (browser minutes were not read back from the vendor), no sold search, no Facebook, no Mercari.
