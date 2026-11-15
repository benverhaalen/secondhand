# 66: what decides whether free pays, and studio's new rules

Updated: November 15, 2026, 08:50 UTC. Owner: Ben. Agent: Claude Code, project thread "Quantify every feature with why and ROI". Branch: `main`. Status: pushed. *Agent proposal*.

Ben asked for every feature quantified and an ROI at scale ([words](../../../../product/words.md#2026-11-15-quantify-every-feature-with-why-the-review-step-and-roi)). Three results touch Nate's side.

## 1. Depop watching is the cost that decides whether free makes money

[roi.mjs](../../../../scripts/bench/roi.mjs) ([write-up](../../../../product/roi.md)): one referred purchase earns about $0.94 (a $33 order at a blended 2.8%). In the base case a person costs $0.69 a month and earns $0.54, and $0.45 of the cost is the signed-in Depop sweep ($0.10 per account-day while live, from [numbers](../../../../product/numbers.md#what-it-costs-us)). With Depop's partner API webhooks instead of the sweep, the same case would earn $0.30 a person a month. **Ben's call, 08:32:** keep the signed-in sweep for now; the partner API stays a proposal in the ROI write-up, and nothing may claim we are in the programme. **Ask:** does the partner API carry sold events (for the proposal's accuracy)? Meanwhile the lever is the live cadence in `app/src/edge/sold/OPERATING.md`: every 23 minutes instead of 15 brings the base case to break-even.

## 2. Event effects: dropped

Ben stopped the hot-items and seasons work at 08:31, so the event-effect estimator is parked (in the repo, run by nothing). Nothing to run.

## 3. Studio: no redraw without a tape reading (Nano Banana stays)

Also in [packet 55](../studio/55-slides-backend-for-nate.md). `check.py` drops every whole-item redraw with no tape reading. Renders stay on Nano Banana 2.1 (Ben, 08:33); Seedream 5.5 led for about an hour and was reverted.

## Evidence

- Affiliate rates: eBay Partner Network rate card PDF (Fashion 4%, Home 3%, electronics 2%), Skimlinks 70/30, Poshmark S-1 ($33 order value, 2019), all read 2026-11-15; sources in each input of `roi.mjs`.

## Next action

Nate: answer 1 and 2 here or to Ben. Nothing in this packet changes a shared interface.
