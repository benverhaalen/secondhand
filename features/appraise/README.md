# Appraise

Status: idea. Owner: unassigned. Packet topic: `appraise`.

Spec (agent proposal): [spec/features/appraise.md](../../spec/features/appraise.md).

## What and why
Point the app at something, for example at a garage sale, and get what it is worth: by platform (eBay and Depop value the same item differently), after its defects, and including the less obvious reasons someone would want it. This is "Exa search, but for the market value of a secondhand product". It shares its engine with [price](../price/), but the entry point is buying rather than selling. Ben: [words](../../product/words.md#2026-11-14-pavlo-and-appraise).

## How it works
Not designed yet. Ben calls it "a multidimensional problem". The inputs to research are identity, condition and defects, the market and platform, comparable sold prices against asking prices, and hidden demand signals such as era, collectibility and trends.

## Decided
Nothing yet. Each entry here links to [decisions.md](../../product/decisions.md).

## Open
- Which dimensions actually move the price, and where can we get sold-price data for each platform?
- How should the app show a value that depends on the market: one number, a range for each platform, or "sell here for X"?

## Research
All research for this feature: [research/appraise/](../../research/appraise/)
- Ben: [research/appraise/ben/](../../research/appraise/ben/)
- Nate: `research/appraise/nate/` (none yet)
- *Agent proposal:* appraisal is the pricing engine plus a buy decision (max pay after fees, time and risk), three speed tiers, and one targeted physical check per item; the edge over existing scanner apps is turning a purchase into a listing. [garage-sale.md](../../research/appraise/ben/garage-sale.md), [existing-tools.md](../../research/appraise/ben/existing-tools.md)
- *Agent proposal:* one appraisal run step by step (capture, Glance, identify, confirm, comps, adjust, range, next question, max pay, verdict, Bought it), with the API, latency and human checkpoint at each step, a fixed component catalog, and an evaluation copied from FlipTip's blind-test protocol. [appraisal-run.md](../../research/appraise/ben/appraisal-run.md)
