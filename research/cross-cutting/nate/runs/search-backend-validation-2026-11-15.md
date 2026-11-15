# Search backend validation (2026-11-15, 13:42 to 13:58 UTC)

Run by the search lead (Claude Code, Opus) on Nate's word: "ben will handle sign in proof, we are focusing on validating the full backend, chekcing and ensuring everything works" ([words](../../../../product/words.md#2026-11-15-nate-ben-handles-the-sign-in-proof-we-validate-the-full-backend)). Everything is *observed* unless marked otherwise.

Setup: main at about eb201bac, `node server/main.ts` on Windows (`.claude/launch.json` entry `search-live`, port 8094), a scratch data folder outside the repo, the cloud browser key present (checked by presence only). Nobody signed in to any marketplace. No row was kept on disk. The benchmark's `raw/` folders were deleted after scoring, and grep found no Dupe link in them before or after.

## 1. The 20-item benchmark, twice (`node bench/run.mjs --base http://localhost:8094`, then `bench/score.mjs`)

| Run | Coverage | First answer p50 / p95 | Full answer p50 / p95 | eBay hit / timed out |
|---|---|---|---|---|
| `2026-11-15T13-42-16-998Z-ours` | 17 of 20 | 0.90 / 2.6 s | 10.0 / 12.7 s | 6 / 14 |
| `2026-11-15T13-47-58-781Z-ours` | 18 of 20 | 0.01 / 0.56 s | 10.0 / 10.1 s | 8 / 12 |

At 12:54 and 12:57 the same runner gave 20 of 20 and full p50 8.3 s and 3.7 s ([packet 88](../../../../.agents/team/packets/team/88-search-handoff.md) section 3).

- **The empty answers** were furniture and small goods (furniture-3, furniture-4, small_goods-2). Depop and Poshmark found nothing, and eBay timed out. Dupe returned 40 rows each time, but the runner does not count Dupe in `sites[]`, the open finding from packet 88. With Dupe counted, coverage would be 20 of 20 (*inferred* from the records).
- **eBay's reads were fast once they ran**: 1.5 s, the page parsed in the page, warm (`call.end` for `public.read`, `parsed: "page"`). The time went to waiting. eBay's lane takes one read at a time with a 10 s gap, shared by every search. The runner sends a new search about every 10 to 13 s, so the queue grows until reads pass the 10 s settle deadline.
- **Why a slow eBay was thrown away.** At the settle deadline the search route lands every pending source as a timeout and aborts its read (`api/search.ts`, the settle race). A read that would have finished 2 s later never arrives. That breaks Nate's ruling that eBay is read in every buy search and lands last. Fix briefed: worker `search-late-1`, in which eBay keeps reading for a late window (param `search_late_window_ms`, prior 30 s) and arrives as `answer.late`, and the job keeps its rows.
- **Valuation** answered `needs_user` for 20 of 20 visitors. That route belongs to the engines lead and requires sign-in by design; it is not a search fault.

## 2. Every search route over HTTP (signed in with a development code, and as a visitor)

20 of 21 checks passed:
- email sign-in start and verify, and `GET /v1/me`;
- a person's search answered 202 with a group on every stage;
- the event stream carried 6 `answer.partial`, 1 `answer.settled` and a `done`;
- found = used + drops on all 7 answer frames;
- every Dupe row kept its credit;
- the person read their own job, and a visitor reading it got 404;
- a visitor's search returned a signed visitor id, and that id read the job back;
- no Facebook stage for a visitor;
- the visitor's answer was served from the shared read (Depop, Poshmark and eBay marked `cached`);
- `sources: ['osint']` gave only the osint stages;
- an unknown source, an empty source list and an empty query each answered 400;
- `GET /v1/routes` answered 200.

Dupe timed out once in that run (1 of 1); it answered in every other run today.

**Failed: `GET /v1/sources/health`** answered 404 "no example data for this user" for a real person, with or without `?site=ebay&need=sold`. The handler serves only the example account, and its routes are the example's fixed eBay sold rows. So SR8's per-site read counts and pauses were not visible on a real server. Fix briefed: worker `search-health-1`, which gives one row per source with whether it is composed, its success estimate, any pause and its last read.

A visitor's job read with curl needs the id the server returns. An unsigned `X-Visitor-Id` is replaced by a new signed id in the response's `X-Visitor-Id` header, and the job belongs to that one. Working form: POST with `-D h.txt`, take `x-visitor-id` from `h.txt`, and send it on `GET /v1/jobs/<id>`.

## 3. Google Shopping through treg, live through the server (SR12)

This ran on a second server on port 8095, started from PowerShell, because the token is a Windows user-level variable the app's environment does not carry. Its value was never printed, and a match for it in the server log and the probe output found none. Three searches, 12 s apart, one visitor each:

| Query | Google Shopping | Cost (from `x-treg-cost-micro`) |
|---|---|---|
| levi 501 jeans | 32 rows (8 dropped: not dollars or unparseable), 1.18 s | $0.002, `cost_estimated: false` |
| nike air force 1 | 40 rows, 2.26 s | $0.002 |
| west elm sofa | 37 rows, 1.19 s | $0.002 |

Each call logged `call.end` with `cost_usd`, `cost_estimated` and the row count, under `google_shopping.search`. Total spend was $0.006 of the $1.00 daily cap.

Its rows are `may_model: false`, so they skip the same-product filter, and every row found counts as used: 37 sofa rows shown where Poshmark's same-product filter kept 1 of 48. That is by design for a shown-only source, but a person sees unfiltered asking prices beside filtered ones (*inferred*: whether to judge Shopping rows for display, without using them in a fit, is a design question for Nate).

eBay on this freshly started server took 7.8 to 10 s per read, which looks like the cold browser start (*inferred*).

## Open, in order

1. Land `search-late-1` and `search-health-1` after review, then rerun section 1 and the health check.
2. The runner counts Dupe in `sites[]` (integration's file `bench/run.mjs`; told in packet 88).
3. Dupe's copies of listings read directly: Dupe gives only its own redirect link (and its robots file disallows `/redirect`), so a copy can only be matched by site, price and title together.
4. Mercari has no route composed in the server.
