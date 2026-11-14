# What does a complete analytics suite look like for one person selling their own used things across five marketplaces, and which Shopify metrics carry over, need redefining, or have no meaning?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: data.

Evidence marks: *observed* = I opened the source (URL and its date given), *asserted* = a vendor or third party says so and I did not verify, *inferred* = my reasoning. "unopened" = seen only in a search result. Exact values on Shopify pages came from an Exa raw fetch where noted, and from a summarising fetch otherwise (marked "summary read": wording may be paraphrased). Items that can change within months (prices, plan lists, report names) carry the date they were read, 2026-11-14.

## 0. How this note relates to existing notes

| Existing note | This note |
|---|---|
| [analytics-and-recommendations.md](analytics-and-recommendations.md) section 2 (per-marketplace own-listing stats), section 1.2 (Terapeak), section 3 (what cannot be known) | Confirms eBay traffic metrics and Terapeak (now "Product research"), extends with exact metric names, the Poshmark 2026-04-06 listing-level metrics, Depop's shop stats and API insight fields, Vinted Showcase stats, and the crosslister and bookkeeping layer. Does not re-derive the access picture (API or none) already there. |
| [insights.md](../../../spec/features/insights.md) lines 13-17 (You tab: sold count, listed value, goal bar, by-site days to sell and share of asking price, per-item views, likes, offers, messages, days listed, profit when `item.cost` known, fees and records) | Confirms the shape. Extends with Shopify and reseller-tool reports the spec does not list (section 5 table). |
| [insights.md](../../../spec/features/insights.md) lines 58-67 (days to sell, profit, sell-through defined on screen) and [market.md](../../../spec/features/market.md) lines 114-115 (days to sell, sell-through = sold in 30 days over sold plus still listed) | Confirms: Shopify's sell-through is sold / (sold + still in inventory) over 30 days, the same shape (section 1.3). Shopify's own sell-through is per product or variant, ours is per market. |

## 1. Shopify analytics (the vendor's own pages)

### 1.1 What it is, who for, access, price

- *Observed* (https://www.shopify.com/analytics, Exa raw fetch, read 2026-11-14): the marketing page for Shopify's built-in analytics and reports.
- *Observed* (https://www.shopify.com/pricing, summary read 2026-11-14): Basic, Grow, Advanced and Plus all list "200+ real-time reports, plus custom analytics". So the pricing page does not gate the report library by plan.
- *Observed* (reports overview help page, summary read): custom explorations can be saved on any plan.
- *Observed* (summary read of the report pages): most individual report pages do not state a plan. Stated exceptions: reports that need Shopify Payments, Shopify Tax, Plus (script discounts, gift card adjustments), and the Bundles and Subscriptions apps. A "not stated" on a page is not proof there is no gate.
- *Asserted*: third-party blogs claim Basic lacks some reports. This conflicts with the pricing page above, which I read.
- Access: closed UI plus the GraphQL Admin API `shopifyqlQuery` (*observed*, https://shopify.dev/docs/api/shopifyql, summary read). Price for the analytics themselves: included in the plan; plan prices not recorded here.

### 1.2 Overview dashboard, live view, explorations, ShopifyQL

- *Observed* (https://help.shopify.com/en/manual/reports-and-analytics/shopify-analytics/analytics-dashboard, Exa raw): the dashboard is a set of metric cards (total sales, sessions, orders, conversion rate, average order value and similar) with a date range and comparison period. Card list is as the page shows; not all cards re-listed here.
- *Observed* (reports library help page, summary read): report categories are Acquisition, Behavior, Customers, Finance, Fraud, Inventory, Marketing, Order, Profit, Retail sales, Sales.
- Live View: unopened (search result only). *Asserted* by the changelog title "live-view-benchmarks-and-customer-cohort-analysis-are-now-supported-in-the-new-analytics-experience" (unopened) that Live View and cohort analysis exist in the newer analytics.
- *Observed* (custom-reports filter-and-edit page, summary read): default reports can be filtered and edited, then saved as custom.
- ShopifyQL, *observed* (https://shopify.dev/docs/api/shopifyql, summary read): clauses FROM (required), SHOW, VISUALIZE, GROUP BY, SINCE, UNTIL, DURING, TIMESERIES, COMPARE TO. Data sources named: sales, orders, customers, inventory, marketing, payments.
- *Observed* (https://changelog.shopify.com/posts/turn-business-questions-into-analytics-reports-with-natural-language-queries, dated 2025-10-08, Exa raw): Sidekick turns a plain-language question into an analytics report (a ShopifyQL query behind it). What Sidekick can answer beyond that: the help page is unopened.
- Alerts and anomaly notices: *observed* from the Insights help text (summary read) that Insights are generated only for stores with at least 10 orders a week over 6 months, up to 5 a day, each expiring after 24 hours. These are suggestions on the dashboard; I did not find a push alert or an anomaly-detection feature on a page I opened. Not found otherwise.
- Targets: *observed* (benchmarks URLs both serve the Targets page, Exa raw): fixed amounts, one filter, shown as a gauge on the dashboard.
- Benchmarks (median, p25, p75 against similar stores): *asserted* (search summary, deprecation page unopened) that they were retired about 2026-05-19 and replaced by targets. The two benchmark URLs now serve Targets, which is consistent with that.

### 1.3 Metrics by name, with the vendor's definition

Inventory (*observed*, .../shopify-reports/report-types/default-reports/inventory-reports, Exa head plus summary read of the tail):
- Sell-through rate: sold / (sold + still in inventory at period end), last 30 days, about a 2-day lag.
- Days of inventory remaining: ending quantity / average daily units sold over the last 28 days. Shows N/A with no sales, 0 if negative.
- ABC analysis: A = products making the top 80% of revenue, B = the next 15%, C = the last 5%, over the last 28 days, not adjustable, cost ignored.
- Percent sold: quantity sold / starting quantity. Quantity sold per day. Month-end snapshot and inventory value.
- On hand versus Available: reports switched to "On hand" on 2026-10-01 (summary read).

Sales (*observed*, sales-report page, summary read): gross sales, discounts, sales reversals (returns), net sales, net quantity, shipping, total sales, average order value, units per transaction, gross profit, gross margin.

Customers (*observed*, customers-reports, summary read): new versus returning; returning customer rate = returning customers / customers; retention rate; cohort analysis; RFM (scores 1 to 5, 11 groups); predicted spend tier.

Behaviour and funnel (*observed*, behaviour-reports, Exa raw): sessions (a visit ends after 30 minutes of inactivity, cookie based), visitors (device cookie), conversion rate = completed-checkout sessions / sessions, funnel steps (all sessions, cart additions, reached checkout, completed checkout), open versus closed funnel, search and recommendation conversion, bounce rate, landing pages, device.

Acquisition and marketing (*observed*, acquisition-reports and marketing-reports, summary read): sessions and orders by source or campaign; attribution models Last non-direct click (default), Last click, First click, Any click, Linear.

Profit (*observed*, profit-reports, summary read): gross profit and margin from item cost entered on the product. Finance (*observed*, finances-report, summary read): sales, payments, liabilities, taxes, gift cards. Order reports (*observed*, order-reports, summary read): time to fulfill, ship, deliver. Retail sales and Fraud reports: unopened.

## 2. Used-goods marketplaces: what the seller sees

Per-marketplace access was already established in [analytics-and-recommendations.md](analytics-and-recommendations.md) section 2. Only additions are listed.

### eBay: Seller Hub Performance and Product research (Terapeak)
- *Observed* (https://developer.ebay.com/api-docs/sell/static/performance/traffic-report.html, Exa raw): `getTrafficReport` returns by DAY or LISTING: LISTING_IMPRESSION_SEARCH_RESULTS_PAGE, LISTING_IMPRESSION_STORE, LISTING_IMPRESSION_TOTAL, LISTING_VIEWS_SOURCE_DIRECT / OFF_EBAY / OTHER_EBAY / SEARCH_RESULTS_PAGE / STORE, LISTING_VIEWS_TOTAL, CLICK_THROUGH_RATE, SALES_CONVERSION_RATE (completed transactions / View Item page views). Its CLICK_THROUGH_RATE text is worded as the inverse of clicks over impressions; Seller Hub help text (*asserted*, search summary) uses clicks / impressions.
- *Observed* (https://www.ebay.com/help/selling/selling-tools/terapeak-research?id=4853, Exa raw, served in Chinese, read 2026-11-14): Product research gives 3 years of eBay sales: sales trends, average sold price, price range, average shipping and number of free-shipping listings, sell-through rate (only for searches over the last 90 days or less), number of sellers who sold it, format sold in. It includes accepted Best Offer prices. Sourcing insights are free with a Basic Store or higher. Available to every seller with Seller Hub access.
- Existing note says Terapeak is now "Product research"; confirmed. Sell-through formula: not published by eBay on the page I read. A forum guess (sold / (sold + unsold + listed)) is *asserted* and unofficial.

### Etsy Stats
- *Observed* (https://help.etsy.com/hc/en-us/articles/115015628207-Shop-Stats-Glossary, Exa raw): Visits, Orders, Average Order Value (revenue / orders), Revenue (sales minus shipping and tax), Conversion rate (visits that resulted in an order), Listing views, Listing views per visit, Session, year over year comparison, traffic sources (Etsy search, Etsy app and other pages, Etsy marketing and SEO, Etsy Ads, Offsite Ads, Social Media, Direct and other), search terms, time frames Today to All time (data back to January 2013).
- This is the closest used-goods match to Shopify's dashboard. It needs own-shop visits, which our app has no equivalent of except marketplace views.

### Poshmark
- *Observed* (https://blog.poshmark.com/2026/04/06/sellerupdatesapril6/, dated 2026-04-06, Exa raw): listing details page shows impressions, clicks, likes, seller offers, buyer offers, days listed (rolling out). Posh Stats (Seller Tools > Posh Stats, visible to the seller only) shows average ship time (last 90 days, weekends and postal holidays excluded), cancellation rate, approved return cases, total sales, shipped orders. Inactive Listings flags listings with no bundle, comment, offer or edit in 60 days.
- Inventory report with like history, Shoppers tool: *asserted* (search summary; Poshmark blog 2019 and support pages unopened). API: none, as in the existing note.

### Depop
- *Observed* (https://www.depop.com/blog/depop-product-release-june-2025/, dated 2025-06-25, Exa raw): Shop stats dashboard shows sales, potential earnings, total listings. Boost Shop and Boosted Listings "unlock visibility stats like clicks and views".
- *Asserted* (search summary of https://partnerapi.depop.com/api-docs/reference/, unopened by me): product insights fields likes_count, bag_count, boosted_clicks, boosted_impressions; shop insights counts (on-sale, total, rating, offers, orders awaiting shipping), up to 60 minutes delayed. Partner access.

### Mercari and Vinted
- Mercari: *asserted* only (a third-party blog says views, likes, listing performance). Official page not found.
- Vinted: *observed* (https://www.vinted.co.uk/help/452, Exa raw): Showcase is a paid 7-day boost; "while Showcase is active" the seller can see how many people viewed and interacted with listings. Any free per-listing stats page: not found.

### Facebook Marketplace
- Not searched again; see the existing note section 2 (not repeated).

## 3. Crosslisters and resale bookkeeping

All of this section is *asserted* from search results (third-party reviews, several from competitors); I did not open the vendors' pricing or analytics pages (Vendoo /analytics returned not found). Prices read 2026-11-14 from search summaries and can change.

- Vendoo: analytics for profit, revenue, average sale price, top categories and brands; downloadable sales report with revenue, profit, costs, fees; breakdown by marketplace, category, brand. Starter $14.99, Growth $29.99, Pro $59.99 per month (US), analytics on all plans. A rival says it lacks P&L, order and expense reports.
- List Perfectly: Simple $29, Business $49, Pro $69, Pro Plus from $99 per month; sales analytics from Business; sales detection and auto-delist at higher tiers.
- Nifty: profits, expenses, slow movers, marketplace performance; $39.99 automation, $39.99 crosslisting, $69.99 bundle per month.
- Flyp: one plan, $9 a month after a 100-day trial; revenue, profit, cost of goods entry, export. Reviews conflict on profit depth.
- OneShop: $45 a month plus a transaction fee; sales dashboard with trend graphs and goal tracking.
- Bookkeeping: Flippd (profit after fees, shipping, cost of goods, mileage; free to $9.99), My Reseller Genie (bank feeds, mileage, multi-venue sales reports, $11.99), Seller Ledger (cost of goods by SKU), Resylr (profit by marketplace, item, category and source), Flipwise (P&L, Schedule C ledger), QuickBooks Self-Employed (mileage, Schedule C summary).

## 4. Amazon Seller Central business reports
- *Asserted* (third-party guides and Seller Central forum posts; Amazon's own help page not found): Detail Page Sales and Traffic by Child Item (and by parent). Sessions (unique visits in 24 hours), Page Views, Unit Session Percentage (units ordered / sessions), Featured Offer Percentage (formerly Buy Box: share of page views where your offer was featured). Forum posts report Featured Offer figures showing wrongly after a July 2026 change.

## 5. Classification for one person, single units, five marketplaces

All *inferred* from sections 1 to 4 and the brief's constraints (items are one-of-a-kind, no own storefront sessions, views, likes, offers and messages come from the marketplaces).

Carries over unchanged: gross sales, discounts, net sales, shipping, total sales, sales reversals (returns, cancels), average order value (becomes average sale price per item, same arithmetic), units sold, gross profit and margin (needs item cost), fees and taxes records, time to ship (Posh Stats, Shopify order reports), targets (insights.md already has a goal bar), date-range comparisons (YoY, prior period), recent-activity feed (Live View idea), saved custom views.

Needs redefining: sell-through (per item it is 0 or 1; works per category, brand, price band or marketplace as sold / (sold + still listed), as market.md line 115 already does); days of inventory remaining (per item it becomes days listed so far, and for the whole stock a sell-down estimate from median days to sell by category); ABC analysis (rank by listed value or by revenue contribution of category and brand, since no SKU repeats); percent sold (of listed items in a period); inventory value (at cost, at asking, at expected sale); conversion funnel (impressions, views, likes, offers, messages, sale, built from marketplace-reported numbers; eBay gives impressions to sale, Poshmark gives impressions, clicks, likes, offers); returning customer rate and cohorts (buyers belong to marketplaces; cohort by listing month instead); attribution (by marketplace and by source where reported, eBay and Etsy list sources, no campaigns); RFM (no buyer identity across sites); benchmarks (against market comps for the same product rather than other stores); anomaly or Insights (per-item stale-listing or price-drop prompts, as Poshmark Inactive Listings does for 60 days).

No meaning (no own storefront, no checkout, no catalogue of repeat SKUs): own-site sessions, visitors, bounce rate, landing pages, device, site search and recommendation conversion, cart additions and checkout steps, discount codes, Shopify Payments and Tax reports, bundles and subscriptions, marketing channel CAC and ROAS (except marketplace promotion spend: Depop Boost, eBay Promoted Listings, Etsy Ads, which have costs and stats).

## 6. Table

| Feature | Who has it (link) | In a used-goods app that also covers new retail | Data needed | In our spec |
|---|---|---|---|---|
| Net sales, fees, payout, records | [Shopify sales report](https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/report-types/default-reports/sales-report), Vendoo, Flippd | Sold, fees, kept, by marketplace; new-retail items the same | order, fees, payout per site | In: [insights.md](../../../spec/features/insights.md) lines 13-17, 26-29 |
| Profit and margin per item | [Shopify profit](https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/report-types/default-reports/profit-reports), Nifty, Flippd | Profit when cost known; cost source: receipt, purchase through the app | `item.cost`, fees, shipping | In: insights.md line 60, item-card.md line 29 |
| Sell-through rate | [Shopify inventory](https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/report-types/default-reports/inventory-reports), [eBay Product research](https://www.ebay.com/help/selling/selling-tools/terapeak-research?id=4853) | per category, brand, marketplace, own sales and market | sold and active counts | In: market.md line 115, insights.md line 67 |
| Days to sell | Shopify (as days of inventory remaining, different meaning), Poshmark days listed | days from listed to sold, per site | listed_at, sold_at | In: insights.md line 58, market.md line 114 |
| Days of inventory remaining (sell-down estimate) | Shopify inventory | estimated days to clear current stock by category | stock count, median days to sell | New |
| ABC analysis | Shopify inventory | rank by revenue share across categories or brands | sold revenue by group | New |
| Inventory value (cost, asking, expected) | Shopify inventory month-end value, Flippd | three values for the unsold stock | cost, ask, comps | Partly: insights.md "listed value" |
| Conversion funnel from marketplace numbers | [eBay traffic report](https://developer.ebay.com/api-docs/sell/static/performance/traffic-report.html), [Poshmark listing metrics](https://blog.poshmark.com/2026/04/06/sellerupdatesapril6/), [Etsy Stats](https://help.etsy.com/hc/en-us/articles/115015628207-Shop-Stats-Glossary), Amazon Unit Session Percentage | impressions, views, likes, offers, messages, sale, per site | per-site stats (API or read in session) | Partly: insights.md line 15 shows the counts, no rate |
| Traffic source split | eBay LISTING_VIEWS_SOURCE_*, Etsy traffic sources | where views came from per site | site-reported | New |
| Stale-listing prompt | [Poshmark Inactive Listings](https://blog.poshmark.com/2026/04/06/sellerupdatesapril6/) (60 days) | per site, with the price-drop plan | listed_at, last activity | Partly: list.md price path drops |
| Seller service stats (ship time, cancels, returns) | Poshmark Posh Stats, Shopify order reports | ship time and cancel rate per site | order events | New |
| Targets and goal | [Shopify Targets](https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/custom-reports/benchmarks) | goal bar | goal, sold or kept | In: insights.md lines 13, 27, 72 |
| Compare to other stores (benchmarks) | Shopify (retired, asserted) | compare to market comps for the same product | sold comps | Partly: market.md |
| Market research, sold prices, 3 years | eBay Product research | sold range, trend by product across sites | sold comps | In: market.md |
| Plain-language questions on own data | [Shopify Sidekick and ShopifyQL](https://shopify.dev/docs/api/shopifyql) | Ask box over own items and market | own data tables | In: insights.md (Ask box) |
| Saved custom reports and query editor | Shopify custom reports, ShopifyQL | saved views of the Ask box | tables | New |
| Cohorts and retention | Shopify customers reports | cohort of items by listing month: share sold by day 30, 60, 90 | listed_at, sold_at | New |
| Customer new vs returning, RFM | Shopify customers reports | buyers rarely identifiable across marketplaces | buyer id, mostly absent | New (limited by data) |
| Mileage and expense records | Flippd, My Reseller Genie, QuickBooks Self-Employed | expenses and mileage with the fee records | manual entry | Partly: insights.md "fees and records" |
| Anomaly or Insights suggestions | Shopify Insights (10 orders a week threshold) | suggestions when a site's views drop or an item stalls | per-item series | New |
| Promotion spend vs result | Depop Boost stats, Etsy Ads, eBay Promoted Listings | spend per site vs views and sales | promotion data per site | New |

## Not found
- A push alert or anomaly detector in Shopify analytics (only Insights suggestions found).
- Which plan each Shopify report needs beyond the pricing-page line.
- eBay's published sell-through formula.
- Official Mercari seller analytics page; any free Vinted per-listing stats page.
- Amazon's own help definition of business report metrics.
- Any vendor page for Flyp, OneShop, Nifty or Vendoo analytics that opened.

## Searched / could not reach
- help.shopify.com returned 403 to curl; read via Exa and a summarising fetch instead.
- Unopened: Shopify Live View, Sidekick help, ShopifyQL syntax page, Retail sales and Fraud reports, benchmarks deprecation page; Depop partner API reference; Poshmark support articles; crosslister and bookkeeper vendor pages.
- Facebook Marketplace not re-searched.

## Sources fetched
- https://www.shopify.com/analytics ; https://www.shopify.com/pricing
- help.shopify.com reports pages: default-reports, analytics-dashboard, inventory-reports, sales-report, customers-reports, acquisition-reports, finances-report, behaviour-reports, profit-reports, marketing-reports, order-reports, analytics-fields, reports-overview, shopify-reports, overview-dashboard, custom-reports/filter-and-edit, benchmarks pages (serve Targets)
- https://changelog.shopify.com/posts/turn-business-questions-into-analytics-reports-with-natural-language-queries (2025-10-08)
- https://shopify.dev/docs/api/shopifyql
- https://www.ebay.com/help/selling/selling-tools/terapeak-research?id=4853
- https://developer.ebay.com/api-docs/sell/static/performance/traffic-report.html
- https://help.etsy.com/hc/en-us/articles/115015628207-Shop-Stats-Glossary
- https://blog.poshmark.com/2026/04/06/sellerupdatesapril6/ (2026-04-06)
- https://www.depop.com/blog/depop-product-release-june-2025/ (2025-06-25)
- https://www.vinted.co.uk/help/452
- Search-only (asserted): Vendoo, List Perfectly, Nifty, Flyp, OneShop and bookkeeping reviews; Amazon forums and third-party guides.
