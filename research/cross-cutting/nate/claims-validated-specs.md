# Which outside-world claims in the specs are true, and which need fixing?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: cross-cutting.

Scope covered: Databricks platform claims (spec/databricks.md), eBay API and fee claims, Depop and Mercari fee claims. Scope NOT covered in this run: Poshmark, Facebook, Mercari and Depop policy clocks, Apple capture and depth APIs, rival products and prices (parity.md), vendor prices. See "What was not reached".

## Counts per verdict

| Verdict | Count |
|---|---|
| TRUE | 18 |
| FALSE (as worded) | 2 |
| OUTDATED | 1 |
| UNSUPPORTED | 3 |
| NOT REACHABLE / not checked | see section below |

## Claims to fix

| File and line | Claim as written | What the source says | Corrected sentence | Design choice depends on it? |
|---|---|---|---|---|
| databricks.md:74 and :682 | Unity Gateway went GA on 16 September | OUTDATED. Release notes of August 2026: "August 4, 2026 Unity Gateway is now generally available ... service policies and agent services, remain in Beta". The 16 September note covers only the Unity Gateway API for managing model services, model provider services and MCP services. *observed*, https://docs.databricks.com/aws/en/release-notes/product/2026/august and https://docs.databricks.com/aws/en/release-notes/product/2026/september, fetched 2026-11-14 | Unity Gateway went GA on 4 August 2026; its management API went GA on 16 September; service policies stay Beta. | Yes: model calls and guardrails go through Unity Gateway. GA still holds, but any guardrail that relies on service policies rests on a Beta feature. |
| market.md:193, price.md:157 | eBay API data kept 6 hours at most, no price modelling | FALSE as worded for "kept". The eBay API License Agreement says displayed listing information may not be more than 6 hours older than the eBay site, other eBay content 24 hours, with the age disclosed if older. That is a freshness limit on display, not a storage cap. The "no price modelling" (Restricted Activities item 5), no seller arbitrage (item 6), no AI training (item 10) and no commingling in Public Display parts are TRUE. *observed*, https://developer.ebay.com/support/api-license-agreement, fetched 2026-11-14 (agreement text undated on the page) | eBay API listing data shown to people must be no more than 6 hours older than eBay's site (24 hours for other eBay content), with its age disclosed; the licence also bars price modelling, AI training and mixing with other sources. | Yes: "eBay comps are stored apart and expire" (price.md:157). The storage-and-expiry choice stands, but the 6-hour figure is a display-age rule. Whether the licence bars storing for modelling is the restricted-activity rule, not the 6 hours. |
| databricks.md:482 | there is no PgBouncer (wording as quoted in my notes; line context not re-read before filing) | FALSE as worded if it means no pooler exists. Lakebase docs say the built-in PgBouncer does not support OAuth tokens; password roles work through it. Line 88's wording matches the source. *observed*, https://docs.databricks.com/aws/en/oltp/projects/authentication, fetched 2026-11-14 | The built-in PgBouncer does not accept OAuth tokens; connections that need it use password roles. | Possibly: connection design for Apps (OAuth, one-hour tokens). The lead should re-read line 482 against line 88. |
| features/buy.md:178 | AddToWatchList takes a user token and holds 300 at most | UNSUPPORTED as a fixed cap. The reference shows `WatchListMaximum` in a sample response with value 300 and says the field gives the maximum allowed, not a fixed number. *observed*, https://developer.ebay.com/Devzone/XML/docs/Reference/ebay/AddToWatchList.html, fetched 2026-11-14 | AddToWatchList returns `WatchListMaximum` (300 in the reference's sample); read it per user rather than fixing 300. | No, unless a watch-count limit is hard-coded. |
| databricks.md (line not located) | Lakebase runs Postgres 16, 17, 18; GA January 2026 | UNSUPPORTED. The release-note pages checked (Sep, Oct, Nov 2026, Jan 2026, Aug 2026) do not state the versions or the GA date. | None possible until a primary source is found. | Unknown. |
| databricks.md (line not located) | Model Serving 1,000 endpoints per workspace | UNSUPPORTED. The Model Serving limits page (fetched 2026-11-14) gives 300,000 QPS and 16 MB but I did not find 1,000 endpoints. | None possible until a primary source is found. | Unknown. |

## TRUE claims checked (all fetched 2026-11-14, *observed*)

- Delta time travel 7-day, Runtime 18.0, log 30 days: https://docs.databricks.com/aws/en/delta/history
- Row tracking from Runtime 14.0, `_metadata.row_id`: https://docs.databricks.com/aws/en/delta/row-tracking
- File-arrival trigger checks about every minute, best effort: https://docs.databricks.com/aws/en/jobs/file-arrival-triggers
- Model Serving 300,000 QPS and 16 MB payload: https://docs.databricks.com/aws/en/machine-learning/model-serving/model-serving-limits
- Lineage kept 395 days, UDF lineage at table level: https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage
- pgvector 0.8.0 on Lakebase: https://docs.databricks.com/aws/en/oltp/projects/extensions
- Free Edition limits (non-commercial, no Marketplace provider, no Clean Rooms, no Knowledge Assistant): https://docs.databricks.com/aws/en/getting-started/free-edition-limitations
- Genie Ontology GA (spec says 11 November; the blog says 11 November, the release notes say 9 November; discrepancy noted): https://www.databricks.com/blog/announcing-ga-genie-ontology
- Agent Bricks legacy dates 5 and 12 October: https://docs.databricks.com/aws/en/release-notes/product/2026/october
- Lakebase OAuth tokens expire after one hour: https://docs.databricks.com/aws/en/oltp/projects/authentication
- Lakebase 500 branches per project: https://docs.databricks.com/aws/en/oltp/projects/limitations
- Apps get 15 seconds after SIGTERM: https://docs.databricks.com/aws/en/dev-tools/databricks-apps/best-practices
- eBay fees (13.6% up to $7,500, 2.35% above, $0.30 and $0.40 per order, 250 free listings then $0.35, $16.88 net on $20): https://www.ebay.com/help/selling/fees-credits-invoices/selling-fees?id=4822
- Depop US: no selling fee, processing 3.3% + $0.45, boosting 12% from 23 March 2026, about $18.90 on $20: https://www.depop.com/help/seller-fees-and-charges/
- Mercari Buyer Protection 3.6%: https://www.mercari.com/us/help_center/article/169/
- eBay licence: no AI training, no price modelling, no seller arbitrage: https://developer.ebay.com/support/api-license-agreement
- GetMyeBayBuying DurationInDays 0 to 60 for Watch, Bid, Won, Lost lists (buy.md:126, :178): https://developer.ebay.com/Devzone/XML/docs/Reference/ebay/GetMyeBayBuying.html
- Genie Ontology GA in the November 2026 release notes: https://docs.databricks.com/aws/en/release-notes/product/2026/november

## What was not reached (not checked in this run, no verdict given)

- Poshmark: 3% cancel rate with 24 h restriction then 14-day suspension, $500 Authenticate, 15 lb label cap and overweight deduction from 2026-10-26, 7 days to ship, offers 24 h, 10% offer floor, automation ban (sold.md:133, :170-172; list.md:197; today.md:162; price.md:163).
- Mercari: 72 h after delivery, ship in 3 business days, 10% offer floor.
- Facebook: ship in 7 vs 3 days, claim 7 vs 45 days, Partnership route EU/EEA only, Meta ban on automated collection (sold.md:171).
- Depop: offers 14 days, tracking 10 vs 11 days, "Other" shipping closing 2026-10-28, Partner API OAuth details (messages.md:161, sold.md:171, today.md:162).
- eBay: messages 2000 characters, offers 24 h, counters 96 h (messages.md:158), Best Offer 5% (list.md:180, price.md:163), Partner Network 1.5 to 4% (market.md:199).
- Vendor prices: ScrapeCreators $1.88 per 1,000 and 1.32 s, Apify $1 to $12 per 1,000 and 66.7% success (watch.md:135-136), Exa coverage (watch.md:137).
- Databricks leftovers: Gateway policy limits (Python 30 s, HTTP 5 s), Genie polling 1 to 5 s, MLflow limits (200 traces/s, 25 MB), AppKit 60 s approval and 2-minute token refresh, `log_feedback` on UC traces, "Sonnet 5.5 and Fable 5 take text only on Free Edition" (databricks.md:578).
- Apple capture and depth APIs; rival products and prices (parity.md); published figures used as bars.
- Instrument problems: eBay selling-fees page returned only script via curl and Depop returned 403 (read through Exa fetch instead); three Databricks URLs (oltp/projects/limits, apps/app-runtime, oltp/projects/postgres-versions) returned 404; one eBay user-guide URL returned CRAWL_NOT_FOUND.

## Not found

- Lakebase GA date and supported Postgres versions in any release-note page checked.
- A "1,000 endpoints per workspace" figure on the Model Serving limits page.
- A fixed "300" cap in AddToWatchList text (only the sample response value).

## Sources fetched

- https://docs.databricks.com/aws/en/release-notes/product/2026/august, /september, /october, /november, and the January 2026 notes
- https://docs.databricks.com/aws/en/delta/history
- https://docs.databricks.com/aws/en/delta/row-tracking
- https://docs.databricks.com/aws/en/jobs/file-arrival-triggers
- https://docs.databricks.com/aws/en/machine-learning/model-serving/model-serving-limits
- https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage
- https://docs.databricks.com/aws/en/machine-learning/feature-store/online-feature-store
- https://docs.databricks.com/aws/en/oltp/projects/extensions, /authentication, /limitations
- https://docs.databricks.com/aws/en/dev-tools/databricks-apps/best-practices
- https://docs.databricks.com/aws/en/getting-started/free-edition-limitations
- https://www.databricks.com/blog/announcing-ga-genie-ontology
- https://www.ebay.com/help/selling/fees-credits-invoices/selling-fees?id=4822
- https://www.depop.com/help/seller-fees-and-charges/
- https://www.mercari.com/us/help_center/article/169/
- https://developer.ebay.com/support/api-license-agreement
- https://developer.ebay.com/Devzone/XML/docs/Reference/ebay/GetMyeBayBuying.html
- https://developer.ebay.com/Devzone/XML/docs/Reference/ebay/AddToWatchList.html
