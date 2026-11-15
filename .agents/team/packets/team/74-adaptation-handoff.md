# 74: the adaptation handoff

Updated: November 15, 2026, about 06:30 Central, at the wrap-up Nate asked for. Owner: Nate. Agent: Claude Code, the adaptation and metrics lead (a new seat, started by the orchestrator). Read this and [packet 55](55-team-leads-and-mac-workers.md) first; then the three pages below.

## What the area is

Measures that make each engine fit the marketplace and the kind of item, computed from data we can actually read, grounded in research a referee could check, and proved on current data before they are trusted; how credible the scorers are and how we show we beat other tools; and, since this morning, the market index (keep what we read, give it a brand-free attribute record built by code, group it, answer from it) with A11, whether the brand matters.

## What works today

- [credibility.md](../../../../spec/engines/credibility.md): scorer by scorer, what is proved; the six-rung ladder (L0 cited method to L5 randomised comparison) and how a claim is weighed; value defined on outcomes against the person's own counterfactual. Commits ea0d9f81, 41c2549b, 76693fa4. Proving command for the page's checks: the repo's links, research, vague, provenance and secrets checks, run per file.
- [adaptation.md](../../../../spec/engines/adaptation.md): the field inventory, measures A1 to A11 with estimators, registry rows, guards and priors, proof on current data only, fixes AD1 to AD12. Commits 8e6c6f52, f6d1587b, 884526f3. Two fresh Opus reviews (25 and 15 findings), all fixed.
- [market-index.md](../../../../spec/engines/market-index.md): rights and channel per source, the record by code, the groups, the answer order, fixes MI1 to MI6, and the first reading. Commits 294f5234, f6d1587b, 884526f3, this commit.
- `jobs/measures/` (merge 3139e86e, aggregates trimmed e6049434): the attribute record by code with evidence spans, the brand normaliser, the size parser, the accessory filter, the three groups, and A11 with an exact Mann-Whitney interval. Proof: `./.venv/bin/python -m pytest jobs/measures/test_attributes.py -q` (22 tests), `test_brand_premium.py` (14), `test_index_slice.py` (45), each exit 0 on the Mac after merging main; `tsc` clean.
- **A11 has a real reading** on 7,623 public rows read 2026-11-15 (eBay page 6,327, Poshmark 700, Depop 470, Apify 126 shown only; Dupe read live, not kept): 15 measured item-cells; by kind, shoes 1.24×, clothes 2.39×, headphones 2.47×, furniture 2.67×, small goods 4.21×, asks of the named brand over the same attributes from other brands. A development reading, in [index-slice-2026-11-15.md](../../../../scripts/bench/out/index-slice-2026-11-15.md); rerun with `cd jobs && ../.venv/bin/python -m measures.index_slice --rows <wide rows> --rows <eBay and Depop rows> --spec <match spec> --out … --table … --examples /tmp/…` on the Mac (inputs in `~/secondhand-data/measures/`).
- Research notes: [readable-fields-by-site.md](../../../../research/list/nate/readable-fields-by-site.md), [measures-literature.md](../../../../research/price/nate/measures-literature.md), [brand-premium-sources.md](../../../../research/price/nate/brand-premium-sources.md).

## What does not work, or is only specced

- A1 to A10: specified, none computed. No synthetic-market test (S0) is written yet; no panel (P1) exists; no account is linked (P2).
- The measures registry `spec/measures.mjs`, the TypeScript twin under `app/src/engines/measures/` and the port `measures.read`: not built. A11 is not a registry row yet.
- The model fallback for the attribute record and the promotion of recurring answers: specified only, so code-model agreement is not measured.
- The index is not in the product: nothing a search reads is stored (J1), and no answer comes from stored rows (MI2).
- Faults in today's reading: furniture accessory words (arm pads, casters, cylinders) are missing, so the Aeron cell likely holds parts; Depop titles are slugs, so Depop coverage is 0 to 14%; the kind interval does not include the spread between items; one eBay query (Birkenstock Boston, branded side) timed out.
- A11 stability (a second day, new listings only) is not run, so nothing in the reading has passed its stability bar.

## What is left, in order

1. A11 on a second day, new listings only, against the stability bar (adaptation.md, A11 proof step 2); add the furniture accessory words first. Owner: the next adaptation session.
2. S0: synthetic-market tests for A1 and A3 to A6 in `jobs/measures/`, then the TypeScript twin with a shared parity fixture, `spec/measures.mjs`, and A11 as a `normal` row.
3. P1 once AD8 (the panel recorder) lands; P2 once an account is linked (M6).
4. Named fixes, routed by the orchestrator on 2026-11-15: AD9 and MI3 to engines (identity: the record by code, `similar_other_brand` before the `wrong_item` cut); AD11, AD12, MI1, MI2 to integration (a `brand: other` search, likes and listed_at kept in rows, the observation writer with rights, answering from stored rows); MI4 to Databricks (market tables and an AI Search index); MI5 to the orchestrator (every listing and field per read, in build); AD10 and MI6 wait in capture's queue. Not yet routed: AD1 to AD8 and C1 to C6, which land only after their measures are proved.

## Open branches and worktrees on the Mac

`adp-slice-1` (`w/adp-slice-1`) is merged into main (3139e86e) and can be removed. The inputs stay outside git in `~/secondhand-data/measures/` on the Mac, and `scripts/out/` on Windows (git-ignored). No Dupe row is stored anywhere.

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
