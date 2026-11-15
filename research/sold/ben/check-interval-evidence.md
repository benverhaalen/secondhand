# How often should the sell side check for a sale?
Researched 2026-11-15 by Ben (Codex, GPT-6). Feature: sold.

*Agent proposal.* Decision fed: the intervals in [cadence.md](../../../product/cadence.md), computed by [cadence.mjs](../../../scripts/bench/cadence.mjs). This is sell-side research. Buyer want cadence and revenue-market sizing were not researched.

## Question, draft and what changed

*Inferred, 2026-11-15:* the decision is how to trade recurring check spend against the seller's exposure while a sold item remains available elsewhere. The representation is a cost curve, with separate cash, access-loss reserve and delay harm. A cheap poll and a working poll are different requirements.

*Assumption, initial draft before outside searches, 2026-11-15:* 15 minutes probably makes a reasonable ordinary interval; hot items need 1 to 2 minutes; public checks are nearly free; cancellation primarily costs the buyer relationship. This was a starting hypothesis, not a finding.

*Observed/inferred, 2026-11-15:* the source checks below changed that draft. Poshmark now publishes a cancellation threshold; Mercari can charge a fee. Public reads still face broad automation terms. Vendor time-to-sale reports disagree sharply and do not establish the conditional hazard after a first sale. The model's low-volume cash assumptions favor much slower Depop checks. A single 15-minute answer is not supported. Flyp's current first-party help says about hourly, superseding the repo's 15-minute comparator. Sources: S1 to S12 below; [generated curves](../../../product/cadence.md#recomputed-tables).

## Evidence ledger

All URLs below were opened/read on **2026-11-15**. A policy's contents are *observed*, not a legal opinion. Vendor performance reports are *asserted*, even when the vendor produced the report. A number from a filing is *observed* as a disclosure, not evidence it still describes today's users.

### S1. What an eBay cancellation does

Job: evidence for the loss model. *Observed, read 2026-11-15:* an out-of-stock cancellation is a transaction defect. The minimum standard allows 2% defects; Below Standard requires defects involving more than four buyers. Top Rated uses 0.5% and at most three different buyers. Below Standard can reduce visibility, selling limits and access to promotion, and hold funds. Eligible Top Rated Plus listings get a 10% final-value-fee discount. These are nonlinear account effects, not a fixed fine per cancellation. [eBay seller standards](https://www.ebay.com/help/selling/selling-seller-performance/seller-performance-standards?id=4347), sections Transaction defect rate, Top Rated and Below Standard, lines 82 to 87, 163 to 180 and 225 onward in the fetched text.

*Observed, read 2026-11-15:* a paid order cancelled by the seller receives a full refund; buyers can still leave feedback. The reason must be accurate. Fee credits may be available. [eBay order cancellation policy](https://www.ebay.com/help/policies/member-behavior-policies/order-cancellation-policy?id=5298), Refunds and Other terms.

*Assumption, dated 2026-11-15:* assign $10 of expected standing loss to an eBay cancellation, range $0 to $200. This is a shadow price, not a platform fee. Near a seller-level threshold, replace the average with the seller's actual future margin at risk. An isolated cancellation is not assumed to cause suspension. Anchor: the policy above.

### S2. Poshmark cancellation rules changed

Job: evidence for standing risk. *Observed, read 2026-11-15:* the **Seller Policy effective July 23, 2026** says an unshipped/cancelled share of **3% or more over 90 days** harms standing; repeated failures can cause restrictions and continuing violations suspension. Buyer-requested cancellations are excluded. [Poshmark Legal Center](https://poshmark.com/terms), current Seller Policy, fetched text lines 6405 and 6456 to 6460. The page includes historical versions; do not quote a previous version by accident. A compressed live `curl` read independently confirmed the current version header and threshold.

*Observed, read 2026-11-15:* Poshmark's [March 23 update](https://blog.poshmark.com/2026/03/23/58683/amp/) shortened restriction duration effective March 26, without giving a duration there. Its [seller cancellation help](https://support.poshmark.com/s/article/688293607?language=en_US) search result says sellers can cancel before shipping; opening that help page timed out, so that procedural claim remains *asserted*. No fixed cancellation fine was established by the pages read.

*Assumption, dated 2026-11-15:* no separate cash fine in the base case; $5 expected standing loss per cancellation, range $0 to $100. Anchor: current policy above. The absence of a fine in this search is not proof no exceptional fee exists.

### S3. Depop refunds and cross-listing

Job: evidence for responsibility and fee reversal. *Observed, read 2026-11-15:* the **October 6, 2026** terms allow third-party cross-listing subject to compliance, prompt removal after another site's sale, and seller responsibility for duplicate sales/refunds. They also prohibit scraping and bots. The page begins with future January 2027 terms; this note uses the October section, fetched lines 691 to 692 and 770 to 773. [Depop Terms of Service](https://depophelp.zendesk.com/hc/en-gb/articles/360001773148-Terms-of-Service).

*Observed, read 2026-11-15:* selling, processing and boosting fees reverse on a refunded sale; with Depop Payments this happens automatically. [Depop seller fees](https://depophelp.zendesk.com/hc/en-gb/articles/360001791127-Seller-fees-and-charges), Are the fees refundable? No numeric cancellation-rate penalty was established by the pages read.

*Assumption, dated 2026-11-15:* $0 retained transaction fee for that route; $2 expected standing loss, range $0 to $50. This is not a claim that frequent cancellations are harmless. Anchors: the two policies above.

### S4. Mercari can charge, and cancellations are visible

Job: cash-loss anchor. *Observed, read 2026-11-15:* Mercari reserves the right to charge **5% of item price, at most $25**, when a seller cancels. Frequent cancellations can affect selling privileges, and cancellations appear on the responsible party's profile. [Mercari cancellation policy](https://www.mercari.com/us/help_center/article/251/), For Sellers and Order Cancelation Reviews. Its [fees page](https://www.mercari.com/us/help_center/article/169/) says frequent cancellers receive warnings before a fee and repeated cancellations may lead to listing removal/account limits. This supports uncertainty about collection, not automatic charging every time.

*Assumption, dated 2026-11-15:* collect the fee in half the duplicate-sale cancellations, range 0% to 100%; add $5 expected standing loss, range $0 to $100. At a $33 item price the expected fee is $0.825. Anchor: the policy above. A refund can also leave a buyer waiting for money; no wait-cost dollar value is claimed here.

### S5. Refund principal, seller time and trust

Job: avoid treating reversed revenue as a second inventory loss. *Observed, read 2026-11-15:* Poshmark's [S-1](https://www.sec.gov/Archives/edgar/data/1825480/000119312520320132/d66583ds1.htm) reports a **$33 2019 average order value**, excluding shipping/tax, before returns and cancellations (definition and Benefits to Buyers; fetched lines 297 and 378). This is an old transaction-size anchor, not a current price estimate.

*Inferred, dated 2026-11-15:* when the first buyer's sale is retained, refunding the duplicate payment reverses money the seller cannot earn twice. Adding the full $33 to economic loss would count nonexistent second inventory revenue. Report expected **item-price refunds** separately; shipping/tax must also be reversed as applicable and are not quantified here. Anchors: S1, S3, S4 and the S-1 definition.

*Assumption, dated 2026-11-15:* ten minutes of resolution at $20/hour costs $3.3333; ranges 5 to 30 minutes and $0 to $40/hour. Goodwill/distress adds $10, range $0 to $50, for a total before standing effects of $13.3333. No measured churn, retention or willingness-to-pay is implied. With S1 to S4, cancellation losses are eBay $23.3333, Poshmark $18.3333, Depop $15.3333, Mercari $19.1583; Facebook's hypothetical paid-order case uses $13.3333, with no assumed standing fine. Facebook local pickups do not imply duplicate online payments.

### S6. eBay pushes sales; quotas still limit backstops

Job: implementation mechanism and capacity constraint. *Observed, read 2026-11-15:* `ORDER_CONFIRMATION` is a signed HTTPS notification after checkout and payment clearance, with required seller OAuth scopes; the current topic page lists three retries. [eBay Notification Topics](https://www.developer.ebay.com/develop/api/sell/notification_events), ORDER_CONFIRMATION, fetched lines 4027 to 4053. No end-to-end latency guarantee was established here. This replaces the older note's claim that retry behavior was unstated.

*Observed, read 2026-11-15:* defaults include **100,000 Fulfillment Order-resource calls/day**, **5,000 Trading calls/day** and **10,000 Notification API calls/day**. [eBay call limits](https://developer.ebay.com/develop/api/sell/api_call_limits), REST table. These are quotas, not dollars per call or a measured account-ban curve. Notification administration calls differ from incoming webhook deliveries.

*Inferred, dated 2026-11-15:* no routine detection interval is needed for successfully delivered pushes. A reconciliation/backstop interval covers misses. At one Order call/account/check, 15 minutes means 96 calls/account/day and a 100,000-call shared allocation supports at most 1,041 such accounts; hourly means 24 and 4,166 accounts, before pagination, confirmation reads and other workloads. Real application quotas and method constraints must be checked before rollout. A per-account quota must never be inferred from this table.

*Assumption, dated 2026-11-15:* 1% of sales need the backstop, range 0% to 10%, and per-poll compute costs $0.00001. This is not measured delivery reliability. [Repo packet 67](../../../.agents/team/packets/team/67-nates-rulings-and-where-they-meet-bens-plans.md), read 2026-11-15, says API approval is pending. Thus push availability is a design condition, not a demonstrated production connection.

### S7. Time-to-sale evidence does not identify the hazard we need

Job: bound T and challenge the 7 to 30 day examples in ROI. *Asserted, read 2026-11-15:* [FLUF's eBay report](https://fluf.io/resale-data/ebay/) says 24,767 tracked sales, updated November 8, mean **91.1 days**. Its Apparel & Accessories row says 28.1 days, **68% within seven days**, 79% within 28, n=1,476; knit jumpers 9 days and 57% within seven, n=581. These are the vendor's figures, not audited cohort estimates.

*Asserted, read 2026-11-15:* [FLUF's Depop report](https://fluf.io/resale-data/depop/) says 13,357 sales, updated November 8, mean **126.2 days**. Jackets: 67.3 days, 49% within seven and 90% within 28, n=539; pocket T-shirts: 31.2 days, 50% within seven, 60% within 28, n=370. Men's activewear T-shirts show 207.6 days and 0% within seven, n=561. A single fixed “hot for seven days” rule would cover very different situations. Raw listing-level records, denominator details and censoring treatment were not obtained.

*Asserted, read 2026-11-15:* [SoldStack's October report](https://soldstack.dev/resale-report/2026-10) reports 13,143 cleaned Poshmark sales of 319 selected products, collected October 8 to 10. Across 308 products with at least 15 sales, its middle product's median listing-to-sale time was about **five days**. It is selected sold-product data. [Closo](https://closo.co/tools/closo/resale-index/resell) instead reports typical times around **25 days for jeans/sweaters and 30 for shoes**, from US Poshmark sold listings over a year. Medians across products, category medians and means across sales are not interchangeable. Neither becomes our T by a unit conversion.

*Observed, read 2026-11-15:* eBay [Product research](https://www.ebay.com/sellercenter/resources/seller-updates/2024-october/tools) exposes a sell-through metric for similar items in a chosen period, not a universal days-to-sell constant. The [Poshmark S-1](https://www.sec.gov/Archives/edgar/data/1825480/000119312520320132/d66583ds1.htm) passages searched for sell-through, days and listing speed did not yield an overall cohort timing curve. That limited finding is not proof no disclosure exists elsewhere.

*Asserted, read 2026-11-15:* an [older Mercari investment write-up](https://3926179.fs1.hubspotusercontent-na2.net/hubfs/3926179/Campaigns/Editors%20picks%202019/Editors%20Picks%202018%20-%20Jan-2019.pdf) attributes “50% within 24 hours” to other reports, in a discussion of Japan. It is a secondary, old, geography-mismatched claim. It is **not used** as Mercari US's current median or to set hot duration. Searches of Mercari's own site and disclosures did not locate a current US cohort curve. Facebook item time-to-sale evidence was also not established. Anecdotes appeared in searches but were not used to fit a number.

*Assumption, dated 2026-11-15:* hazard-equivalent T in days is eBay 90 (range 7 to 180), Poshmark 30 (5 to 180), Depop 126 (7 to 240), Mercari 30 (1 to 180), Facebook 14 (1 to 90). First sales average two/site/month for a hypothetical user linked to all five; range 0.2 to 20. These condition on a first sale and **are not estimated from sold-only averages**. The vendor data provides plausibility anchors for stress tests; the chosen means remain assumptions. In particular, correlated demand after a sale can make these far too slow.

### S8. Automated access and observed enforcement

Job: establish permission/exposure constraints, not invent a safe request rate.

| Site | Claim and evidence, read 2026-11-15 | Consequence for this model |
|---|---|---|
| eBay | *Observed*: the [User Agreement](https://www.ebay.com/help/policies/member-behaviour-policies/user-agreement?id=4259), effective June 28, 2026, requires permission for automated access. | *Inferred*: approved API quotas are the capacity model; a page harness is a different access-risk scenario. |
| Poshmark | *Observed*: [terms](https://poshmark.com/terms), Use of the Service, bar automated data collection; [community guidelines](https://poshmark.com/community_guidelines) prohibit unauthorized automation. A direct live `curl` of [robots.txt](https://poshmark.com/robots.txt) returned `User-agent: *` and `Disallow: /search` at line 25. Web-tool open of robots.txt failed. | *Inferred*: a public listing check is not search, but no login does not grant permission or prove zero account/infrastructure risk. The older cheap-sale-detection note's categorical zero-risk claim is unsupported. |
| Depop | *Observed*: the [October terms](https://depophelp.zendesk.com/hc/en-gb/articles/360001773148-Terms-of-Service), section 7, bar bots/scraping alongside conditional cross-listing permission. | *Inferred*: cross-listing permission is not unlimited permission to sweep; no public safe sweep threshold was established. |
| Mercari | *Observed*: [Prohibited Conduct](https://www.mercari.com/us/help_center/topics/account/policies/prohibited-conduct/) bars robots, scrapers and other unauthorized automated interfaces. | *Observed in repo*: [packet 67](../../../.agents/team/packets/team/67-nates-rulings-and-where-they-meet-bens-plans.md), read 2026-11-15, records Nate's no-timed-Mercari-sweeps ruling. Its grid is conditional economics, not authorization to turn on a timer. |
| Facebook | *Observed*: [current terms URL](https://www.facebook.com/legal/terms) and [collection terms](https://www.facebook.com/legal/automated_data_collection_terms) redirected to login/temporary-block shells. *Asserted*: Meta's own [scraping explanation](https://about.fb.com/news/2021/04/how-we-combat-scraping/) says unauthorized automated collection violates its terms. | *Inferred*: mailbox checks do not poll Facebook. The current full terms were not verified through the blocked route. The generic temporary-block text is not a measured Marketplace seller-flagging rate. |

*Observed search limit, 2026-11-15:* Poshmark November 2025 automation suspensions are mentioned in existing repo notes. Searches of official support/community material did not establish a dated first-party incident count or check-frequency threshold. No measured per-poll ban probability was found for these routes. Neither this search nor anecdotes identify a ban curve.

*Assumption, dated 2026-11-15:* `h(I) = b × (15/I)^1.5`, `q(I) = 1 − exp(−h(I))`, reserve `= $100 × q(I)`. At 15 minutes, b=0.001 for Depop signed-in, 0.0001 for Poshmark/Mercari public. Ranges: b=0 to 0.01 signed-in, 0 to 0.001 public; exponent 1 to 2; loss $20 to $1,000. This is sensitivity analysis for restriction/access loss, **never measured ban risk**. Zero is included in the ranges. A lower frequency is not a statement of compliance. For an adaptive month, sum time-weighted hazards before applying the exponential. Do not sum each state's monthly incident probability.

### S9. What checks cost

Job: cash anchor. *Observed advertised prices, read 2026-11-15:* [Browser Use pricing](https://browser-use.com/pricing) lists **$0.06/browser-hour**, plus **$0.20/GB direct or own-proxy traffic** or **$5/GB home-IP traffic**. No browser-agent model calls are included in this model. A supplier price is not a measured workload bill.

*Assumption, dated 2026-11-15:* a Depop sweep uses one billed browser-minute (0.25 to 4), transfers 1 MB (0.1 to 5), and consumes $0.00001 of allocated job/log compute (0.000001 to 0.001). Decimal GB=1,000 MB. Thus one sweep is $0.001 + $0.0002 + $0.00001 = **$0.00121**. Four watcher sections must share that minute; if they do not, costs rise. No observed minimum billing increment was established on this pricing page.

*Assumption, dated 2026-11-15:* public page requests cost $0.000001 each, range $0 to $0.0001, plus the same per-account job allocation. Ten pages/check gives **$0.00002/check**, not $0. An account-level Depop check does not multiply by inventory; public per-listing checks do. A closet batch could reduce request count but its full coverage is unproved. Mercari's cheap public route assumes no browser fallback. A bot wall is `unknown`; the all-browser row is a separate sensitivity, not an approved retry path. Anchors: supplier pricing above and [sold operating guide](../../../app/src/edge/sold/OPERATING.md), read 2026-11-15.

*Inferred, dated 2026-11-15:* the [ROI input](../../../scripts/bench/roi.mjs) depop_live_day=$0.10 is rounded; at 15 minutes this model gives $0.11616/day and $3.4848/month. The difference is traffic/allocated compute and exact arithmetic, not measured regression. ROI's buyer/revenue assumptions were not extended.

### S10. Competitor intervals, checked rather than copied

Job: comparison, not calibration of our risk. All *asserted performance claims*, opened 2026-11-15; no competitor was timed.

| First-party source | What it currently says |
|---|---|
| [Vendoo help](https://help.vendoo.co/en/articles/8047348-sale-detection-auto-delist) | Scans every ten minutes, computer on, connected, browser tab open. |
| [Flyp / Reseller Tools help](https://resellertools.zendesk.com/hc/en-us/articles/41078916741517-Auto-Delist-Auto-mark-as-Sold-and-Delist) | About hourly while open; opening Orders, returning after at least five minutes, or refreshing can also sync. This contradicts the older 15-minute comparison in sold.md line 163. |
| [Nifty help](https://docs.nifty.ai/auto-delisting/auto-delisting) | Detects within 15 minutes; the window cannot be shortened. |
| [Treecat help](https://wiki.treecat.io/how-fast-does-auto-delist-work) | Checks every 30 minutes and then queues delisting; some routes need an awake computer. |

*Inferred, dated 2026-11-15:* compare mean polling delay with mean polling delay: for a ten-minute poll it is five minutes under uniform arrival, plus confirmation/delist. The old ROI illustration using 12 minutes for a ten-minute competitor but four minutes for ours mixes worst-case budgets with modeled probabilities. This work always uses `I/2 + d`. Sources: competitor pages above, [doubleSaleRate](../../../scripts/bench/roi.mjs) and [feature-breakdown §7](../../../product/feature-breakdown.md#7-no-double-sales-what-the-number-means), read 2026-11-15.

### S11. What the code can express today

Job: implementation constraint. *Observed, repository read 2026-11-15 at base `99695e618c0370291e63b9b2a2f04c3ed475f5cb`:*

| Source | Finding |
|---|---|
| [schedule.ts](../../../app/src/edge/events/schedule.ts), [tests](../../../app/src/edge/events/schedule.test.ts), [ports.ts](../../../app/src/edge/events/ports.ts) | `watch_cadence_s@site/segment` already changes the next due time. Tests use 90/900/3600 seconds. A newly changed param does not bring an already-scheduled due time forward immediately. |
| [watcher.ts](../../../app/src/edge/events/watcher.ts), `stateOf` | Hot means an open offer, awaiting reply or the hour after a recorded listing date; live means any live listing; quiet means none. Likes/watchers alone do not set hot. All four read sections can run in the signed-in sweep. |
| [OPERATING.md](../../../app/src/edge/sold/OPERATING.md) | eBay push, Facebook appointment completion, Poshmark/Mercari public triggers followed by signed-in order confirmation, Depop sweep. Delist p95 budget under two minutes after seeing the sale; live signed-in delists not demonstrated in this guide. |
| [connect.md](../../../spec/features/connect.md) and [sold.md](../../../spec/features/sold.md) | Current text says sale email is out; no ten-minute Facebook-email loop was found in this checkout. The requested email grid remains a hypothetical, with no promised sale-email coverage. |
| [databricks.md §4.8 to §4.16](../../../spec/databricks.md) | Five-minute reconcile, 30-minute session-health probe, 60-second orders poll, hourly comps/rollups/threshold evaluation and daily retention. Connect also says nightly reconcile: inconsistent clocks. |
| [deploy/databricks.yml](../../../deploy/databricks.yml) | The scheduled bundle job found here is nightly_fits at 02:00 America/Chicago. User purge is parameterized, not periodically scheduled. Planned spec timers are not evidence of deployed jobs. |
| [watch.ts](../../../app/src/edge/watch/watch.ts), [feature-breakdown §11](../../../product/feature-breakdown.md#11-buy-alerts-and-the-brewers-jersey), [buyer-actions note](../../watch/nate/buyer-side-actions-and-affiliate.md) | Read to establish the boundary. Buyer wants/matches, refresh-before-alert and affiliate work belong to the other run and are excluded. |
| [proof-without-sales](../../../product/proof-without-sales.md), [demo constitution D10](../../../product/constitutions/demo.md) | A compressed stage clock is permitted in the design; claims must identify modeled versus demonstrated behavior, and the faster rate is disclosed if asked. |

*Assumption, dated 2026-11-15:* hot/live/quiet account-time shares 5%/75%/20%, sale shares 35%/65%/0%, and hot conditional competing hazard 10x (range 1x to 20x). This gives 36 hot, 540 live and 144 quiet hours in 30 days. It does not claim 35% of sales occur in the first hour. Seven-day vendor shares in S7 cannot identify one-hour sales or per-account occupancy. No first-hours or post-like causal uplift was established. The schedule can retain today's classifier; likes/watchers as hot triggers and an age-based quiet state require separate integration, not just an interval edit.

### S12. Maintenance drift and the limits of dollars

Job: explicit priors where no measured drift economics exist. *Assumption, dated 2026-11-15:* after an independent material change arrives uniformly between checks, average stale time is I/2; harm = changes/month × dollars/stale-hour × I/120. Base priors are reconcile (one change/month, $1/stale-hour, $0.0015/run); session health (0.2 failures/month, $2/hour, $0.0015/run); comps (one material change/month, $0.10/hour, $0.0001/run). Ranges are in the input manifest below. No source measured these harms. Anchors for the actions, not the dollar values: [databricks.md](../../../spec/databricks.md), [connect.md](../../../spec/features/connect.md), read 2026-11-15.

*Inferred, dated 2026-11-15:* session probes detect a broken session; they do not prevent revocation or automatically make a person relink. Token refresh should be due before the actual expiry or on demand; a 30-minute timer does not guarantee it. Nightly fitting, daily retention, hourly analytics/thresholds get separate sensitivity rows, but economic staleness cannot override privacy deadlines or held-out training windows. Sale detection drift is excluded from reconcile's harm, avoiding charging for the same missed sale twice. Additional restriction exposure from maintenance reads, delayed buyer replies/offers, support costs and retry outages remain unpriced, so the computed sum is a **partial expected-cost objective**, not total social welfare.

## How the probability is used

*Inferred, dated 2026-11-15, mathematical model:* for a first sale on site s, competing sites have rates 1/Tj per day. Let H = sum of those rates; k=4 in this five-site hypothetical; harmonic T=k/H. Pass that T and k to ROI's `doubleSaleRate`, with w=I/2 + two minutes for confirmation/delist. Email adds its assumed delivery lag; eBay backstop multiplies affected first sales by the assumed miss fraction. Expected duplicate events = first sales × P. Recipient cancellation loss is weighted by each competing site's hazard, since the cancelled sale happens there, not necessarily where the first sale was detected.

*Inferred, dated 2026-11-15:* `1-exp(-H×E[w])` uses the mean window as requested. The exact uniformly timed exponential model would average the exponential over the window instead; this approximation is slightly conservative for that model. Independence, stationary hazards and immediate recovery after a failed read are much larger uncertainties. Multi-buyer bursts can break all three. First sale counts are provided directly, not inferred from inventory/T, because all-site first-sale competition and seller replenishment would otherwise need a separate cohort model. The model estimates whether at least one duplicate occurs, not unlimited additional payments in a burst. Source: [ROI doubleSaleRate](../../../scripts/bench/roi.mjs), read 2026-11-15.

## Search coverage and unreachable sources

*Observed search log, 2026-11-15:* queries covered official seller cancellations/refunds/standards on all four shipped marketplaces; eBay quotas and notification topics; Poshmark automation/robots; Mercari prohibited conduct; Depop terms; Meta collection terms; published days-to-sale/first-week shares, eBay sell-through, Poshmark filings, Mercari US disclosures; and primary competitor detection help. Counter-searches sought slow inventory, retained cancellation fees, automation restrictions and current competitor clocks. FLUF, SoldStack and Closo were opened after discovery, rather than treated as search snippets.

*Observed access limits, 2026-11-15:* Meta terms/help often returned login/block shells. Poshmark cancellation help timed out; robots.txt worked through direct curl after web fetch failed. The old eBay notification overview and order_confirmation.yaml URLs failed, so the current developer Notification Topics page was used. An initial direct Python Poshmark fetch encountered gzip decoding; compressed curl then read the live text. Raw reseller cohorts and independently audited early-sale curves were not obtained. No personal accounts, paid data or agent accounts were accessed. The searches do not establish that better timing or enforcement data does not exist.

## Complete input manifest

Each row below is generated from the executable model, read 2026-11-15. The URL anchors and reasons above explain the sources; assumptions deliberately retain a range even where no source gives a figure. All dollar outputs in the product note are *inferred* from this manifest.

<!-- input-manifest -->

| Input | Value | Unit | Mark | Source / range (read 2026-11-15) |
|---|---|---|---|---|
| `month_days` | `30` | days/month | *assumption* | research/sold/ben/check-interval-evidence.md: accounting month; range 28 to 31; read 2026-11-15 |
| `sales_per_site_month` | `2` | first sales/user-site-month | *assumption* | research/sold/ben/check-interval-evidence.md: one linked account on each site, 10 first sales total; range 0.2 to 20 per site; read 2026-11-15 |
| `active_listings` | `10` | public pages/user-site | *assumption* | research/sold/ben/check-interval-evidence.md: range 1 to 100; Depop sweeps are per account, public checks per listing; read 2026-11-15 |
| `mean_days` | `{"ebay":90,"poshmark":30,"depop":126,"mercari":30,"facebook":14}` | days per counterfactual site sale | *assumption* | research/sold/ben/check-interval-evidence.md: eBay FLUF 91.1, Depop FLUF 126.2 are vendor averages of sold items; Poshmark Closo 25 to 30 typical days conflicts with SoldStack 5-day median. These are hazard assumptions, not cohort estimates; ranges eBay 7 to 180, Poshmark 5 to 180, Depop 7 to 240, Mercari 1 to 180, Facebook 1 to 90; read 2026-11-15 |
| `delist_minutes` | `2` | minutes after detection | *assumption* | research/sold/ben/check-interval-evidence.md: OPERATING.md budget, not measured; includes confirmation and all delists in parallel; range 1 to 10; read 2026-11-15 |
| `item_price` | `33` | $/item | *observed* | https://www.sec.gov/Archives/edgar/data/1825480/000119312520320132/d66583ds1.htm : 2019 average order value; historical anchor only; read 2026-11-15 |
| `refund_minutes` | `10` | minutes/double sale | *assumption* | research/sold/ben/check-interval-evidence.md: contact buyer, refund, check state; range 5 to 30; read 2026-11-15 |
| `time_value_hour` | `20` | $/seller-hour | *assumption* | research/sold/ben/check-interval-evidence.md: opportunity cost, no wage claim; range 0 to 40; read 2026-11-15 |
| `trust_loss` | `10` | $/double sale | *assumption* | research/sold/ben/check-interval-evidence.md: lost goodwill and distress; range 0 to 50, never measured retention; read 2026-11-15 |
| `penalty_loss` | `{"ebay":10,"poshmark":5,"depop":2,"mercari":5,"facebook":0}` | $/cancellation | *assumption* | research/sold/ben/check-interval-evidence.md: shadow cost of account standing, not a published fine; ranges eBay 0 to 200, Poshmark 0 to 100, Depop 0 to 50, Mercari 0 to 100, Facebook 0 to 50; read 2026-11-15 |
| `mercari_fee_rate` | `0.05` | share of price | *observed* | https://www.mercari.com/us/help_center/article/251/ : may charge, not every cancellation; read 2026-11-15 |
| `mercari_fee_cap` | `25` | $/cancellation | *observed* | https://www.mercari.com/us/help_center/article/251/; read 2026-11-15 |
| `mercari_fee_probability` | `0.5` | share of cancellations charged | *assumption* | research/sold/ben/check-interval-evidence.md: policy says may; range 0 to 1; read 2026-11-15 |
| `browser_hour` | `0.06` | $/browser-hour | *observed* | https://browser-use.com/pricing : browser only, traffic extra; read 2026-11-15 |
| `browser_minutes` | `1` | billed browser-minutes/sweep | *assumption* | research/sold/ben/check-interval-evidence.md: numbers.md assumed one started minute; range 0.25 to 4; four watcher sections must fit together; read 2026-11-15 |
| `browser_mb` | `1` | MB/sweep | *assumption* | research/sold/ben/check-interval-evidence.md: range 0.1 to 5; no payload measurement; read 2026-11-15 |
| `direct_gb` | `0.2` | $/GB | *observed* | https://browser-use.com/pricing : own proxy or direct traffic; read 2026-11-15 |
| `residential_gb` | `5` | $/GB | *observed* | https://browser-use.com/pricing : home-IP traffic, sensitivity only; read 2026-11-15 |
| `public_request` | `0.000001` | $/plain page request | *assumption* | research/sold/ben/check-interval-evidence.md: allocated server cost, range 0 to 0.0001; not a free external scrape credit; read 2026-11-15 |
| `job_run` | `0.00001` | $/account sweep or mail/API poll | *assumption* | research/sold/ben/check-interval-evidence.md: allocated compute and logging; range 0.000001 to 0.001; read 2026-11-15 |
| `mercari_browser_share` | `0` | share of public reads needing browser | *assumption* | research/sold/ben/check-interval-evidence.md: cheap-route hypothetical; range 0 to 1. Unknown/bot wall is failure, never an automatic browser retry; read 2026-11-15 |
| `restriction_hazard_15` | `{"depop":0.001,"poshmark":0.0001,"mercari":0.0001}` | incident hazard/user-site-month at 15 min | *assumption* | research/sold/ben/check-interval-evidence.md: restriction or access-loss reserve, not measured bans: signed-in range 0 to 0.01, public range 0 to 0.001. Public access risk is not zero; read 2026-11-15 |
| `restriction_exponent` | `1.5` | frequency exponent | *assumption* | research/sold/ben/check-interval-evidence.md: hazard rises faster than request count; range 1 to 2; read 2026-11-15 |
| `restriction_loss` | `100` | $/restriction or access incident | *assumption* | research/sold/ben/check-interval-evidence.md: seller downtime/support/opportunity cost; range 20 to 1000; read 2026-11-15 |
| `hazard_multiplier` | `1` | multiplier | *assumption* | research/sold/ben/check-interval-evidence.md: conditional demand clustering; sensitivity 0.25 to 20; read 2026-11-15 |
| `time_shares` | `{"hot":0.05,"live":0.75,"quiet":0.2}` | share of account-month | *assumption* | research/sold/ben/check-interval-evidence.md: 36 hot hours, 540 live hours, 144 quiet hours. Account states, not listing ages; replace with traces; read 2026-11-15 |
| `sale_shares` | `{"hot":0.35,"live":0.65,"quiet":0}` | share of first sales | *assumption* | research/sold/ben/check-interval-evidence.md: interest-enriched scenario, not derived from first-week sales; hot range 0.05 to 0.70; read 2026-11-15 |
| `state_hazard` | `{"hot":10,"live":1,"quiet":0}` | multiplier of other-site sale hazard | *assumption* | research/sold/ben/check-interval-evidence.md: likes/offers may cluster buyers; hot range 1 to 20. Quiet means no live listings; read 2026-11-15 |
| `stage_seconds` | `10` | seconds/check | *assumption* | research/sold/ben/check-interval-evidence.md: isolated backend stage param profile, design only; not a production rate; read 2026-11-15 |
| `push_miss_share` | `0.01` | share of eBay sales missed by push | *assumption* | research/sold/ben/check-interval-evidence.md: range 0 to 0.10; delivery SLA/missed fraction not measured; read 2026-11-15 |
| `mail_delivery_minutes` | `2` | minutes before email available | *assumption* | research/sold/ben/check-interval-evidence.md: hypothetical only, range 0 to 60; no Facebook sold-email coverage established; read 2026-11-15 |
| `reconcile_run` | `0.0015` | $/user-job | *assumption* | research/sold/ben/check-interval-evidence.md: incremental full inventory comparison across linked sites, range 0.0001 to 0.01; exclude sale detection already counted; read 2026-11-15 |
| `reconcile_events` | `1` | unnoticed non-sale drifts/user-month | *assumption* | research/sold/ben/check-interval-evidence.md: range 0.1 to 10; read 2026-11-15 |
| `reconcile_loss_hour` | `1` | $/hour of unresolved drift | *assumption* | research/sold/ben/check-interval-evidence.md: range 0.05 to 10, linear while unresolved; read 2026-11-15 |
| `session_run` | `0.0015` | $/user-job | *assumption* | research/sold/ben/check-interval-evidence.md: light health probes across accounts, range 0.0001 to 0.01; demand refresh is separate; read 2026-11-15 |
| `session_events` | `0.2` | unexpected session failures/user-month | *assumption* | research/sold/ben/check-interval-evidence.md: range 0.01 to 2; read 2026-11-15 |
| `session_loss_hour` | `2` | $/hour of hidden session failure | *assumption* | research/sold/ben/check-interval-evidence.md: range 0.10 to 20; value only if earlier probe can enable recovery; read 2026-11-15 |
| `comps_run` | `0.0001` | $/user-job | *assumption* | research/sold/ben/check-interval-evidence.md: amortised seller valuation comps, range 0.00001 to 0.01; no buyer wants; read 2026-11-15 |
| `comps_events` | `1` | material comp changes/user-month | *assumption* | research/sold/ben/check-interval-evidence.md: range 0.1 to 10; read 2026-11-15 |
| `comps_loss_hour` | `0.1` | $/hour of stale valuation | *assumption* | research/sold/ben/check-interval-evidence.md: range 0.001 to 1; excludes losses already counted as inventory drift; read 2026-11-15 |
| `internal_run` | `{"rollups":0.00001,"thresholds":0.00002,"nightly_fits":0.001,"retention":0.00001}` | $/user-job | *assumption* | research/sold/ben/check-interval-evidence.md: amortised batch work, not a Databricks quote; each range 0.1x to 100x; read 2026-11-15 |
| `internal_events` | `{"rollups":1,"thresholds":0.1,"nightly_fits":0.01,"retention":0.01}` | drifts/user-month | *assumption* | research/sold/ben/check-interval-evidence.md: seller-facing share only; each range 0 to 10x; read 2026-11-15 |
| `internal_loss_hour` | `{"rollups":0.01,"thresholds":1,"nightly_fits":0.1,"retention":0.1}` | $/hour of unresolved drift | *assumption* | research/sold/ben/check-interval-evidence.md: shadow values only, each range 0 to 10x; retention deadlines still bind; read 2026-11-15 |
