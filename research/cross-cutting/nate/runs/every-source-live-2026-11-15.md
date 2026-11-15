# Every search source, live and signed out (2026-11-15)

Researched 2026-11-15 by Nate (Claude Code search lead, Opus). Feature: cross-cutting.

Run by the search lead (Claude Code, Opus). Nate asked: "Check all sources and ensure with these test that every source works." Everything below is *observed* unless marked otherwise.

## What ran

- Code: main at 5d06fbe0, which includes the merge of search round 3 and the harness abort (a32b6bc1). The shared checkout also had another session's uncommitted edit to `app/src/edge/intel/public/search.ts`, which keeps every field on a row. The server ran with that edit.
- Server: `node server/main.ts` on Windows, port 8094, a scratch `SECONDHAND_DATA_DIR` outside the repo (deleted after the run), `.claude/launch.json` entry `search-live`. The cloud browser key was present (checked by presence only). Treg and Apify were not configured.
- Nobody was signed in. Each search used a new visitor, waited 12 s after the last one (eBay's own pace is 6 a minute, 10 s apart), and polled `GET /v1/jobs/:id` once a second. Only counts and times were kept. No row was written to disk or printed, so no Dupe row was kept.
- The probe script was kept outside the repo. It posts `POST /v1/search {text}`, reads the job until it leaves `running`, and prints, for each `result.searched` entry, the outcome, the count found, the count used and the read time.

The first pass polled every 250 ms and used up one visitor's request bucket (`rate_limited`, "visitor bucket empty"), so three searches got no answer. Those three, plus one whose job was still `running` when polling stopped, were rerun with a new visitor each and 1 s polling. The table holds the six searches that answered.

## Results, 13:30 to 13:32 UTC

| Query | Full answer | Dupe | Depop | Poshmark | eBay | Mercari |
|---|---|---|---|---|---|---|
| levi 501 | 3.7 s | 40 found, 29 used, 1.54 s | 24, 23, 2.46 s | 48, 47, 0.84 s | 240, 227, 3.10 s | no_route |
| patagonia better sweater | 3.7 s | 40, 28, 1.96 s | 24, 22, 1.50 s | 48, 45, 0.76 s | 240, 225, 3.09 s | no_route |
| nike air force 1 | 1.1 s | 35, 31, 0.31 s | 24, 24, 1.66 s | 48, 47, 0.73 s | 240, 222, 2.91 s | no_route |
| west elm sofa | 4.1 s | 40, 23, 3.02 s | 24, 1, 1.51 s | 48, 0, 0.78 s | 240, 38, 2.55 s | no_route |
| nintendo switch oled | 5.1 s | 40, 7, 4.80 s | 24, 2, 1.39 s | 48, 27, 0.46 s | 240, 174, 2.93 s | no_route |
| le creuset dutch oven | 4.0 s | 40, 21, 3.74 s | 24, 11, 1.57 s | 48, 38, 0.77 s | 240, 220, 2.66 s | no_route |

- **Dupe, Depop, Poshmark and eBay answered 6 of 6** with rows. Every stage ended `arrived`. None was refused, challenged or timed out.
- **eBay landed in 2.55 to 3.10 s.** The log has no `zero_cards` line, so no eBay read fell back to the server parse. Before the in-page parse fix, 23 of 29 did ([run page](public-client-live.md)). Six reads is a small sample. The 32-read rerun is still open (finalization SR7).
- **Full answer 1.1 to 5.1 s**, median about 3.9 s. One search at a time is the warm, unqueued case. The 20-item benchmark's cold median was 8.3 s ([packet 88](../../../../.agents/team/packets/team/88-search-handoff.md) section 3).
- **Mercari answered `no_route`** every time. `harness/compose.ts` routes only Depop and eBay signed out, and the Mercari route needs a linked account. Since a32b6bc1, a source with no route says so before any account check, because linking an account would not help.
- **Facebook was not asked.** It is person-only, a visitor gets no Facebook stage (SR2), and no Apify token was composed.
- **Few rows used for furniture and electronics** on Depop and Poshmark (west elm sofa: 1 of 24 and 0 of 48). Those two sites barely carry those families, which the [cross-source benchmark](cross-source-benchmark-2026-11-15.md) also found. The same-product filter drops the rest.

## Tests on the merged tree

The lead reran these on the merged tree before pushing. On the Mac worktree: `api/search.test.ts` 89 of 89, `search-latency.test.ts` 4 of 4, `sources.test.ts` 9 of 9, `intel/public/search.test.ts` 21 of 21, `public.test.ts` 29 of 29, `run.test.ts` 18 of 18, harness `protocol` 20, `service` 21, `public-client` 62, `listing-parser` 10, eBay `page` 25 and `adapter` 26, Depop `adapter` 25, Mercari `linked` 2 and `adapter` 25, `compose` 9. All passed, and `tsc` reported no error. On Windows, after the merge with main: search 89 of 89, latency 4 of 4, sources 9 of 9, Mercari linked 2 of 2.
