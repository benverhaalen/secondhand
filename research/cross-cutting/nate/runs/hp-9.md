# hp-9: the fallback, observed runs
Researched 2026-11-15 by Nate (original agent not recorded).

## Run 1, 2026-11-15: the Jev rung on a real Poshmark search state

Input: the embedded state (`window.__INITIAL_STATE__`, 3.5 MB) recon recorded from Poshmark's signed-out search for "levis 501" (runs/hp-7.md). The manifest asked for `id` and `title`. One real Jev call (`jevAsk`, OpenRouter, timeout 2000 ms). Script: `/c/dev/.tmp-check/jev-run.ts`.

| step | result |
|---|---|
| code: candidate lists | 8 listing-shaped arrays: the grid (`$_search.gridData.data`, 48 items) and 7 size-facet lists under `gridData.facets` (16 to 23 items each) |
| Jev: which is the result set | `c0`, the grid, probability 1, confidence 1 |
| code: rows | 48 rows, every one with `id` and `title`, through classifyRead |
| time | Jev 635 ms, the rung 639 ms in total |

What it shows (observed): when a deterministic command breaks, the rung recovers the full result set in about 0.6 s with one typed decision, and code still validates every row. The facets are the trap a pick-the-largest default could fall into on a page with fewer results. The 635 ms Jev time is over the 400 ms Jev budget in intelligence-api §5 (`JEV_BUDGET_MS`). The rung's own timeout is the caller's to set. At the default 400 ms this call would have timed out, and the code default (the largest list) would have stood, which here happens to be right.

What is missing: the agent rung against a real page (it is a port with a fake), and a fallback on a broken signed-in verb (no go from Nate for any account).

## Steps

| session seq | event | detail | since previous |
|---|---|---|---|
| s_mwhcwhru413ekm 0 | session.start | level=info | +0 ms |
| s_mwhcwhru413ekm 1 | call.start | kind=http name=jev.decisions level=info call=c1 | +10 ms |
| s_mwhcwhru413ekm 2 | call.end | ok=true level=info ms=635 call=c1 | +635 ms |

## Fields against the spec

- session.start x1: spec needs build, seed; 0 line(s) short
- call.start x1: spec needs call, kind, name; 0 line(s) short
- call.end x1: spec needs call, ok, ms; 0 line(s) short

## Missing

- nothing

## Contract problems and warnings

- jev-run.jsonl:3: status must be number, got string
