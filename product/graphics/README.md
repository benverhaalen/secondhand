# Benchmark and lakehouse graphics

*Agent proposal* for Ben to rule on. Ben owns how the product is drawn; nothing here is Decided.

[benchmark-and-lakehouse.html](benchmark-and-lakehouse.html) shows how fast and how complete an answer is, and what the Databricks layer shows that a scraper cannot. Open it in a browser from this folder; it reads `../../brand/tokens.css` and the logos in `../../assets/platforms/square/`. Add `?theme=dark` or `?theme=light` to force a theme.

The number rule: every figure is a first reading from 2026-11-15. Anything not measured is drawn empty and reads "not run yet". No rival's result, trend or listing price is drawn.

The whole page is one `data-view` on the web canvas, so `scripts/brand-check.mjs` reads it as one long scrolling page. The one field is on frame 1 only. Filled marks are measured, hollow marks are empty, and a ring with a centre dot means proved on a recorded page.

| # | Frame | Purpose | Fed by | Real | Empty | Form, and why |
|---|---|---|---|---|---|---|
| 1 | Measured | The run's counted figures, first | The benchmark run's records.jsonl (`spec/benchmark.md`) | Full answer 2.0 s p50, 4.0 s p95; coverage 0 of 20, shown as a miss | None | Three big figures on the one field: the brand spends the field where attention should go, and this is that place |
| 2 | Against a clock | One search on a 0 to 12 s clock, beside the two baselines | records.jsonl `first_at` and `full_at` per site; the baselines timed on the same 20 products | Full answer bar from p50 to p95 | First answer, a person by hand, one plain request, each site's landing | One shared time axis, so the baselines read as distance once they are filled |
| 3 | Time per site | Read time per site, split by lane | Harness timings per site and lane | Depop 1.8 s search, 0.78 s listing, 0.29 s still-listed (cloud browser); Poshmark about 2.5 s; Mercari 5 to 6 s (4 s our wait); eBay 9.6 s cold, 4.2 s local browser; Dupe 1.4 to 5.4 s for 40 rows; questions per kind of item; planner 0.10 ms p50, 0.29 ms p95 over 47 states | Plain-request lane (Depop refuses it), other sites in the person's browser, eBay's official interface | Dot plot grouped by lane on the same 12 s axis as frame 2: one reading is a dot, a range is a bar, so nothing looks more certain than it is |
| 4 | Proved, or not | Each marketplace against each action | Adapter status, `.agents/team/` and `spec/` | Search live on Depop, eBay, Mercari, Poshmark; signed-in reads and writes recorded on three; eBay sold search needs sign-in; "How much is real": 62 of 86 endpoints, 11 of 15 walk stages | Facebook Marketplace not built; eBay official interface not run | A grid with three mark states: a table is what people already read for coverage, and the marks carry the state without color |
| 5 | A price, opened | One shown price traced down to the sold listings under it, and how close prices came | `core.guarded_number`, `core.citation`, `core.observation` at its Delta version, `measures.why` | Valuation on 16,193 StockX sales (Jan to Feb 2019): 93.8% within 20%, median error 5.6%, 62.2% inside the range against an 80% target, drawn as a miss with the target line | The live trace itself | A vertical chain of hollow steps: it is the lineage a scraper cannot give, and stays honest as empty until one live number_id is opened |
| 6 | A weight learns | One tunable's history: start, moves, promotions, a rollback, today | `core.param` through change data feed | None | All of it | The same step chain as frame 5, so the two Databricks frames read alike |
| 7 | Which level | The share of shown numbers each fallback level served, by week | `basis_level` on `core.guarded_number`, counted by week | None | All of it | Labelled empty rows for the five levels: a trend would be invented, so only the levels are drawn |
| 8 | Rows kept | The pipeline as a funnel | The pipeline's expectation counts | 207,203 in, 207,185 kept, 99,956 modelled (StockX 2017 to 2019); four sources out of modelling: Grailed 2021 and three small 2026 sets | None | Three outlined bars filled to their share: the drop to modelling is the story, and the outline shows what is left out |
| 9 | Two layers | What Databricks gives beside what our layer adds | The architect's table in `spec/plans/sweep/databricks.md` | The three pairs as written there | The live grants, filters and masks | Paired text rows, not a diagram: the claim is a comparison of words, and a drawing would add nothing but boxes |
| 10 | Never done | What the system refused | The policy sweep and the claim check | 32 of 32 never-automated actions refused across 480 answers on every site; 10 of 10 planted false claims held; 10 of 10 clean drafts passed | Refusals by rule from live use (`core.decision`) | Full bars against an outlined empty one: the refusals are complete, and live use is not yet counted |

## Checks run

- `node scripts/copy-lint.mjs` on the page: passes.
- `scripts/brand-check.mjs` through a wrapper that passes a local Chromium: 0 errors. Warnings: B15 (the brand faces are not on this machine, so the fallback face was measured), B31 (nothing marked `data-part`), B11 (eBay and Grailed named in captions, where a logo cannot stand in for a sentence).
- Rendered at 390 and 1440, light and dark: no horizontal overflow, no overlapping text or logos inside the charts, no failed requests; h1 at 50 and 86.5, h2 at 36 and 58.3.

## Gaps in the brand system this page ran into

- No chart vocabulary: the empty mark, the track, the scale and the recorded ring were chosen here inside `--ink`, `--ink-2` and `--rule`.
- The bare logos in `assets/platforms/*.svg` draw in black through an `<img>` or SVG `<image>` and vanish in dark, so the page uses the square site icons.
- B31's one-size rule does not fit a long page whose frames differ on purpose.
