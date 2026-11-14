# As of November 2026, what methods exist to infer how a ranking system you do not own orders results, learn which listing choices work through controlled experiments and adaptive allocation, detect that the ranking system changed, and combine financial, quality, visibility and trend scores into one decision; and which Databricks components carry each?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: price.

Evidence marks: *observed* = opened in this run and the page says so (bytes via curl and grep, or a search result page whose text was returned); *asserted* = source claims it, or carried from an earlier retrieval whose page I did not reopen in the final pass; *inferred* = my reasoning. "Unopened" = link seen, not opened. Limits: a search-result snippet is a sample. Many group 1, 2 and 3 entries below were collected earlier in this run and are marked *asserted* or "unopened" where the final pass did not reopen them.

Existing notes read first and how this note relates to them: [ranking-algorithms.md](../../list/nate/ranking-algorithms.md) (what is known of each site's ranker; this note extends it with how to infer it), [observing-rank-and-performance.md](../../list/nate/observing-rank-and-performance.md) (collection routes and limits; extended in group 6), [databricks-platform.md](../../data/nate/databricks-platform.md) (components; confirmed and extended in group 7), [quality-and-value-classifiers.md](quality-and-value-classifiers.md) (quality axis inputs; its gate-before-regression note is reused in the design), [range-calibration.md](range-calibration.md) (conformal, Mondrian and ACI ranges; reused in the design, not repeated).

## 1. Inferring a ranker you do not own

- Surrogate learning-to-rank: fit a ranking model (pairwise or listwise) to observed result orderings, with features you can compute from the result page. *inferred* as a method; the observed-ordering input is the constraint, since only the rank, not the score, is visible.
- Model extraction: Tramer et al., "Stealing Machine Learning Models via Prediction APIs", arXiv 1609.02943 (2016). *asserted*, earlier retrieval, unopened in the final pass. Extraction assumes you can query with chosen inputs and see scores or labels; a rank list gives less than a score, *inferred*.
- Feature attribution on a surrogate (SHAP, LIME): explains the surrogate, not the true ranker. *inferred*. The attribution is only as faithful as the surrogate's held-out rank agreement.
- Bayesian posteriors over factor effects: put a prior on each factor's effect in a rank model (for example Plackett-Luce or ordinal regression) and report a posterior interval. *inferred* as a design; no marketplace-specific published use found (see Not found).
- Rank-factor studies in SEO are correlational. Search results (Exa, 2026-11-14) described volatility trackers and correlation studies as measuring a sample, not the algorithm: "Volatility trackers measure how much a sample of search results changes from day to day; they do not see Google's algorithms directly." *observed*, https://myseoexperts.com/serp-volatility-tracking-tools/ (published 2026-10-13). Correlation of a factor with rank does not show the factor is used; popular listings acquire the features (more photos, more keywords), *inferred*.
- Researcher audits: Hannak et al. style measurement of personalisation uses control accounts or identical simultaneous queries as a noise floor, with Jaccard overlap and Kendall tau between result lists. *asserted*, earlier retrieval; the paper page was not reopened in the final pass (unopened). The control-pair noise floor is the transferable idea: differences below it are not evidence of a factor, *inferred*.
- Marketplace specifics already in the repo: Etsy's published structure of relevance times quality, and eBay Best Match factors, are in [ranking-algorithms.md](../../list/nate/ranking-algorithms.md); eBay's own help page on Best Match is https://www.ebay.com/help/Selling/-/Optimizing_your_listings_for_Best_Match?id=4166 (listed in this run's URL set, *asserted* here, unopened in the final pass).

## 2. Experiments on marketplaces

- Amazon Manage Your Experiments (MYE): https://sell.amazon.com/tools/manage-your-experiments (fetched 200, 2026-11-14). *observed* that the page says a product is eligible if it belongs to an enrolled brand and has received enough traffic in recent weeks to produce valid results. The "66% probability" flag and weekly results come from the earlier retrieval, *asserted*, and the 66% was not found by grep in the final pass. Brand-registry gating means MYE is not available to a used-goods seller, *inferred*.
- eBay and Etsy: no built-in listing split-test tool found (Exa search 2026-11-14 returned Seller Hub pages for creating and revising listings and third-party guides recommending "A/B testing" without a platform tool). *observed* for what the eBay revise page allows: titles, photos and, for fixed-price listings, a lowered price can be edited, https://www.ebay.com/help/selling/listings/revising-listing?id=4356. So before/after tests on one listing are possible; randomised parallel tests need duplicate listings, *inferred*.
- A third-party open-source tool, "ebay-view-bot" (GitHub), describes importing Seller Hub CSVs and an "A/B Planner" that logs changes and compares before and after. *observed* from the repo README text in search results, https://github.com/SandraRodriguez864/ebay-view-bot; its code and claims were not tested.
- Interference: when listings compete in one results page, treating one listing changes the others' outcomes, so listing-level A/B estimates are biased. *asserted*, earlier retrieval (two-sided marketplace interference papers, abstracts not reopened, unopened). For one-of-a-kind items the control for an item is another item, so matched pairs on item attributes are the usable design, *inferred*.
- Small-volume sample sizes: *inferred* arithmetic. Detecting a click-through rate move from 2% to 3% at 80% power and 5% two-sided needs roughly 3,800 impressions per arm; detecting a sale-rate move from 5% to 7.5% needs roughly 1,500 listings per arm. Numbers are standard two-proportion approximations, not from a source. A seller with tens of listings cannot reach these per-listing; pooled across many sellers or read as a posterior with a wide interval, they can.

## 3. Adaptive allocation

- Thompson sampling for dynamic pricing in production: Ganti, Sustik, Tran, Seaman, "Thompson Sampling for Dynamic Pricing", arXiv 1802.03050 (2018-02-08). *observed* in the search result: it ran Max-Rev-TS on a real e-commerce system for five weeks and reports a statistically significant improvement over passive learning.
- Ferreira, Simchi-Levi, Wang, "Online Network Revenue Management Using Thompson Sampling", Operations Research (2018-11-21), https://pubsonline.informs.org/doi/10.1287/opre.2018.1755. *observed* abstract: limited inventory, unknown demand parameters, regret guarantees.
- Bastani, Simchi-Levi, Zhu, "Meta Dynamic Pricing: Learning Across Experiments", arXiv 1902.10918 (2019-02-28). *observed* abstract: a prior shared across related products is learned online; useful where each item sells once, *inferred*.
- One-of-a-kind items: Hu and Zak, "A Procedure to Set Prices and Select Inventory in Thinly Traded Markets Using Data from eBay", J. Risk Financial Manag. 15(7):297 (2022-07-05), https://doi.org/10.3390/jrfm15070297. *observed* abstract: uses listing duration, cost and price; the example data are 319 sold items from a vintage auto-parts seller. Not a bandit; a portfolio method.
- Avramidis, "Learning in revenue management: Exploiting estimation of arrival rate and price response" (2011), https://eprints.soton.ac.uk/151849/1/v35.pdf. *observed* abstract: single-unit price rises with salvage value; optimal price rises with prior uncertainty.
- Titles and images: Beta-Bernoulli Thompson sampling on click or sale outcomes is standard, *asserted*. A marketplace-published use on seller listings was not found.
- Safety limits (price floor, exploration budget, allocation floor, ramp cap, fallback to the current arm): from earlier retrieval, *asserted*; in this design they are *inferred* constraints. A one-of-a-kind item cannot be re-sold if mispriced low, so the price floor is a hard constraint, *inferred*.
- Databricks: no official bandit example found. A community post "Reinforcement Learning on Databricks: building a contextual bandit" exists (https://community.databricks.com/t5/technical-blog/reinforcement-learning-on-databricks-building-a-contextual/ba-p/175818, unopened) and a third-party post, https://www.axecrafted.com/en/posts/winning-with-multi-armed-bandits-smarter-experimentation-in-databricks/ (fetched 200, 2026-11-14, *observed* to be about multi-armed bandits in Databricks). Neither is official.

## 4. Change detection

- Rank-volatility trackers compare a fixed keyword sample day over day and aggregate to one score. *observed*, Semrush KB: "We measure how much has changed in a day using Levenshtein distance (as a basis) and normalization," https://www.semrush.com/kb/653-how-is-the-sensor-score-calculated; Sensor bands are 0-2 low, 2-5 normal, 5-8 high, 8-10 very high, https://www.semrush.com/kb/652-sensor (published 2017-03-02; page itself says the sample is a limited set of keywords).
- MozCast: *observed* via https://ppc.land/mozcast/ (published 2026-10-20) that at launch it tracked 1,000 keywords, top 10 results, delta averaged and multiplied by a constant (28.0 in 2012) to make an average day about 70 F; the page says Moz's own methodology page could not be retrieved, so current size (about 10,000 keywords) is second-hand.
- What transfers: a fixed panel of queries per site, a daily rank-list distance (Levenshtein or Kendall tau), an own-baseline, and a control. *inferred*. The same panel gives the noise floor for group 1.
- Change-point and drift methods (BOCPD, offline change-point review, a benchmark of algorithms; ACI and weighted conformal under drift) are in the earlier retrieval and in [range-calibration.md](range-calibration.md). arXiv ids from this run's URL set (2002.12528, 2103.09763, 2106.00170, 2202.13415 and others) were not reopened for titles in the final pass, so no title is claimed here (unopened).
- Databricks data profiling supports drift between successive windows and against a baseline table, *observed*: "Is there drift between the current data and a known baseline, or between successive time windows of the data?" https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-quality-monitoring/data-profiling/ (fetched 200, 2026-11-14). The drift statistics list (KS, chi-squared, PSI, Wasserstein, JS) is from [databricks-platform.md](../../data/nate/databricks-platform.md), confirmed there, not rechecked here.

## 5. Scoring

- Expected-value form: score = P(sale within horizon) x net proceeds, minus holding cost per day x expected time; this is *inferred* from the survival and net-proceeds pieces already in the repo notes. Thin-market portfolio work (Hu and Zak, group 3) is the one published eBay-based formulation found that combines price, shelf duration and cash flow.
- Etsy ranks on relevance and quality, S = R x Q, per the earlier retrieval (Etsy Code as Craft pages in the URL set, *asserted*; see [ranking-algorithms.md](../../list/nate/ranking-algorithms.md)).
- Survival and cure models for time-to-sale and ranges around them: see [quality-and-value-classifiers.md](quality-and-value-classifiers.md) and [range-calibration.md](range-calibration.md); not repeated.
- Published, validated listing-quality scores: not found beyond those notes (see Not found).
- Combination: weights across four axes are a value judgement; there is no source for correct weights, *inferred*. Reporting each axis separately with its range, plus one combined number only when all inputs clear their hide rules, is a design choice in the closing section.

## 6. Lawful data: what each marketplace provides and the licence facts

Data the engine would use (all of it; the founders decided licence and terms facts do not limit the design):
- Observed result pages per site, collected on a fixed panel of queries (per group 4). Collection limits already found are in [observing-rank-and-performance.md](../../list/nate/observing-rank-and-performance.md).
- Sold and asking prices per site, from the routes in the data notes.
- Sellers' own analytics: eBay Seller Hub traffic reports (impressions, views, CTR) and the Sell Analytics traffic report API (the official getTrafficReport page returned HTTP 403 to curl, so only the generated client docs, https://github.com/zVPS/ebay-sell-analytics-php-client/blob/main/docs/Api/TrafficReportApi.md, were seen, unopened in the final pass); Etsy Shop Stats (https://help.etsy.com/hc/en-us/articles/115015628207-Shop-Stats-Glossary, *asserted*, unopened in the final pass). Depop, Poshmark, Mercari and Facebook Marketplace: a seller analytics route was not confirmed (Poshmark help page failed to connect).
- Experiments the engine runs on its own users' listings (group 2).

Licence and terms facts, recorded as facts (earlier retrieval, *asserted*, pages not reopened in the final pass; verify before relying):

| Source | Fact recorded | What would change for a public launch |
|---|---|---|
| Observed result pages (any site) | Site terms generally restrict automated collection; the exact clause per site is in the observing note | Need the site's written permission or an official feed, or the data is not usable at public scale |
| eBay APIs | Developer programme licence governs use and retention; the traffic report is for the seller's own account | An approved production app and the licence's data-use terms |
| Etsy | API terms and search-advertisement policy page https://www.etsy.com/legal/policy/search-advertisement-recommendation/899478564529 (unopened) | Commercial-use approval for the API app |
| Seller's own analytics | Visible to the account holder; reuse by a third party needs the seller's authorisation | A consent flow and stored authorisation per seller |
| Other sites | Terms not reopened | Review per site |

## 7. Databricks components (official docs, fetched 2026-11-14)

- Online feature serving: Online Feature Stores are powered by Lakebase, new ones are created as Lakebase Autoscaling projects, and `create_online_store` creates the instance; capacity is a Lakebase Compute Unit setting. *observed*, https://docs.databricks.com/aws/en/machine-learning/feature-store/online-feature-store. Carries: per-listing features (price, rank, own CTR) for low-latency scoring.
- Feature engineering and materialization, publish modes, FeatureSpec and Feature Serving: pages https://docs.databricks.com/aws/en/machine-learning/feature-store/materialized-features, .../publish-features, .../feature-function-serving; *asserted* from [databricks-platform.md](../../data/nate/databricks-platform.md), not reopened.
- MLflow tracking and registry aliases: *observed*, "you could allocate a 'Champion' alias to the model version currently in production and target this alias in workloads", https://docs.databricks.com/aws/en/machine-learning/manage-model-lifecycle/. A 'Challenger' alias is the same mechanism, *inferred*. Carries: the surrogate ranker and the scoring models, with a challenger scored on live traffic before promotion.
- Model serving limits: *observed*, https://docs.databricks.com/aws/en/machine-learning/model-serving/model-serving-limits: 300,000 queries per second per endpoint with route optimisation, 16 MB payload per request, 1000 endpoints per workspace by default.
- Data and model drift: Data profiling (formerly Lakehouse Monitoring) provides drift metrics tables, baseline tables and model-quality profiling, *observed*, URL in group 4. Carries change detection on rank lists and on model inputs; change-point logic beyond these statistics is custom, *inferred*.
- AI Functions for derived features (titles, descriptions to attributes): https://docs.databricks.com/aws/en/large-language-models/ai-functions fetched in an earlier step but the final grep was lost, so exact function names and limits are *asserted* from [databricks-platform.md](../../data/nate/databricks-platform.md), which marks some items Beta.
- Pipelines for the observation stream: Lakeflow pipelines and job triggers (https://docs.databricks.com/aws/en/jobs/triggers, *asserted*, unopened in the final pass).
- Bandits and experimentation: no official Databricks example found. Bandit state (Beta counts per arm) is a small table in Unity Catalog read from the online store, *inferred*.

## Closing design (inferred; nothing below is sourced as a product)

Four axes, each reported with a range, a basis and a hide rule:

| Axis | Range from | Basis shown | Hide when |
|---|---|---|---|
| Financial | conformal interval on net proceeds and a survival band on time to sale ([range-calibration.md](range-calibration.md)) | comparable sold count and window | fewer comparables than the calibration set supports, or interval wider than the point value |
| Quality | classifier probability with Mondrian-style group coverage ([quality-and-value-classifiers.md](quality-and-value-classifiers.md)) | which photo and text fields were present | gate fails (the gate-before-regression note) |
| Visibility, per site | posterior interval on rank position or impression share from the fitted surrogate and the seller's own analytics where present | panel size, days observed, noise floor from control pairs | surrogate held-out rank agreement not above the control-pair noise floor, or panel stale |
| Trend | change-point or drift flag on price and rank series, with run length | window and detector | series shorter than the detector's burn-in, or a ranker-change flag is active for that site |

Loop: observe (daily fixed-panel result pages, listing analytics, sales) then fit (surrogate, posteriors, survival) then experiment (matched pairs, Thompson sampling within a price floor and an exploration budget) then detect change (rank-list distance against the control noise floor, plus data-profiling drift) then re-plan (challenger models scored beside the Champion; when a change flag is up for a site, visibility ranges for that site widen or hide until refit).

Minimum volume at which each part says anything (inferred, from the arithmetic in group 2 and standard practice, to be checked on real data): a rank-list distance needs a panel of the order of hundreds of queries per site for a daily signal (MozCast started at 1,000); a surrogate needs enough observed lists to beat a control-pair floor, unknown until measured; a CTR test needs about 3,800 impressions per arm for a 2% to 3% move; a sale-rate test about 1,500 listings per arm; a Thompson-sampling arm is informative only after tens of exposures, and sale outcomes of one-of-a-kind items accumulate slowly, so price arms rely on the pooled prior (group 3, Bastani et al.).

Must never claim: that a factor weight is the site's real weight (it is a surrogate's estimate); a causal effect from an observational rank correlation; that one site's findings hold for another; a visibility number when the change flag is up or the panel is stale; a combined score when any axis is hidden; a sale probability for an item with no comparables; that a price test was randomised when it was before and after.

## Not found

- An official Databricks bandit or experimentation example (only community and third-party posts).
- A built-in listing split-test tool on eBay or Etsy (Amazon MYE exists but is gated to enrolled brands).
- A published marketplace use of Bayesian posteriors over ranker factor effects.
- A published, externally validated listing-quality score for used goods beyond what the existing notes hold.
- Seller analytics routes for Depop, Poshmark, Mercari and Facebook Marketplace (Poshmark help URL failed to connect).
- The "66%" Amazon MYE probability flag in the final page grep.
- Titles of five arXiv items (2002.12528, 2103.09763, 2106.00170, 2202.13415, 1905.03222) in the final pass.

## Searched / could not reach

Searched: OpenAlex (noisy, dropped in favour of known papers via arXiv), Exa for volatility trackers, dynamic pricing, eBay seller tests, Databricks bandits, Hannak audits. Could not reach: eBay getTrafficReport official page (403), Poshmark help (connection failure). Not reopened in the final pass: Databricks AI Functions page grep (lost to an overwritten file), Hannak and Tramer papers, interference papers. A narrow search does not prove absence.

## Sources fetched

- https://www.semrush.com/kb/653-how-is-the-sensor-score-calculated (observed, search text)
- https://www.semrush.com/kb/652-sensor (observed, search text)
- https://myseoexperts.com/serp-volatility-tracking-tools/ (observed, search text, 2026-10-13)
- https://ppc.land/mozcast/ (observed, search text, 2026-10-20)
- https://arxiv.org/abs/1802.03050, https://arxiv.org/abs/1902.10918v1, https://pubsonline.informs.org/doi/10.1287/opre.2018.1755, https://doi.org/10.3390/jrfm15070297, https://eprints.soton.ac.uk/151849/1/v35.pdf (observed abstracts in search text)
- https://www.ebay.com/help/selling/listings/revising-listing?id=4356 (observed, search text); https://github.com/SandraRodriguez864/ebay-view-bot (observed README text, not run)
- https://sell.amazon.com/tools/manage-your-experiments (curl 200, grep)
- https://docs.databricks.com/aws/en/machine-learning/feature-store/online-feature-store, .../manage-model-lifecycle/, .../model-serving/model-serving-limits, .../data-quality-monitoring/data-profiling/ (curl 200, grep)
- https://www.axecrafted.com/en/posts/winning-with-multi-armed-bandits-smarter-experimentation-in-databricks/ (curl 200, third-party)
