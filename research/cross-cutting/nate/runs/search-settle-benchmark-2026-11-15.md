# The 16 branded searches, with eBay and without it (2026-11-15, 15:22 to 15:39 UTC)

Run by the search lead (Claude Code, Opus) for the orchestrator, on Nate's "account for our benchmarks without ebay". Everything is *observed* unless marked otherwise.

**Setup.**
- **Code:** branch `w/search-final` at cdabb061, which is main at 587c7981 plus the settle fix. The answer settles once every other source has landed with a used row, and eBay follows as `answer.late`.
- **Server:** `node server/main.ts` from the worktree `C:\dev\secondhand-search` on port 8097. It started with the cloud browser key and the treg token present (read by presence only, never printed) and a scratch data folder. The server was restarted with an empty data folder before every run, so each run is cold: no shared read carried over.
- **Queries and pace:** the 16 brand-side queries of the adaptation slice, each from a new visitor. Each search was followed on its event stream until the stream closed, so late eBay rows are counted. Only counts and times were kept, and grep found no Dupe link in any output.
- **Probe:** `scripts/bench/search16.mjs`. Google Shopping cost about $0.002 a call, and these runs made about 100 calls.
- **Top ten on target** is a proxy defined here: the share of the first ten results whose title holds the query's brand word.

| | A search every 3.5 s, all sources | 3.5 s, eBay off | A search every 7 s, all sources | 7 s, eBay off |
|---|---|---|---|---|
| Answered | 16 of 16 | 16 of 16 | 16 of 16 | 16 of 16 |
| First rows, p50 | 1.09 s | 1.04 s | 0.62 s | 0.57 s |
| Settled, p50 / p95 | 7.25 / 10.33 s | 7.90 / 10.19 s | **1.39 / 5.11 s** | **1.26 / 2.06 s** |
| Sources with rows at the settle, mean | 3.19 | 3.25 | 3.31 | 3.31 |
| eBay after the settle | late in 6 of 16, at a median of 23 s | off | late in 11 of 16, at a median of 31 s | off |
| Top ten on target | 0.93 | 0.93 | 0.93 | 0.93 |
| Listings found / kept at the settle | 1,826 / 871 | 1,864 / 857 | 1,921 / 880 | 1,900 / 873 |
| eBay rows kept, arriving late | 1,193 | | 1,929 | |

Read times at the settle, p50 (p95): Dupe 0.31 to 0.44 s (1.5 to 8.3 s), Poshmark 0.71 to 0.81 s, Depop 0.88 to 1.10 s, Google Shopping 1.08 to 1.22 s (up to 2.5 s). Mercari answers `no_route` at once.

## What this shows

- **eBay no longer holds the settle.** With eBay on or off, the settle is the same at either pace: 7.25 against 7.90 s at 3.5 s apart, and 1.39 against 1.26 s at 7 s apart. eBay arrives afterwards as `answer.late`, and its rows are kept: 1,929 more in the 7 s run.
- **At a search every 3.5 s the settle is bound by the sites' own pace queues, not by any one source.** A third run at 3.5 s, with eBay and Dupe both off, still settled at p50 7.18 s and p95 10.14 s. Yet Depop, Poshmark and Google Shopping each read in under 2 s at the 95th percentile.
  - 3.5 s apart is 17 searches a minute, more than one search's turn on Poshmark (a 3 s gap plus a 0.8 s read), Depop (a 2 s gap, one at a time) or Dupe (one at a time, starts 3 s apart) can keep up with. So each queue grows across the run, and queue time counts against the settle (SR4) (*inferred* from those runs).
  - The 14:15 UTC benchmark's 7.99 s settle was this case. The 12:00 run's 1.48 s was cold too, but with fewer sources and before SR4 counted queue time (*inferred*).
- **Inside the sites' pace, one search every 7 s, the settle meets the 5 s goal at the median** (1.39 s) and is at it at p95 with eBay on (5.11 s, set by Dupe's slow reads). With eBay off, p95 is 2.06 s.
- **eBay's share is capped by its lane.** One read at a time, 10 s apart, serves about 5 searches a minute, so eBay arrived late in 6 of 16 searches at 3.5 s apart and 11 of 16 at 7 s apart. The rest were cut at the 30 s late window and counted timed out, without pausing eBay.

## Next

- Whether a site's pace queue should hold the settle at all is a design question. An *agent proposal*: settle once the sources already reading have landed, and let a source still waiting for its pace turn arrive late, as eBay now does. That would keep the 5 s goal under load without reading any site faster. It is Nate's call, because it changes what "settled" means for every source.
- One public lane per site caps the whole product: eBay at about 5 searches a minute, Poshmark at about 15. More traffic needs more lanes or a cache, not a faster pace.
