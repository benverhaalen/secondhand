# 74: the adaptation handoff

Updated: November 15, 2026, morning Central. Owner: Nate. Agent: Claude Code, the adaptation and metrics lead (a new seat, started by the orchestrator). Read this and [packet 55](55-team-leads-and-mac-workers.md) first; then the three pages below.

## What the area is

Measures that make each engine fit the marketplace and the kind of item, computed from data we can actually read, grounded in research a referee could check, and proved on current data before they are trusted; how credible the scorers are and how we show we beat other tools; and, since this morning, the market index (keep what we read, give it a brand-free attribute record built by code, group it, answer from it) with A11, whether the brand matters.

## What is true on main

| Page or file | Commit | Holds |
|---|---|---|
| [spec/engines/credibility.md](../../../../spec/engines/credibility.md) | ea0d9f81, 41c2549b, 76693fa4 | scorer by scorer, what is proved (only valuation, on StockX; the served comps engine loses to last sale, 6.25% against 3.25%; the nightly model ties it and is not served); the six-rung ladder (L0 cited method to L5 randomised comparison) and the rules for weighing a claim; the value we bring defined on outcomes against the person's own counterfactual; exhibits ranked; fixes C1 to C6 |
| [spec/engines/adaptation.md](../../../../spec/engines/adaptation.md) | ea0d9f81, 41c2549b, 8e6c6f52, f6d1587b | §1 the field inventory summary; §2 measures A1 to A10 and A11; §4 proof on current data only (S0 synthetic, P1 the live panel on every site, P2 the person's own account, P3 the 2026 public-licence sets as level checks; the 2012–13 eBay set is not run, per Nate); §6 fixes AD1 to AD12 |
| [spec/engines/market-index.md](../../../../spec/engines/market-index.md) | 294f5234, f6d1587b | rights per source (Dupe never kept; Apify `may_model: false`), the record by code with a model only where code abstains, the groups, the answer order, the three measures, fixes MI1 to MI6 |
| research notes | ea0d9f81, 8e6c6f52 | [readable-fields-by-site.md](../../../../research/list/nate/readable-fields-by-site.md) (every field per site and verb, with the line that extracts it), [measures-literature.md](../../../../research/price/nate/measures-literature.md), [brand-premium-sources.md](../../../../research/price/nate/brand-premium-sources.md) |

Every page had a fresh Opus review; the adaptation page took 25 findings and A11 took 15, all fixed. Nothing in `app/` or `jobs/` was changed by this area before the slice worker.

## Open branches and worktrees on the Mac

| Worktree, branch | Holds | State |
|---|---|---|
| `adp-slice-1`, `w/adp-slice-1` | `jobs/measures/attributes.py`, `brand_premium.py`, `index_slice.py` and tests; outputs `scripts/bench/out/index-slice-2026-11-15.{json,md}`; the brief is in the shared notes folder (`brief-adp-slice-1.txt`) | started 2026-11-15 on gpt-6.1-sol, high. Judge by its tests, the diff against the brief (no titles or URLs in repo files, no Apify row in A11, cells never mixed), then merge |

Data outside git, on the Mac: `~/secondhand-data/measures/wide-rows-2026-11-15.jsonl` (826 rows: 700 Poshmark, 126 Apify; sha256 `7dd1a483…0493`), `a11-match-spec-2026-11-15.json`. No Dupe row is stored anywhere.

## The queue, in order

1. Merge `adp-slice-1` if it passes; put its numbers (code coverage per kind and site, ms per row, group counts, A11 per item and kind with intervals and states) on the board and in market-index §6 as a development reading.
2. A11 stability: the same reads on a later day, new listings only; the bar is in A11's proof step 2.
3. S0: synthetic-market tests for A1, A3 to A6 in `jobs/measures/` (failing tests first), then the TypeScript twin under `app/src/engines/measures/` with a shared parity fixture, and `spec/measures.mjs` as the registry.
4. P1 once AD8 (the panel recorder) lands: A1 against B0 and B1, then A2, A7, A10.
5. P2 once an account is linked (M6): A3 to A6 and the value ledger (C5).

## Decisions made, and why

- Proofs rest on current data only; the eBay 2012–13 figures are starting values, labelled ([Nate](../../../../product/words.md#2026-11-15-nate-not-focused-on-old-data-unless-it-holds-relevance)).
- Every site is read; the Poshmark rule covers only share, like and repost ([Nate](../../../../product/words.md#2026-11-15-nate-we-read-everything-the-poshmark-rule-is-only-about-share-like-and-repost)). The live panel re-reads every site at its pace.
- The attribute record and the groups are decided by code; a model only where code abstains or to rank within a group ([Nate](../../../../product/words.md#2026-11-15-nate-parsing-and-decisions-driven-by-code-not-a-model-reading-each-one)).
- Dupe rows are read and shown, never kept (J1, Dupe's licence). Apify rows stay `may_model: false`: shown, never counted in A11 or any fit, until Nate says otherwise about modelling (the orchestrator, 2026-11-15).
- Every row carries `channel` (official retail or secondhand) and the two are never pooled ([Nate](../../../../product/words.md#2026-11-15-nate-show-how-the-engine-weighs-what-it-learned-with-genie-answering-and-every-way-databricks-helped), "official and second hand retailers").
- Depop and eBay answer through `publicClients` on main (556e6b64); the composed search gets them when integration swaps it into the runtime. Until then the orchestrator runs queries through that module on request, since a Mac worker cannot read them.
- Waiting on Nate: whether people are invited to opt in to the randomised comparison (C6); how a day of waiting and an hour are costed (`c_u`, `w_u`).

## What this session got wrong, so the next one does not

- Designed the first proofs on the NBER 2012–13 set before asking whether old data was wanted. Ask what data a proof may rest on first.
- Read Nate's Poshmark rule as a limit on reading; it is a limit on acting (share, like, repost).
- Wrote Dupe rows to a scratch file before checking J1; check what a source lets us keep before writing any row.
- The first V1 design inherited a survivorship filter from the NBER reader (unsold listings still live at the end were dropped). Censor at the end of observation; never drop by outcome.
- A fresh reviewer caught every one of these; send the page to one before a brief.
