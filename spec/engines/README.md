# spec/engines/

One document per engine. All are *agent proposal* for Ben and Nate. Every document has the same ten sections: what it decides, signals, the calculation, learning, speed, what the person sees, how it beats what exists, protections, proof, build tasks. The tasks that can start at once are in [plans/start-now.md](../plans/start-now.md); the full graph is `plans/backend/plan.md` when it lands.

Read [protocol-and-adapters](protocol-and-adapters.md) and [intelligence-api](intelligence-api.md) first: every other engine reads and acts through them.

| Engine | What it decides |
|---|---|
| [protocol-and-adapters](protocol-and-adapters.md) | How each site is reached and acted on: our own adapters first, measured per site, repaired when a site changes |
| [intelligence-api](intelligence-api.md) | How any price, fact or figure is found: a protocol per kind of question, every source started at once, and a wider search when the basis is thin |
| [capture](capture.md) | The capture process for each product type and the fewest follow-up inputs it needs |
| [identity](identity.md) | Whether two listings are the same product, exact or comparable |
| [valuation](valuation.md) | The price range, what the person keeps per site, the chance of sale, and the price slider |
| [photo](photo.md) | The photo set per site: order, crop, caps, and what an edit may not change |
| [negotiation](negotiation.md) | Accept, decline or counter an offer, and the amount and hour of an offer we send |
| [trust](trust.md) | Block, ask or warn on a buyer thread; no-shows, account health, disputes, recalls |
| [demand-and-trend](demand-and-trend.md) | A forward forecast of demand and price per product |
| [recommendation-and-style](recommendation-and-style.md) | What to show each person, and which owned items to sell now |
| [platform-analytics](platform-analytics.md) | Which storefront does best for a person, compared fairly |

How the plan for each site is chosen is in [marketing-engine.md](../marketing-engine.md), written before this folder existed and in the same shape.
