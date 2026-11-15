# Demand and trend engine: what it must determine, the best method for each, and what will break it
Researched 2026-11-14 by Nate (Claude Opus 5.5, expert session ex-dt). Feature: cross-cutting (price, market, insights, research).

Professional view taken: a demand-forecasting and pricing analyst at a resale marketplace (sparse-sale velocity, seasonality, event spikes, trend detection), checked against how a full-time reseller reads sell-through and season. Reviewed against [spec/engines/demand-and-trend.md](../../../spec/engines/demand-and-trend.md) §1, §3, §9, §10 and dt-1..dt-6 in [spec/plans/backend/plan.json](../../../spec/plans/backend/plan.json). Every change below is *agent proposal*; nothing is Decided.

Marks: *observed* = opened the source and it says so; *asserted* = memory or an unshown claim; *inferred* = my reasoning.

## Sources opened, and the job each does

| Source | Job | What we take |
|---|---|---|
| Teunter, Syntetos, Babai, "Intermittent demand: linking forecasting to inventory obsolescence", EJOR 214(3) 606-615, 2011 (pure.rug.nl PDF) | mechanism, baseline | Croston "is positively biased"; SBA is approximately unbiased; TSB "updates the demand probability in every period" and the demand size only after a positive demand, so it decays toward zero after long zero runs; Croston and SBA "stick to the pre-obsolescence estimates" (*observed*). |
| Adams and MacKay, Bayesian Online Changepoint Detection, arXiv 0710.3742 | mechanism | exact online inference of the current run length by message passing; modular over the observation model (*observed*). Poisson-Gamma is a conjugate fit for it (*inferred*). |
| Prophet docs, Seasonality, Holiday Effects and Regressors (facebook.github.io/prophet, page dated 2026-08-15) | mechanism | holidays as a table of every past and future occurrence, with `lower_window` and `upper_window` around the date and a per-holiday `prior_scale` (*observed*). |
| Google Trends API alpha (developers.google.com/search/apis/trends) | signal source | alpha access by application; rolling 5 years; daily to yearly aggregation; "consistently scaled" data that "is not scaled from 0 to 100", so terms merge across requests (*observed*). |
| Schoenegger et al., Wisdom of the Silicon Crowd, arXiv 2402.19379 | evidence | 12-LLM crowd on 31 binary questions not statistically different from a 925-person crowd; an "acquiescence effect", mean predictions above 50% on an even split of outcomes (*observed*). |
| Halawi et al., Approaching Human-Level Forecasting with Language Models, arXiv 2402.18563 | evidence, mechanism | evaluated "under a test set published after the knowledge cut-offs" of the models; the system "nears the crowd aggregate" (*observed*). |

Not opened: the M5 uncertainty competition paper (weighted scaled pinball loss), any site's sold-history window, eBay's Best Offer display rule, Terapeak's sell-through definition. Claims resting on them are *asserted*.

## (a) and (b): what to determine, item by item against §1, and the best method

### 1. Sold velocity with p10 to p90, per site and across sites

What must be determined: the weekly sale rate of a product (and family, attribute, category) and its uncertainty, when most products sell zero to three times a week.

Best method: the spec's Gamma-Poisson with forgetting is the right core (conjugate, cheap, honest on one sale). Four things are missing.
- **Censored and missing weeks.** A zero must mean "read and nothing sold", not "not read". Weeks before the product was first read, weeks where a site's adapter failed or was frozen, and weeks outside a site's visible sold window are missing: they add nothing to a or b (*inferred*). The spec's "zero sales read as zero demand without censoring" (dt-1 accepts) names the risk but §3 step 2 gives no rule. Rule: exposure `t` counts only weeks with a successful read for that site; each comp read records its visible window.
- **Truncated reads.** A search that returns its page cap (say 200 sold results) has a count that is a lower bound. Treat it as right-censored: the Gamma update with a censored Poisson count has no closed form, so either page until the cap is not hit or mark the week `n >= cap` and widen (*inferred*).
- **Supply censoring.** Sales cannot exceed what is listed; zero live listings and zero sales is no information about demand (*inferred*, the standard lost-sales problem). Divide exposure by supply when supply is near zero, or skip the week: `t_week = min(1, listed_count / median listed_count)`.
- **Forgetting the prior.** "Data 8 weeks old counts half" is a power prior with weekly factor `0.5^(1/8) ≈ 0.917` applied to the data part of a and b; the prior's 2 weeks of weight must not decay, or a long-quiet product's interval collapses to the data alone (*inferred*). The worked example (Gamma(4,2) plus 24 sales over 12 weeks to about Gamma(22,10)) checks out: the discounted exposure is about 7.8 weeks (*inferred* arithmetic).
- Baselines to beat, inside the backtest: TSB (decays after zero runs, which matches a product that stopped selling) and SBA (*observed* the properties). The spec's only baseline is "carry the last 4 weeks forward", which is weak on intermittent series and makes test 1 easy to pass (*inferred*).
- Report the rate interval and the count interval apart. The Gamma p10 to p90 is on the rate; "8 to 14 sell" is the negative-binomial predictive and is always wider (*inferred*). §6 uses the predictive; §1 says velocity range; name which one each surface reads.

Reseller check: resellers judge "does it sell" by sell-through rate, sold divided by sold plus active over a period, as Terapeak shows it (*asserted*). The turnover signal (sold per live listing) is close but counts stale overpriced listings as supply; show sell-through in the reseller's form beside velocity (*inferred*).

### 2. Demand index D and direction

What must be determined: whether wanting is rising, falling or steady, with a false-alarm rate the person can trust.

Best method: a sequential change test on the sold count, with D as a secondary explanation.
- Weekly repeated tests at 5% plus a 2-read rule have no stated false-alarm rate over time: with 52 reads a year per product, a 5% test alerts on steady products many times (*inferred*). Use a Poisson CUSUM or Bayesian online change-point detection (*observed* BOCPD method) tuned to an average run length between false alarms (for example one false `demand_rose` per product per two years), and state that number as the `param`.
- Benjamini-Hochberg controls false discoveries across products in one read, not across repeated reads of one product (*inferred*). Keep BH for the category list, and the sequential test for each owned product's notice.
- Spikes are not trends. A TikTok moment, a celebrity death, a show's new season: a burst that fades in 2 to 4 weeks. With 8-week half-life forgetting, a burst inflates the rate for two months (*inferred*). The change-point model handles this if it allows a change back; also cap a single week's contribution at the kind's 99th percentile weekly count, as §3 step 1 already does for watchers.
- Category tide: removing the category's movement before testing a product (§3 step 3) is right; it must use the same week's category rate excluding the product itself (*inferred*).
- D's weights refit by NNLS on overlapping 28-day windows: the windows are autocorrelated, so the bootstrap must be a block bootstrap by product and by 4-week block (*inferred*).

### 3. Forecast at 4, 8 and 12 weeks: count and median sold price

What must be determined: p10, p50, p90 of sales count and median price at each horizon, with coverage that holds.

Best method: the negative-binomial predictive with season and event terms, scored as the M5 uncertainty track scored intermittent retail series (weighted scaled pinball loss) (*asserted*, paper not opened).
- Score with scaled pinball (divide by the series' own in-sample naive error) so a product selling 30 a week does not drown 300 that sell 1 (*asserted* method; *inferred* need).
- Discrete coverage: for a count predictive with mean 0.5, the interval p10 to p90 is often [0, 1] and covers about 90% by construction. Coverage of 75 to 85% can be met with useless intervals (*inferred*). Report interval width (sharpness) beside coverage, and use randomised PIT for counts.
- Coverage per kind and horizon, not pooled: a pooled 80% can hide 60% on cards and 95% on apparel (*inferred*).
- Price forecast from sold comps: eBay "Best Offer accepted" sales show the listed price, not the accepted one (*asserted*; 130point exists because of this). The p50 of sold prices is biased upward wherever offers are common. Flag `best_offer_accepted` comps and either drop them from the price median or discount them by the kind's learned offer ratio (*inferred*).
- Poshmark and Mercari bundle sales show each item's listed price, not the paid share (*asserted*); the identity note asks for a `bundle_sale` flag, and price forecasts must exclude them (*inferred*).

### 4. Event effects: release, restock, season

What must be determined: the expected effect and range of a coming event on count and price.

Best method: holiday-style event windows with every past and future occurrence and a window around each date (*observed* Prophet's form), pooled by category so a product with one past release borrows strength.
- Monthly `season_m` misses moving holidays and short windows. Black Friday and Cyber Monday move by date; Easter moves by weeks; Prime Day moves by year; Christmas has a shipping cutoff around mid-December after which shipped-marketplace sales drop and local pickup does not (*asserted* the reseller pattern). Use weekly event windows, each a `param`, by site: Facebook local behaves unlike eBay shipped (*inferred*).
- Supply seasons matter as much as demand: January brings gift returns and closet clear-outs, so listings rise and prices fall even when sales hold (*asserted* reseller lore). Model listed count's season separately, so "more for sale" is not read as "less wanted" (*inferred*).
- Season by kind and climate: coats sell from September, swim from March, back-to-school in July and August, tax-refund season lifts electronics and sneakers in February and March (*asserted*). Fit M12 factors per category with at least two years, shrunk to the parent category (*inferred*).
- Release effect M16 from 20 recent releases: small n; take the category median with its range, and never let one hyped release set the prior (*inferred*).

### 5. Alerts on owned and followed items

What must be determined: when a change is real and large enough to tell the person.
Best method: the sequential test above fires the candidate; M19's gate decides materiality in dollars on the person's item (a 20% rise on a $12 item is not worth a notice) (*inferred*). The alert must state its false-alarm rate in the `param`.

### 6. The research ensemble and its track record

What must be determined: a probability for a dated yes/no question, shown beside the arithmetic, with an honest record.
- Contamination: a model asked about a past question may know the answer. Halawi et al. evaluate only on questions published after the models' cutoffs (*observed*). The track record must count only questions created after the gateway model's training cutoff and resolved after they were asked; a model change resets or splits the record (*inferred*).
- Acquiescence: LLM crowds lean above 50% (*observed* in Schoenegger et al.). Phrase half the questions in the negative form, or recalibrate by Platt scaling on the record once it has 50 resolutions (*inferred*).
- Brier on 41 questions has a standard error near 0.03, larger than the 0.20 against 0.19 gap the spec cites (*inferred*). Show the record with the no-information reference (0.25) and the count, and do not show it under 20 resolved questions.
- The spec's "Brier 0.20 against 0.19" is not in the two abstracts opened; trace it to its paper or drop the number (*observed* absence in the abstracts; the full texts were not read).

## (c) What the doc misses or gets wrong, and what will break each task

1. No rule for missing, truncated or out-of-window weeks; zeros will be read as no demand (*inferred*).
2. No supply censoring: zero listed is not zero wanted (*inferred*).
3. The prior must not be forgotten with the data (*inferred*).
4. Repeated weekly tests have no stated false-alarm rate (*inferred*).
5. Monthly season factors miss moving holidays, shipping cutoffs and supply seasons (*observed* the event-window form; *asserted* the patterns).
6. Weak baseline in test 1 (*inferred*); TSB and SBA should be the bar (*observed* their properties).
7. Discrete coverage can pass with useless intervals; add sharpness (*inferred*).
8. Best Offer and bundle prices bias the price p50 upward (*asserted*).
9. Backtest leakage: comps have a sold date and an ingest date; identity merges re-point comps after the fact. A backtest must read as of ingest time and as of the cluster ids known then (*inferred*).
10. Survivorship in the fixed set: "at least 2 years of sold comps" picks products that kept selling, so forecasts of decline are never tested (*inferred*). Add products that stopped selling.
11. LLM track-record contamination (*observed* the evaluation practice).
12. Google Trends API is alpha and by application (*observed*): the signal may be absent; D must be stated with search interest missing, at weight 0, without failing.

Planted-input test ideas:
- A product first read today with a 90-day visible sold window and real sales before it: weeks before the window are missing, direction not "rising".
- Adapter down for 2 weeks: those weeks missing, interval wider, no `falling`.
- A search that returns exactly its 200-result cap: the week is a lower bound, not 200.
- Zero live listings for 3 weeks: no update to the rate.
- One sale ever: wide interval, p10 near 0.
- A steady Poisson(2) series over 104 weeks: at most the stated number of false `demand_rose`.
- A 3-week spike to 5x then back: no `demand_rose` after it ends; rate back within 4 weeks.
- A true step to 2x: `demand_rose` within 4 weekly reads.
- Thanksgiving falling on the 22nd and the 28th in two years: the Black Friday window follows the date.
- A product that stopped selling 10 weeks ago: TSB-like decay; forecast p50 near 0.
- Best Offer comps at listed $100, true $80: price p50 not $100.
- Backtest with a comp ingested after the origin: excluded.
- Ensemble asked a question resolved before the model's cutoff: not counted in the record.
- Search interest missing: D computed from the rest, weights renormalised.

## Diff list against spec/engines/demand-and-trend.md

- §3 step 2: exposure counts only weeks with a successful read inside the site's visible window; capped reads are lower bounds. *agent proposal*
- §3 step 2: supply-weighted exposure when listed count is near zero. *agent proposal*
- §3 step 2: forgetting applies to the data, never to the prior's 2 weeks. *agent proposal*
- §3 step 3: owned-product direction from a Poisson CUSUM or BOCPD with a stated average run length; BH stays for category lists. *agent proposal*
- §3 step 4: weekly event windows (Prophet form) per site, replacing monthly-only `season_m`; listed count gets its own season. *agent proposal*
- §3 step 5: price median excludes or discounts Best Offer and bundle comps. *agent proposal*
- §3 step 7: track record counts post-cutoff questions only, shown from 20 resolved with the 0.25 reference; trace or drop "Brier 0.20 against 0.19". *agent proposal*
- §4: scaled pinball loss for promotion; block bootstrap by product and 4-week block. *agent proposal*
- §6: say which surfaces read the rate interval and which the count predictive; add sell-through in the reseller's form. *agent proposal*
- §9 test 1: the bar is TSB and SBA, not last-4-weeks carry-forward. *agent proposal*
- §9 test 2: coverage per kind and horizon, with interval width reported. *agent proposal*
- §9 fixed set: add 50 products that stopped selling; backtest as of ingest time. *agent proposal*

## Changes to tasks' accepts and breaks (spec/plans/backend/plan.json)

- **dt-1** accepts add: "missing, out-of-window and capped weeks do not count as zero"; "prior never forgotten". breaks add: {what: "first read with 90-day window", code: "earlier weeks missing"}, {what: "adapter down 2 weeks", code: "missing, wider"}, {what: "read at its result cap", code: "lower bound"}, {what: "zero live listings", code: "no update"}. *agent proposal*
- **dt-2** accepts change: "false-alarm rate stated as average run length and met on a steady series". breaks add: {what: "3-week spike then back", code: "no demand_rose after it"}, {what: "step to 2x", code: "demand_rose within 4 reads"}, {what: "listings rise, sales flat", code: "more for sale"}. *agent proposal*
- **dt-3** accepts add: "event windows by date, per site"; "price p50 without Best Offer and bundle bias". breaks add: {what: "Thanksgiving date moves", code: "window follows"}, {what: "Best Offer comps", code: "excluded or discounted"}, {what: "stopped selling 10 weeks", code: "p50 near 0"}. *agent proposal*
- **dt-4** accepts add: "coverage per kind and horizon with width"; "promotion on scaled pinball with block bootstrap". breaks add: {what: "intervals [0,1] on low-rate items", code: "sharpness reported, not a pass by itself"}. *agent proposal*
- **dt-5** accepts add: "record counts post-cutoff questions only; hidden under 20". breaks add: {what: "question resolved before model cutoff", code: "not in record"}, {what: "model version change", code: "record split"}, {what: "all-yes acquiescent runs", code: "recalibrated or flagged"}. *agent proposal*
- **dt-6** accepts change: "beats TSB and SBA; as-of-ingest backtest; set includes products that stopped selling". breaks add: {what: "comp ingested after origin", code: "fail"}, {what: "cluster id from after origin", code: "fail"}. *agent proposal*

## Limits

Opened: TSB, BOCPD, Prophet holidays, the Google Trends API page, two LLM-forecasting papers (abstracts and introductions). Not opened: M5 papers, any marketplace's sold-history window or Best Offer display, fee pages, Terapeak docs. Reseller season patterns are from memory and need a check against our own comps before they become `param` start values.
