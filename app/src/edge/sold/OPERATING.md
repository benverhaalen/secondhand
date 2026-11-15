# Sold: how the sale is seen, per verb

*agent proposal*, built from [Ben's ladder](../../../../research/sold/ben/cheap-sale-detection.md#1-the-ladder-cheapest-signal-first-one-authoritative-read-last) and [protocol and adapters §3.5 and §3.6](../../../../spec/engines/protocol-and-adapters.md#36-how-every-event-reaches-the-system-agent-proposal). The code is [sold.ts](sold.ts). The end-to-end proof is [sale.test.ts](../events/sale.test.ts).

## The ladder per site

| Site | Cheap trigger | Confirms | Cadence (param `watch_cadence_s`) |
|---|---|---|---|
| eBay | the signed push (`ORDER_CONFIRMATION`, [webhook.ts](../events/webhook.ts)) | signed-in `read_orders` | push in seconds; sweep by tier as the backstop |
| Facebook | our own state: the agent booked the pickup | the appointment reaching `done` | none; polling Facebook is the riskiest read of the five |
| Depop | the signed-in sweep, notification feed first ([schedule.ts](../events/schedule.ts)) | the same sweep's orders read | 90 s hot, 15 min live, hourly quiet |
| Poshmark | a public listing page fetch, no session | signed-in `read_orders` | 1 to 2 min |
| Mercari | a public listing page fetch, no session; a bot wall is `unknown` | signed-in `read_orders` | 1 to 2 min |

## Per verb

| Verb or step | Route | Reads | Returns | Never |
|---|---|---|---|---|
| public check (rung 3) | a server `GET` of the public listing page, plain User-Agent, no cookies | JSON-LD `offers.availability`, then `product:availability` meta, then the "This item is sold" banner | `sold`, `live` or `unknown` with why | acts on its own; routes around a bot wall; is trusted for the amount, the buyer or the order |
| `read_orders` (rung 4) | the signed-in harness in the person's leased session | the paid order for the listing | the order row (`orderBook.apply`), `new_sale` once | waits for the person: an expired session pauses the job (as-1) |
| `end` (the delist) | the signed-in harness, one job per other listing, in parallel, each holding its account's lease through the read-back | the listing's state after the end | `delisted`, retry up to `delist_max_attempts`, then one `failed_delist` decision | runs before the sale is confirmed; runs twice for one listing |

Budget: delist p95 under 2 min after the sale is seen, red at 5 min. A paused job on a stale account is counted against it, so a relink decision is raised once and is the first card on Today.

## Observed run

2026-11-14, signed out, one request to a public Poshmark sold listing (Ben's example): HTTP 200 in 444 ms, read `sold` from JSON-LD `OutOfStock` in 1 ms. The page also carries `product:availability` `oos` and the sold banner, so all three readers agree. Trace: [runs/sd-1.md](../../../../research/cross-cutting/nate/runs/sd-1.md). Missing: nothing the public route is asked for. It cannot return the order, the amount or the buyer, so it is never used for them. The first run read the page as a bot wall, because a normal page loads a captcha script. That reader was tightened and the case is now a test.

Not run against a live account: the signed-in `read_orders` and `end` wait for Nate's go per site.
