# The anonymous clients, live: eBay and Depop for a person who is not signed in
Researched 2026-11-15 by Nate. Feature: cross-cutting.

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

## Where an eBay read's seconds go, about 11:20 UTC

Nate: "That slice is still too high." Four reads on one warm cloud browser, each phase timed from the start of navigation, nobody signed in, nothing intercepted. Observed; milliseconds.

| Page size | Query | First byte | First card in the page | Cards present then | DOM ready | Rows built in the page | Rows, bytes | HTML out of the browser | HTML, bytes |
|---|---|---|---|---|---|---|---|---|---|
| 60 | carhartt detroit jacket | 416 | 1,909 | 62 | 2,101 | 77 | 11,817 | 584 | 1,970,061 |
| 240 | carhartt detroit jacket | 446 | 2,537 | 242 | 2,697 | 438 | 46,938 | 1,098 | 4,549,519 |
| 60 | levis 501 jeans | 595 | 2,077 | 62 | 2,820 | 112 | 12,451 | 417 | 2,395,344 |
| 240 | levis 501 jeans | 451 | 2,579 | 242 | 2,928 | 88 | 49,933 | 538 | 4,294,432 |

Opening the browser took 529 ms and closing it 162 ms.

What it says:
- Every card is in the page the moment the first one is: eBay sends the result list in one piece, about 1.9 to 2.1 s after navigation for 60 and 2.5 to 2.6 s for 240. That is eBay's own time and the floor for this lane.
- The module on main waits for DOM ready (2.1 to 2.9 s), then a fixed 1.5 s, then pulls 2 to 4.5 MB of HTML out (0.4 to 1.1 s), then parses (13 ms): about 4 to 5.5 s, which matches the 5.03 s median of the 32 reads above. Roughly half of it is waiting we chose.
- Building the rows inside the page at the first card and returning them takes 0.1 to 0.4 s and moves 12 to 50 KB, about a hundredth of the HTML. A read then costs about 2.0 to 3.0 s (*computed* from the columns: first card plus rows built in the page), against 5.0 s today.
- 240 a page costs about half a second more than 60 at the first card.

## After the in-page parser landed, about 11:15 to 11:25 UTC

Main at 64121ba4. The eBay read now builds its rows inside the page (`parsed: "page"` in the module's own log line). Observed:

| Run | Reads | Rows a read | Seconds | Bytes out of the page | `waited_ms` |
|---|---|---|---|---|---|
| Three generic queries | 3 | 240 | 5.38, 5.15, 4.96 | not captured | not captured |
| Three of the slice's long queries | 3 | 240 | 4.65, 4.87, 4.79 | 124,081; 123,675; 120,878 | 881; 1,500; 1,281 |
| The slice's 32 queries again, one read every 10.5 s | 31 of 32 answered | 6,066 in all | p50 10.35, p95 12.63 | not captured | not captured |

What it says, plainly:
- The saving in bytes is real: about 124 KB leaves the page where 4.3 to 4.5 MB of HTML did, about a thirty-fifth.
- The saving in seconds is not there yet. Six direct reads took 4.7 to 5.4 s, against a 5.03 s median before the change. The read still waits for DOM ready and then spends 0.9 to 1.5 s waiting for a card that the phase timings above show is already in the page: that wait is the fault to find, and with navigation ending at the first byte the read should cost about 2.0 to 3.0 s.
- One 32-read run measured a 10.35 s median, double the six direct reads taken minutes apart with the same code. It is unexplained (*not-found*: no log lines were kept for that run). It has to be rerun with the log kept before anyone quotes a median for the in-page lane.

## SR7 and SR8, 2026-11-15 about 12:28 to 12:31 UTC

Main at 5477b7e7: eBay navigates to the first response (`waitUntil: 'commit'`), then one in-page call waits for the first card with a MutationObserver, reads the page state and builds the rows. Run by the search lead from Windows with `node bench/reads.mjs` over the composed clients (a Browser Use cloud browser), nobody signed in, nothing intercepted, the slice's 32 queries, every log line kept (outside the repo; no line carries a query). Observed:

| Site | Gap | Reads | Answered | Empty | Refused | Challenged | Rows | Seconds, p50 | Seconds, p95 |
|---|---|---|---|---|---|---|---|---|---|
| eBay | 10.5 s | 1 of 32 sent | 0 | 0 | 1 (HTTP 403 on the first response, 1,895 bytes, navigation 0.30 s) | 0 | 0 | none | none |
| Depop | 3.5 s | 32 | 24 | 8 | 0 | 0 | 470 | 0.91 | 1.57 |

What it says:
- eBay refused the cloud browser's first request of the run at 12:28:39. The script stopped at the refusal, as a refusal must; nothing was retried. A 403 is the server's answer before any page code runs, so the navigation change cannot cause it (*inferred*). The orchestrator's cross-source benchmark ran from the same address around this time, which may have doubled the pace eBay saw (*not-found*: the overlap is not confirmed). The 32 eBay reads are rerun after the back-off, with no other run from this address.
- Depop's 470 rows match the earlier 32-read run's 470; that run counted the 8 empty reads as answered. Depop's p50 is 0.91 s against 1.08 s then.

### eBay alone, 12:39:50 to 12:45:23 UTC

The same 32 queries, one read every 10.5 s, with no other run from this address (the orchestrator's benchmark had ended at 12:45 by its own record, so the 12:28 refusal fell inside it). Observed; nearest-rank over the answered reads; every log line kept outside the repo, none with a query.

| Reads | Answered | Empty | Failed | Refused or challenged | Rows | Seconds, p50 | Seconds, p95 | Navigation to commit, typical |
|---|---|---|---|---|---|---|---|---|
| 32 | 29 | 2 | 1 (14.4 s: navigation 4.2 s, then an evaluation error) | 0 | 4,837 | 2.40 | 3.21 | 0.46 to 0.98 s |

What it says:
- SR7's bar is met: a 2.40 s median over 32 reads with the log kept, against 5.03 s before the in-page parser and the commit navigation.
- The 10.35 s run is not reproduced. The orchestrator measured eBay at 7.97 s at the median when five lanes ran at once on one machine, against about 5 s alone ([cross-source benchmark](cross-source-benchmark-2026-11-15.md)), so contention on the machine fits it (*inferred*; that run kept no log).
- 23 of the 29 answered reads returned their rows through the server-side fallback (`zero_cards`): the in-page parse found no card although the page had them, on pages of 16 to 240 rows; the 6 answered reads parsed in the page had 3 to 32 rows (and both empty reads parsed in the page). Rows were right either way; the fallback moves the page's HTML out, so fixing it should bring the fallback reads (1.8 to 3.3 s) toward the in-page ones (1.4 to 2.0 s) (*inferred*). It is the next eBay cut.

## Not shown

No distribution (20 reads a site at the product's pace is the benchmark's job), no cost per read (browser minutes were not read back from the vendor), no sold search, no Facebook, no Mercari.
