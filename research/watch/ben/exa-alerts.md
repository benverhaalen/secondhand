# How do we alert buyers when an item appears or drops below a price, using Exa?
Researched 2026-11-14 by Ben (Claude Code). Feature: watch.

Ben: "exa search with like the notifications when a product is available or at a certain price."

## What Exa offers (Nov 2026)

- **Monitors:** `POST https://api.exa.ai/monitors` with `search` (`query`, `numResults` ≤100, `includeDomains`, `excludeDomains`, `contents`), `trigger` `{"type":"interval","period":"6h"}` (minimum 1 h, runs can slip up to 30 min, no cron), `outputSchema` (object, ≤10 properties, ≤2 levels), `metadata`, `webhook` [observed, https://exa.ai/docs/reference/monitors-api-guide].
- Each run returns only **new** results versus earlier runs, plus a synthesized `output.content` [observed].
- Webhook events `monitor.run.completed` etc., signed with `Exa-Signature` HMAC-SHA256; HTTPS only, no localhost [observed]. For the hackathon, expose the webhook via a Databricks App or a tunnel.
- **Freshness:** `contents.maxAgeHours: 0` forces a live fetch; `livecrawl` options; `lite` search cannot live-fetch [observed, https://exa.ai/docs/search/quickstart.md].
- **Websets:** list building with criteria and enrichments (`number` format can extract a price), plus monitors; paid plan, separate credits [observed, https://exa.ai/docs/websets/best-practices].
- **Not native:** a price threshold. **Unknown:** whether Exa indexes eBay, Poshmark, Depop or Grailed listing pages at all [observed absence].

## Recommended architecture

1. Buyer states a want in plain words ("Arc'teryx Beta LT, men's M, under $250"). We turn it into: an Exa query, `includeDomains` for the marketplaces, an `outputSchema` of `{title, price, size, condition, url}`, and our own filter `{max_price: 250, size: M}`.
2. Monitor every 1–6 h. Webhook → verify signature → our filter (price, size, and if measurements are in the listing text, pit-to-pit range) → a Decisions `choice` "same product / similar / different" with the buyer's reference image → notify only on "same" or high-scoring "similar".
3. Store each hit in Delta; the user sees why it fired ("$228 < $250, size M, 0.91 same product").
4. **Fallback for coverage:** eBay Browse API search on the same want, run by a Databricks job on the same cadence [inferred]. That gives one guaranteed source if Exa misses marketplace pages.

## Seller-side use (same machinery)

Comps for pricing: one-shot Exa search with `maxAgeHours: 0` across marketplaces, extract prices, feed the "you keep $X" comparison [inferred].

## First thing to test (10 minutes)

Run one `/search` for a common item with `includeDomains: ["ebay.com","poshmark.com","depop.com","grailed.com"]` and see whether live listing pages come back with prices. That one test decides whether Exa is the primary or the secondary source.
