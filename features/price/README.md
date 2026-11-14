# Price and route

Status: idea. Owner: unassigned. Packet topic: `price`.

## What and why
Decide where to sell, at what price, and whether to ship or meet locally, with a slider that trades speed against price. *Agent proposal* from the concept brief.

## How it works
Not designed yet. Keep the mechanism here once research picks one, together with the reference it came from and the job that reference does.

## Decided
Nothing yet. Each entry here links to [decisions.md](../../product/decisions.md).

## Open
- Share-sheet deal check: show a typical sold-price band, with a "can't tell" state. It shares this feature's engine with [appraise](../appraise/).
- What price data can we legally get for each platform?

## Research
All research for this feature: [research/price/](../../research/price/)
- Ben: [research/price/ben/](../../research/price/ben/)
- Nate: [research/price/nate/](../../research/price/nate/)
- *Agent proposal:* value is a range per channel with days to sell, built from a few adjusted sold comps that are shown, with an abstain rule; sold-data access, not the model, is the constraint. [valuation-engine.md](../../research/price/ben/valuation-engine.md)
- *Agent proposal:* price like an illiquid asset: label each estimate Level 1/2/3, size the speed-vs-price slider from the item's liquidity (the bid–ask spread), and get days to sell from its queue position among competing listings. [pricing-in-context.md](../../research/price/ben/pricing-in-context.md)
