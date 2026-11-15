# Which marketplace, rival, vendor and remaining Databricks claims in the specs hold at their primary source?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: cross-cutting.

This continues [the first pass](claims-validated-specs.md). The brief aimed for at least 120 claims; this run reached 38 checked claims (29 TRUE, 9 UNSUPPORTED), so the target was not met. The shortfall is mostly pages that could not be read by an ordinary request (see "What was not reachable"). Every verdict below is *observed* on a page fetched 2026-11-14 unless marked otherwise.

## Counts per verdict

| Verdict | Count |
|---|---|
| TRUE | 29 |
| FALSE | 0 |
| OUTDATED | 0 |
| UNSUPPORTED (not on the page cited or found) | 9 |
| NOT REACHABLE | 12 claim groups, listed below |

The first pass resolved two of its own UNSUPPORTED rows here: Model Serving 1,000 endpoints and Lakebase versions plus GA date are now TRUE.

## Claims to fix

| File and line | Claim as written | What the source says | Corrected sentence | Design choice depends on it? |
|---|---|---|---|---|
| databricks.md:361 | Gateway Python policy limit 30 s, HTTP policy 5 s | UNSUPPORTED. The service-policies page (*observed*) says policies are Beta and return ALLOW, DENY or ASK; it gives no timeouts. The limitations page was not found (two URL guesses returned 404). https://docs.databricks.com/aws/en/data-governance/unity-catalog/service-policies | Service policies are Beta; their time limits are not published on the page read. | Yes: guardrail design that budgets 30 s and 5 s per policy call. |
| databricks.md:294 and :578 | Sonnet 5.5 and Fable 5 take text only on Gateway and Free Edition | UNSUPPORTED. The Free Edition limits page says only that certain models are not available; it does not say text only. https://docs.databricks.com/aws/en/getting-started/free-edition-limitations | Free Edition lists some models as unavailable; the page does not state a text-only limit. | Yes: image input to identify, appraise and capture through Free Edition models. |
| parity.md:12 | Dupe.com matches over 47M items (*asserted*) | UNSUPPORTED on its home page: "Trusted by 20 + million shoppers", "thousands of retailers"; no 47M. *observed*, https://www.dupe.com | Dupe.com's own home page gives no item count; 47M comes from the teardown note only. | No. |
| parity.md:14 | ThriftX built on Firebase, Cloud Run, Cloud SQL, OpenAI, ScrapingBee | NOT VERIFIABLE here: thriftx.app, the domain tried, is a different company (a savings fintech). *observed* | None possible without the privacy-policy URL the note used. | No. |
| parity.md:51 | Vendoo polls for sales every 10 min | UNSUPPORTED on the pricing page: it shows sale detection and auto-delisting on all plans and no interval. *observed*, https://www.vendoo.co/pricing | Vendoo advertises sale detection on all plans; the interval is not on its pricing page. | Yes, as a comparison bar ("under 2 min p95"); the spec's own target does not change. |
| parity.md:55 | Nifty offers to likers (*asserted*) | PARTLY. Nifty's pricing says "Share, follow, relist, and send offers daily"; "to likers" is not written. *observed*, https://www.nifty.ai/pricing. Poshmark's own Offer to Likers exists per a secondary guide (unopened at primary) | Nifty sends offers daily; the likers targeting is not stated on its pricing page. | No. |
| parity.md:52 | List Perfectly delist on Pro Plus only | PARTLY. Auto Delist is marked absent on Simple $29, Business $49 and Pro $69; the Pro Plus $99+ column was not read to its end, so "only" is *inferred*. *observed*, https://listperfectly.com/pricing | Auto Delist is absent on Simple, Business and Pro. | No. |
| watch.md:135 | ScrapeCreators 24 listings in 1.32 s (vendor, *asserted*) | UNSUPPORTED: the figure is not on the pages read. The $1.88 per 1,000 price is TRUE. *observed*, https://scrapecreators.com | ScrapeCreators lists $1.88 per 1,000 requests; the 1.32 s figure is not on its home page. | Possibly: the scrape-latency budget for the watch loop. |
| watch.md:136 | Apify $1 to $12 per 1,000; Poshmark actor 66.7% success | UNSUPPORTED: the pricing page shows plans Free, $19, $199, $999 and pay-per-event examples ($2.30 and $1 per 1,000); no $12 and no 66.7% (an actor page, unopened). *observed*, https://apify.com/pricing | Apify pay-per-event examples of $1 to $2.30 per 1,000 appear on its pricing page; success rates are on per-actor pages, unopened. | Yes: cost unit chosen for the data router. |
| sold.md:171 | Depop tracking within 10 vs 11 days | PARTLY. The US page says 10 days from purchase for both shipping and adding tracking; 11 days was not seen. *observed*, https://depophelp.zendesk.com/hc/en-gb/articles/16523051318033-Shipping-on-Depop-US | Depop US cancels and refunds if the order is not shipped, or tracking not added, within 10 days. | Yes: the ship-by clock on Depop orders. |

## TRUE claims (one line each, all *observed* 2026-11-14)

Databricks:
1. Model Serving 1,000 endpoints per workspace (databricks.md:424): https://docs.databricks.com/aws/en/machine-learning/model-serving/model-serving-limits
2. Lakebase Postgres 16, 17, 18 with 17 the default; patch releases 18.7, 17.12, 16.16 on 12 Nov 2026: https://docs.databricks.com/aws/en/oltp/projects/limitations and https://docs.databricks.com/aws/en/release-notes/lakebase/
3. Lakebase GA 22 January 2026 on AWS (Azure 2 March, GCP 30 October): https://docs.databricks.com/aws/en/release-notes/lakebase/ and https://www.databricks.com/blog/databricks-lakebase-generally-available
4. Lakebase scale to zero minimum 60 s, maximum 7 days (new-project default 24 h per the 13 May 2026 note, a default not a contradiction): the limitations page above.
5. Lakebase 500 branches per project: same page.
6. Free Edition: one Lakebase project: https://docs.databricks.com/aws/en/getting-started/free-edition-limitations
7. Free Edition: up to 3 Apps, each running up to 24 h after start: same page.
8. Free Edition: 5 concurrent job tasks: same page.
9. Free Edition: no GPU serving: same page.
10. Free Edition: no Marketplace provider: same page.
11. Genie Conversation API: poll every 1 to 5 seconds (page adds a 10 min polling limit and back-off up to a minute): https://docs.databricks.com/aws/en/genie/conversation-api
12. Gateway service policies are Beta and return ALLOW, DENY or ASK: https://docs.databricks.com/aws/en/data-governance/unity-catalog/service-policies
13. MLflow tracing to Unity Catalog: 200 traces per second per workspace: https://docs.databricks.com/aws/en/mlflow3/genai/tracing/trace-unity-catalog
14. Same page: 100 MB/s per table.
15. Same page: traces over 25 MB not reachable from the UI or SDK.
16. Resource limits: model serving payload 16 MB, 200 QPS target per endpoint, trace creation 200 QPS per UC and 50 per experiment: https://docs.databricks.com/aws/en/resources/limits

Vendors and rivals:
17. Firecrawl free tier 1,000 credits, $0: https://www.firecrawl.dev/pricing
18. Firecrawl monitor "The minimum interval is 5 minutes": https://docs.firecrawl.dev/features/monitor
19. Firecrawl bills per scrape or crawl credit (watch.md:134): same two pages.
20. ScrapeCreators "$1.88 / 1k requests": https://scrapecreators.com
21. Vendoo plans $14.99, $29.99, $59.99 monthly; auto-delist on all plans: https://www.vendoo.co/pricing
22. List Perfectly plans $29, $49, $69, $99+: https://listperfectly.com/pricing

Marketplaces:
23. Mercari: 10% selling fee and 3.6% Buyer Protection on item plus buyer shipping, from 6 January 2025: https://www.mercari.com/us/help_center/article/169/
24. Mercari: sellers ship within 3 business days (sold.md:170): https://www.mercari.com/us/help_center/topics/shipping/guides/shipping-for-sellers/
25. Mercari: 72 hours after confirmed delivery to report an item; payment auto-released if no claim: https://www.mercari.com/us/help_center/article/235/
26. Poshmark: offers expire after 24 hours of no action (messages.md:162, today.md:162): https://poshmark.com/offers_help
27. Poshmark: sellers cancelling over 3% of orders in a rolling 90 days may be restricted (sold.md:133): https://blog.poshmark.com/2026/01/12/seller-updates/
28. Poshmark: Bulk Sharing "returned last month" in a post dated 12 January 2026, so back in December 2025 (parity.md:56; the May 2025 removal was not read): same URL.
29. Depop: seller offers last 14 days (messages.md:161, today.md:162) and "Other" shipping closed to new listings from 28 October 2026: https://depophelp.zendesk.com/hc/en-gb/articles/15495796917777-Send-Offer and the US shipping page above.

## What was not reachable

- Apple developer docs (Object Capture limits, LiDAR by device, Vision text and barcode): pages render by script; the stripped text was 56 bytes. Not worked around. Covers capture.md:163, :134, measure.md:143, :61, :172 and identify.md Vision claims.
- eBay Best Offer rules (list.md:180, price.md:163 5% floor), eBay messages 2,000 characters, offers 24 h, counters 96 h (messages.md:158) and Partner Network rates 1.5 to 4% (market.md:199, buy.md:181): help pages timed out or were not found; the rates page returned not found.
- Poshmark help article (7 days to ship, 15 lb label, overweight deduction from 2026-10-26, $500 Authenticate): the request returned no bytes. A secondary guide repeats 7 days and 15 lb (*asserted*, unopened at primary).
- Facebook Marketplace windows (7 vs 3 days, 7 vs 45 days): not attempted at a primary page.
- ThriftX: see the table (a different company at the domain tried).
- Not checked at all: AppKit 60 s approval and 2 min token refresh (databricks.md:479, :482), `log_feedback` on UC traces (:306), Zerobus GA 2 November (:669, :680), Gmail push 1 event per second and 7-day renewal, Gmail CASA Tier 2 cost (messages.md:164), KicksDB 24 h (market.md:195), Vision Warehouse end 2026-09-30 and Bing retirement 2025-08-11, Web Detection $3.50 per 1,000 (identify.md:38, :130), Kim 2022 LiDAR error (measure.md:25), eBay title 80 characters and 24 photos (list.md:40), Exa coverage (watch.md:137).

## Not found

- A 30 s and 5 s timeout for Gateway Python and HTTP policies.
- A text-only statement for Sonnet 5.5 on Free Edition.
- 47M items on Dupe.com; 1.32 s on ScrapeCreators; $12 per 1,000 and 66.7% on Apify; a 10-minute poll on Vendoo.
- The secondhand ThriftX site.
- Depop "11 days".

## Sources fetched

- https://docs.databricks.com/aws/en/machine-learning/model-serving/model-serving-limits
- https://docs.databricks.com/aws/en/oltp/projects/limitations
- https://docs.databricks.com/aws/en/release-notes/lakebase/
- https://www.databricks.com/blog/databricks-lakebase-generally-available
- https://docs.databricks.com/aws/en/getting-started/free-edition-limitations
- https://docs.databricks.com/aws/en/genie/conversation-api
- https://docs.databricks.com/aws/en/data-governance/unity-catalog/service-policies
- https://docs.databricks.com/aws/en/mlflow3/genai/tracing/trace-unity-catalog
- https://docs.databricks.com/aws/en/resources/limits
- https://www.firecrawl.dev/pricing and https://docs.firecrawl.dev/features/monitor
- https://scrapecreators.com, https://apify.com/pricing, https://exa.ai/pricing
- https://www.vendoo.co/pricing, https://listperfectly.com/pricing, https://www.nifty.ai/pricing, https://www.dupe.com
- https://www.mercari.com/us/help_center/article/169/, /article/235/, and the shipping-for-sellers guide
- https://poshmark.com/offers_help, https://blog.poshmark.com/2026/01/12/seller-updates/
- https://depophelp.zendesk.com/hc/en-gb/articles/15495796917777-Send-Offer and /16523051318033-Shipping-on-Depop-US
