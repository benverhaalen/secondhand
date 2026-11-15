# 66: what decides whether free pays, a measured event effect for the nightly jobs, and studio's new rules

Updated: November 15, 2026, 08:50 UTC. Owner: Ben. Agent: Claude Code, project thread "Quantify every feature with why and ROI". Branch: `main`. Status: pushed. *Agent proposal*.

Ben asked for every feature quantified and an ROI at scale ([words](../../../../product/words.md#2026-11-15-quantify-every-feature-with-why-the-review-step-and-roi)). Three results touch Nate's side.

## 1. Depop watching is the cost that decides whether free makes money

[roi.mjs](../../../../scripts/bench/roi.mjs) ([write-up](../../../../product/roi.md)): one referred purchase earns about $0.94 (a $33 order at a blended 2.8%). In the base case a person costs $0.68 a month and earns $0.54, and $0.45 of the cost is the signed-in Depop sweep ($0.10 per account-day while live, from [numbers](../../../../product/numbers.md#what-it-costs-us)). With Depop's partner API webhooks instead of the sweep, the same case earns $0.31 a person a month. **Ask:** is the partner programme application something you can start, and does the partner API carry sold events? If the sweep stays, the cadence in `app/src/edge/sold/OPERATING.md` is the lever.

## 2. Event effects can be measured nightly instead of hand-set

[event_effect.py](../../../../jobs/demand/event_effect.py): a difference in differences of sales per listing-week, the group against a control group on the same weeks, 4 weeks a side, placebo dates as the check, abstaining below 8 sales a cell. Its `effect` is what `events.Event.effect` takes. It needs the comp tables grouped by product type and week with exposure (listing-weeks). **Ask:** whether the nightly fits job can run it over `comp` for the events we list (move-out, first cold week, a local team's title), writing a param row per event with its interval.

## 3. Studio: Seedream 5.5 first, and no redraw without a tape reading

Also in [packet 55](../studio/55-slides-backend-for-nate.md#update-2026-11-15-0830-thread-quantify-every-feature-with-why-and-roi). `slides_run.py` now leads with four Seedream 5.5 seeds and one Nano Banana 2.1 fallback; `check.py` drops every whole-item redraw with no tape reading. If you run the slides job, the log shows whether OpenRouter answered for `bytedance-seed/seedream-5-5` (its page is live; the slug was missing from the model list this morning). If it didn't, Runware is the next host at the same $0.02.

## Evidence

- Affiliate rates: eBay Partner Network rate card PDF (Fashion 4%, Home 3%, electronics 2%), Skimlinks 70/30, Poshmark S-1 ($33 order value, 2019), all read 2026-11-15; sources in each input of `roi.mjs`.
- Event study method: Hausman and Rapson 2018 (NBER w23602), on why a regression discontinuity in time needs a control and placebos.

## Next action

Nate: answer 1 and 2 here or to Ben. Nothing in this packet changes a shared interface.
