# Where the backend is not yet optimized

Asked by Nate ([words](../../product/words.md#2026-11-15-nate-where-are-we-not-optimized-an-expert-lead-for-real-time-adaptation-the-bundle-identifier-and-sessions-end-before-they-fill)): "Where have we not optimized in speed, accuracy, all aspects to the retrieval and operations of data and such features and everything driven with our custom build pipelines and api protocols."

Written 2026-11-15 by the orchestrator from what is already measured or audited in this repo; nothing here was fetched from outside. Each row names where its evidence is. `sourced` means a file or a run in the repo says it; `inferred` is the orchestrator's reading. Nothing below is decided: it is the list the spec pass places into each area's pages as named fixes.

## Speed

| Gap | Evidence | What would close it | Measure |
|---|---|---|---|
| The first answer of a search is slower than one plain request: 0.87 s at the median against 0.67 s | sourced: `bench/README.md`, run of 09:41 UTC | find the 0.2 s in job creation and the first frame; send the first source's rows the moment they parse | first-answer p50 and p95 under the baseline's, same items, same pace |
| Mercari takes 5 to 6 s a read, 4 s of it a fixed wait we set | sourced: `research/cross-cutting/nate/runs/ad-mercari.md`; `app/src/edge/harness/sites/mercari/live.ts:48` | wait for the page's own query response, not a fixed time | read time p50 and p95, 20 reads |
| Every browser read starts cold: no warm page per site, and the product composes no browser client for Poshmark, Mercari or eBay at all | sourced: `spec/plans/sweep/ai-engineering.md` item 2; the integration lead's runtime report | one warm cloud browser per site, reused; the anonymous client composed in the runtime | cold against warm read time; browser minutes per 100 searches |
| eBay search is 4.5 s and has no cheaper route: a plain request is refused, and blocking images to save bytes makes eBay refuse the browser | sourced: `research/cross-cutting/nate/runs/ebay-when-it-serves.md`, `ad-ebay-page.md` | a warm page; measure the proxy bytes of an unblocked load; the official interface when approved | seconds and bytes per eBay read |
| No pace per source, so a burst makes Poshmark answer with pages that hold no listings | sourced: bench runs, coverage 14 to 19 of 20 before pacing | pace as data per source, enforced by the runner | coverage stable across five runs at the stated pace |
| Nothing is cached or reused between a search, a valuation and a watch: each asks the site again | inferred from `spec/plans/joins.md` and the real-time proof (no observation store) | one observation store with a freshness rule per site and fact | reads per answer; share of answers served from stored rows within their freshness |
| The cost of an answer is not measured: browser time, proxy bytes, model calls | sourced: `spec/benchmark.md` lists it as a figure with no reading | log cost per call and sum per answer | cents per answer, p50 and p95 |

## Accuracy

| Gap | Evidence | What would close it | Measure |
|---|---|---|---|
| The valuation the app serves is less accurate than the last sale of the same product: median error 6.25% against 3.25%, on 41,988 StockX sales | sourced: the engines lead's run on `dataset:stockx_2019`, `spec/plans/finalization.md#13-what-works-kept-by-the-orchestrator` | anchor the middle on the item's own recent sales; a real-time index per family; fitted size ratios; the age rule per family (eng-valuation-2, running) | beats last sale and the 90-day median on the same items, per dataset and family |
| The range was too narrow (58.5% of sales inside a range meant for 80%); the calibrated one holds 84.3% but is 27% of the price wide | sourced: same run | a better middle lets the range narrow; calibrate per basis level | coverage inside 75 to 85% and width, per cell |
| The valuation route prices a fixed example item, not the person's | sourced: the engines lead's completion count; `app/src/edge/api/valuations.ts` | the `valuate` seam on ports, the route reading the person's item | a person's item in, its own comps out |
| Comparables are matched on all words of the title, so there is never a match at the variant level; the listing date stands in for the sale date | sourced: same count | identity-first matching by brand, model, size and variant; sale dates from sources that carry them | share of comps at variant level; share with a true sale date |
| Loose matches count like exact ones in the basis; two formulas for the effective sample disagree | sourced: `spec/plans/sweep/science-audit.md` corrections 2; the real-time proof link 6 | weight by match level; one formula | the basis of ten family-level comps no longer passes as six close ones |
| Every search row is "unresolved" without an identity model, and a search carries no item identity to match against | sourced: bench runs; the integration lead's note | a rule pass before any model; a search that can carry an identity | exact-match share on the benchmark's row 5 |
| The calibration gate can almost never be passed at the sizes named | sourced: science audit correction 3 | an equivalence test with a correction across cells (written into `money.md`, not yet in `check.ts`) | a truly calibrated model passes at the stated rate |
| Accuracy is measured on one family, sneakers from 2017 to 2019 | sourced: `spec/engines/valuation.md` §9 | the second dataset where its licence allows; the person's own sales as they arrive | accuracy by family with its count |

## Retrieval

| Gap | Evidence | What would close it | Measure |
|---|---|---|---|
| A search drew on one marketplace until today, two now (Poshmark and Dupe's licensed search) | sourced: bench run of 09:41 UTC | Depop through its harness with a cloud launcher, eBay's page lane, Mercari on a person's own search | sources per answer; coverage by source |
| The real-time loop does not run: 1 of 10 links works | sourced: `node scripts/realtime-proof.mjs`, `spec/plans/finalization.md#13-what-works-kept-by-the-orchestrator` | wire it link by link: a thin answer raises gathering, rows are stored as observations, the answer is re-asked, a weight moves and is read | links working, out of 10 |
| Sold prices with real sale dates are reachable only through the person's own signed-in session or their exports, and no account is linked | sourced: `research/price/nate/sold-price-sources-for-valuation.md` | link one account; read sold filters and sales exports under it | comps with sale dates per item |
| A page the reader cannot classify is called "changed", which would start repair for nothing | sourced: the integration lead's finding on Poshmark | keep what was read on a miss; classify blocked, empty or changed from it | misses classified, out of misses |
| Facebook Marketplace has no harness and its page reader fails every item | sourced: bench runs | build it last, or leave it out and say so | covered or stated |
| Per-site read paths have first readings, not distributions | sourced: `spec/benchmark.md` | 20 reads per site and lane at the product's pace | p50 and p95 per site and lane |

## Operations and protocol

| Gap | Evidence | What would close it | Measure |
|---|---|---|---|
| The harness's own controls are not used by the harness: route health, the lease and the pace bucket; a read timeout counts as a rate limit | sourced: `spec/plans/sweep/ai-engineering.md` item 4 | `harness.call` uses them; a timeout is a timeout | a slow page no longer slows the account |
| No signed-in transport exists; a person's sign-in has nowhere durable to live | sourced: the integration lead's runtime report; the security audit | the profile registry and session client (a worker is building them) | one signed-in read on a linked account |
| A dry plan was recorded as a completed write | sourced: `spec/plans/sweep/round-2/security-and-privacy.md` finding 1 | stage state `planned` (in canon; the fix is running) | no dry plan ever arrives |
| State is one process's memory in several places: sign-in sessions, the vault, leases, idempotency, caches | sourced: `spec/plans/sweep/round-2/production-readiness.md` finding 6 | the Store for each; one instance until then | a restart loses nothing a person did |
| Writes are not gated per site by the switch that claims to gate them | sourced: same, finding 8 | make the switch real, default off (running) | a write with the switch off is refused |
| Nothing measures the product in production: no cost, no latency by route, no alert | sourced: same, sections 6 and 7 | log cost and time per call; a health answer that tells the truth | a dashboard row per route |

## Pipelines

| Gap | Evidence | What would close it | Measure |
|---|---|---|---|
| The nightly fit read every row, including sources barred from modelling, and wrote its weights to the wrong table | sourced: the Databricks lead's sweep verdicts | read `comp_for_model`; one param table (in the engines' queue) | the fit's inputs match the cleared count |
| No run was tracked until today; the dashboard and the question-answering space do not exist | sourced: the Databricks lead's completion count | the tracked backtest and param walk (running); the dashboard and space (in build) | every figure on the page opens to a run |
| The benchmark's rows come from two tools only, ours and a plain request; no rival has been run | sourced: `bench/README.md` | the rivals' side, by hand, the same day | rows with a rival beside ours |
| About 70 Python test files are run by no gate, and main did not type-check for most of today | sourced: `spec/plans/sweep/round-2/repo-organization.md` item 9; the engines lead's report | a non-blocking job for the Python suites; `tsc` in every brief (now a rule) | main green on both, every merge |

## What is not here

How each engine should adapt per marketplace and per kind of item, and which measures can be built from the data we can actually gather, is its own piece of work, with its own lead and its own page: `spec/engines/adaptation.md` when it exists.
