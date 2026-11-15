# How often should a want check each marketplace?
Researched 2026-11-15 by Ben (Codex, GPT-6). Feature: watch.

## Answer

**An hour saves reads but gives a newly visible listing an average 30-minute head start over us, with a 57-minute p95 polling wait.** Five-minute checks reduce those waits to 2.5 and 4.75 minutes, at 12 times the reads. These are scheduling arithmetic, assuming listing arrivals have a random position between successful checks, before indexing, processing, push delivery and buyer response. *(inferred)*

**There is no defensible measured ROI-maximising interval for every site yet.** Public evidence establishes a fast tail, not how often an underpriced item satisfying one person's want disappears in minutes. Start from the spec's adaptive 5 to 60-minute range as an *agent proposal*, measure successful discovery and settled revenue, and buy faster reads only where their extra benefit exceeds their extra cost. An approved eBay Browse search has no per-call charge within its allowance; browser traffic, session rounding and sharing decide the other routes. Mercari's current project restriction excludes timer sweeps. *(inferred; [watch spec](../../../spec/features/watch.md), [Nate's ruling](../../../.agents/team/packets/team/67-nates-rulings-and-where-they-meet-bens-plans.md))*

**The strongest cheap speed lever is our own supply.** Once a real secondhand cross-listing operation confirms a listing is live, match it against existing wants and send eligible alerts immediately. This avoids waiting for a search poll; it does not promise instant delivery, a completed purchase, or a marketplace-wide feed. *(inferred; agent proposal)*

Evidence convention: *(observed)* means a page, published tariff or repo result was read; *(asserted)* means its author claims performance, market behaviour or counts that we did not independently reproduce; *(inferred)* means arithmetic, modelling assumptions or an agent proposal. **Every external source linked below was searched and opened on 2026-11-15**, including sources read by bounded research helpers. Historical dates and unreadable bodies are stated separately. No production marketplace trial, paid API call or invoice test ran for this note. *(observed)*

## Model

### A check is shared work; a notification is a separate decision

Use one site/search group as the cost unit, then allocate its cost to the wants it actually covers. A broad search can cover different sizes and price ceilings through local filtering, provided it returns every relevant new listing. More pages, regional searches and missed results reduce that advantage. A seen-ID set avoids repeated matching and alerts; it does **not** make the next network read free. *(inferred)*

For a 30-day comparison month, define:

| Input | Meaning and evidence |
|---|---|
| `c` | Minutes between successful checks; requested comparisons: 1, 5, 15, 60. A scheduled attempt that is blocked is not a successful check. *(inferred)* |
| `M = 30 × 24 × 60 = 43,200` | Minutes in the comparison month; calendar convention, not forecast usage. *(inferred)* |
| `k` | Dollars per successful search check, including all pages, retries, session rounding and traffic. Tariffs below only price parts of `k`. *(inferred)* |
| `s` | Covered active wants per search read, adjusted for extra pagination and different cadences. Unknown in this product. *(inferred)* |
| `mu` | Fitting, genuinely new listings per want-month, including listings sold before discovery. Unknown by site/category; the Brewers snapshot below is a limited starting observation. *(inferred)* |
| `T`, `S(t)` | Time from publication until the item becomes unavailable to this buyer, and `P(T > t)`. Pending/reserved status and accepted offers can close the opportunity before a sold flag appears. *(inferred)* |
| `d`, `r` | Publication-to-search delay and processing/delivery/buyer-response delay. Their measured distributions are needed; setting both to zero gives an optimistic comparison. *(inferred)* |
| `a`, `q` | Probability our route returns the item at all, and probability the person proceeds and wins while it is available. Neither is established by a successful sample fetch. *(inferred)* |
| `Delta` | Comparable **actual sold delivered value minus this listing's delivered cost**, adjusted for condition/variant/fit. It is not original retail price minus asking price. No usable current sold-price sample was established here. *(inferred)* |
| `v`, `f`, `z` | Eligible transaction value, approved commission rate, and probability attribution survives cancellations, exclusions and last-click replacement. An unapproved program has zero confirmed revenue. *(inferred)* |

With random listing phase, polling wait `U` is uniform on `[0,c]`. The optimistic reach probability is:

```text
p(c) = a × E[S(d + U + r)]
     = a/c × integral from 0 to c of E[S(d + u + r)] du

For a listing with known lifetime T, d=r=0 and a=1:
p(c | T) = min(T/c, 1)

Check cost/want-month = 43,200 × k / (c × s)
```

These are model definitions, not measured marketplace behaviour. For random delays use the expectation, rather than substituting average delays into a nonlinear survival function. *(inferred)*

Ben's requested one-opportunity approximation is:

```text
P(a fitting listing appears) = 1 − exp(−mu)        [Poisson assumption]
buyer value/month ≈ (1 − exp(−mu)) × p(c) × q × Delta
our contribution/month ≈ (1 − exp(−mu)) × p(c) × q × v × f × z
                         + attributable subscription revenue − check cost
```

For a want that continues after a miss and ends after one purchase, the more useful model is `P(success in month) = 1 − exp(−mu × p(c) × q)`. Multiply that by savings or commission **once**, rather than charging the same want with buying every matching listing. Independence, stationary arrivals and constant `q` are untested assumptions. Charge checks only while the want is active: the full-month cost tables below are a conservative allocation for a continuously active want, not an exact stopping-time bill. Across sites, deduplicate physical items before adding arrival rates. *(inferred)*

Keep buyer savings and company contribution separate. Adding them can show joint value, but a person's savings do not pay the browser bill. For optimisation use incremental contribution dollars; an API-charge-only return-on-investment (ROI) ratio is undefined at zero API charge. Full ROI can still use nonzero hosting, processing and support costs. *(inferred)*

### The rule for buying more speed

For faster cadence `c_fast` versus `c_slow`, use:

```text
extra expected settled revenue + extra attributable paid-tier revenue
  > 43,200 × k/s × (1/c_fast − 1/c_slow)
    + extra processing, support and expected disruption cost
```

Run the same comparison with buyer value to see what is worth subsidising. Measure it per **search group and category**, not just per site. No block-probability or support-cost estimate was found, so those terms remain variables rather than fabricated percentages. *(inferred)*

## Numbers

### 1. What speed is worth: evidence and its limits

| Site | Published lifetime or engagement evidence | What it supports |
|---|---|---|
| eBay | GrailHound reports timing 103,570 completed, single-item fixed-price collectible sales over 382 searches, collected 2026-09-08 to 09. Counts sold by 1/2/5/30/60 minutes: 70/139/422/2,085/3,389. It excludes auctions, multi-quantity and apparently arranged sales; median about 20 days. *(asserted; [study and method](https://grailhound.app/how-fast-do-collectibles-sell))* | A documented fast tail **conditional on its selected sold sample**. No underpricing labels or unsold cohort; cannot transfer its distribution to a Brewers jersey or all new listings. *(inferred)* |
| Poshmark | Flipper reports a 15-day median among recorded sold items; Alo Yoga 3 days, Vuori 5. *(asserted; [resale index](https://www.flipper-vintage.com/resale-index))* Closo reports first like averaging 1.4 hours and first offer 2.8 days in a self-described 1,200+ listing history. *(asserted; [article](https://closo.co/blogs/beginner-guides-how-tos/is-poshmark-good-for-selling-what-i-learned-after-listing-1-200-items-across-4-years))* | Neither supplies a reproducible minute-scale underpriced survival curve. Likes, offers and sales are different outcomes. *(inferred)* |
| Mercari US | No usable measured underpriced lifetime or first-like/offer distribution found. Flipper withholds sale-speed figures because scan timing delays sale detection. *(observed search gap; [index](https://www.flipper-vintage.com/resale-index))* | No numeric `S(t)` calibrated. Japan statistics do not establish US behaviour. *(inferred)* |
| Depop | No usable underpriced lifetime/first-engagement distribution found; the same scan-delay limitation appears in Flipper's index. Depop describes a 24-hour window after an offer to buy/counter. *(observed; [official offers article](https://news.depop.com/depop-community-embraces-offers-as-suite-of-negotiation-tools-expands/))* | An offer window is not time to sale or evidence the item survives for 24 hours. *(inferred)* |
| Facebook Marketplace | Autobook reports 802 sold US dealer vehicles: median 18 days; 2.9% sold within 24 hours, 65.2% within 30 days, using latest post to detected sale. *(asserted; [study](https://autobook.io/blog/facebook-marketplace-vehicle-listing-study-2026))* | Not a household-goods or underpriced cohort. Reposts and late sold marking distort the clock. No minute-scale survival estimate. *(inferred)* |
| Grailed | Flipper reports a 22-day sold-item median, Hellstar 8 days and Fear of God Essentials 10. *(asserted; [index](https://www.flipper-vintage.com/resale-index))* | Sold-item/category medians say little about the best-priced tail; no measured minute-scale curve found. *(inferred)* |

Counterevidence matters: FlowLister describes 33,638 single-unit eBay US listings from 242 sellers, listed May 15 to September 14 and observed through October 15, 2026; 12.2% sold within 30 days, with a 7.5-day median among those sales. It is largely used-apparel reseller inventory, not a fair sample of underpriced deals. It nevertheless argues against treating every new matching listing as an urgent, minutes-long opportunity. *(asserted; [cohort and method](https://flowlister.com/ebay-listing-data-study/); inference about urgency)*

Swoopa advertises a 47-second average listing-to-app alert, without a reproducible timing protocol on the opened page. Flipify sells 10-minute and 1-minute **check intervals**. These are alert-service claims, not measurements of how many deals sell in those intervals. No credible Swoopa/Flipify first-N-minute sale proportion was found; claims such as “deals go in minutes” cannot supply a hazard rate. *(asserted for speeds; observed search gap; [Swoopa](https://getswoopa.com/), [Flipify help](https://www.flipifyapp.com/help))*

The eBay study yields this **conditional empirical curve only**, with arithmetic `1 − sold_by_t/103,570`. All six sites' **underpriced-listing** curves remain unknown. *(inferred)*

| Minutes since listing | `P(T > t | inclusion in GrailHound's sold sample)` |
|---:|---:|
| 1 | 99.9324% |
| 2 | 99.8658% |
| 5 | 99.5925% |
| 30 | 97.9869% |
| 60 | 96.7278% |

Using only those published bins, bound capture by placing each bin's sales at its lower or upper endpoint and averaging `min(T/c,1)`. No exponential curve or invented 15-minute observation is needed. These are optimistic bounds for the **same selected sample**, with zero other delays and perfect reads. *(inferred)*

| Check interval | Capture probability bounds, sold sample | Mean / p95 polling wait | Reads/day | Reads/30 days |
|---:|---:|---:|---:|---:|
| 1 minute | 99.9324 to 100% | 0.5 / 0.95 min | 1,440 | 43,200 |
| 5 minutes | 99.7152 to 99.9060% | 2.5 / 4.75 min | 288 | 8,640 |
| 15 minutes | 98.5630 to 99.6970% | 7.5 / 14.25 min | 96 | 2,880 |
| 60 minutes | 97.5014 to 98.8158% | 30 / 57 min | 24 | 720 |

The hourly miss probability here is **not** 3.27%: a poll sometimes lands before a within-hour sale. The underlying downloadable table is offered with CC BY 4.0 attribution, but the web tool could not parse its download and the shell could not resolve the source host; bounds above use published counts, not a claimed reanalysis of raw rows. Credit: GrailHound, linked study. *(observed access limit; inferred arithmetic)*

### 2. What a read costs

#### Browser Use Cloud, which Nate's harness actually uses

[Browser Use pricing](https://browser-use.com/pricing) lists $0.06/browser-hour, billed by whole minutes with a one-minute minimum, $5/GB residential traffic, and $0.20/GB direct/own-proxy traffic. No recurring subscription; purchased credits start at $5. [Billing docs](https://docs.browser-use.com/cloud/guides/billing.md) explain rounding and billed idle time; a V4 agent browser normally lingers about two minutes after its last run unless stopped. Code driving the browser directly does not need an agent task; the advertised $0.006 median task is an additional inference example, not a fixed check tariff. *(observed)*

The [Poshmark harness](../../../app/src/edge/harness/sites/poshmark/README.md) reports active search around 2 to 2.5 seconds and 48 rows. The [Depop harness](../../../app/src/edge/harness/sites/depop/README.md) reports about 1.5 seconds and 24 rows; [Nate's packet](../../../.agents/team/packets/team/67-nates-rulings-and-where-they-meet-bens-plans.md) describes later Depop runs at 1.8 seconds and Mercari at 5 to 6 seconds. These are small live-read results, not billed per-check averages at scale. *(observed repo evidence)*

| Browser use pattern | Browser dollars/1,000 checks | Reason |
|---|---:|---|
| Fresh session/check, under one minute, explicitly stopped | $1.00 | `1,000 × $0.06/60`; excludes start-up spilling into another minute. *(inferred)* |
| Warm, busy Poshmark pool, 2 to 2.5 seconds of work/check | $0.0333 to $0.0417 | `1,000 × seconds × $0.06/3,600`; **marginal busy time only**, excludes rounding/start-up/idle capacity. *(inferred)* |
| One continuously provisioned browser | $43.20/month | `30 × 24 × $0.06`; allocate across actual completed checks. A dedicated idle browser does not get cheaper merely by polling hourly. Session rotation adds overhead. *(inferred)* |
| Residential transfer | `+$5,000 × B` | `B` = actual billed GB/check. *(inferred)* |
| Direct/own-proxy transfer | `+$200 × B`, plus external proxy-vendor charge | Same measured bytes; availability without residential routing must be tested. *(inferred)* |

Poshmark's README reports a **2.4 to 4.4 MB navigation response body**. That is decoded content, not total billed network transfer: compression can reduce it, while assets and subsequent calls add traffic. As a bandwidth sensitivity only, if billed bytes equal that body size and 1 GB = 1,024 MB as in Browser Use's examples, residential traffic adds `$5 × 1,000 × (2.4…4.4)/1,024 = $11.72…$21.48/1,000 checks`; direct traffic adds $0.47…$0.86. Do not call this an invoice measurement. *(observed body-size result; inferred sensitivity; [billing examples](https://docs.browser-use.com/cloud/guides/billing.md))*

#### API and hosted-reader tariffs

| Route | Published price / constraint | Dollars per 1,000 one-page checks |
|---|---|---:|
| eBay Browse | 5,000/day for methods other than `getItems`; separate `getItems` allowance. Free access within limits, production business-model approval/contracts required. *(observed; [limits](https://developer.ebay.com/develop/api/buy/api_call_limits), [free access](https://ebaypartnernetwork.ebay.com/solutions/step-4-optimizing-and-automating), [requirements](https://developer.ebay.com/api-docs/buy/static/buy-requirements.html))* | $0 API charge within approved allowance; hosting/parsing extra. *(inferred)* |
| Firecrawl plain Monitor | Minimum 5 minutes; 1 credit/page/check. Standard monthly plan $99/100,000 credits. *(observed; [pricing](https://www.firecrawl.dev/pricing), [monitor](https://www.firecrawl.dev/monitor))* | $0.99 allocated included credits; Standard overage $2.50. *(inferred)* |
| Firecrawl deterministic JSON Monitor | Explicit pricing says 7 credits/page/check. Some monitoring docs describe add-ons differently; use the explicit tariff pending an invoice test. *(observed; [pricing](https://www.firecrawl.dev/pricing), [guide](https://docs.firecrawl.dev/features/monitoring))* | $6.93 allocated; Standard overage $17.50. *(inferred)* |
| ScrapeCreators Facebook | Freelance $47/25,000 credits, most endpoints 1 credit/request; unofficial Marketplace search. *(observed; [home/pricing](https://scrapecreators.com/), [endpoint](https://scrapecreators.com/facebookMarketplace-search-api))* | $1.88 at one credit/check; verify endpoint charging and extra pages. *(inferred)* |
| changedetection.io, already in the spec | $8.99/month, up to 5,000 URLs, checks from about 5 minutes **per runner**, one Chrome browser included. Marketplace success/capacity untested. *(observed; [official offer](https://changedetection.io/))* | Flat capacity allocation, not a metered per-check quote; formula below. *(inferred)* |

Firecrawl's monthly included-credit prices per 1,000 plain checks are Hobby $3.80 (`$19/5,000`), Standard $0.99, Growth $0.798 (`$399/500,000`) and Scale $0.749 (`$749/1,000,000`). Multiply by seven for deterministic JSON. Standard annual billing displays $83/month equivalent; it is a commitment, not the $99 monthly plan. Free has 1,000 credits/month. Small actual bills cannot be obtained by buying fractional plans; use included-credit allocation for averages and overage/opportunity cost for marginal decisions. *(observed tariffs; inferred divisions; [pricing](https://www.firecrawl.dev/pricing))*

For changedetection.io, if `G` query URLs actually complete every `c` minutes on one subscription, allocation is `$8.99/G` per query-month and `$8.99 × 1,000 / (G × 43,200/c)` per 1,000 checks; divide query cost by sharing `s` for a want. One query costs the full $8.99 subscription whether checked every 5, 15 or 60 minutes; one-minute service is not advertised. **5,000 URL slots do not establish 5,000 URLs completing every five minutes.** At the Poshmark harness's 2.5-second workload, one serial browser needs `5,000×2.5/60 = 208.3 minutes` per pass before overhead. This is a capacity illustration, not measured changedetection.io performance. Its potentially cheaper flat cost remains a legitimate rival to test, as the spec already proposes. *(inferred)*

#### Per continuously active want, no sharing, before traffic and extra work

All dollar amounts are `43,200/c × unit price`. Browser columns exclude **all traffic**. Firecrawl columns use Standard included-credit allocation, not cash payable for one want; native Monitor cannot run at one minute. *(inferred)*

| Interval | Browser, fresh stopped session/check | Browser, 2 to 2.5 s busy-time allocation | eBay API, approved quota | Firecrawl plain | Firecrawl JSON | ScrapeCreators Facebook |
|---:|---:|---:|---:|---:|---:|---:|
| 1 min | $43.20 | $1.44 to $1.80 | $0 | $42.77† | $299.38† | $81.22 |
| 5 min | $8.64 | $0.288 to $0.360 | $0 | $8.55 | $59.88 | $16.24 |
| 15 min | $2.88 | $0.096 to $0.120 | $0 | $2.85 | $19.96 | $5.41 |
| 60 min | $0.72 | $0.024 to $0.030 | $0 | $0.71 | $4.99 | $1.35 |

† Credit extrapolation only. A one-minute custom poll through standalone scrape would have its own format pricing; this is **not** an available one-minute Monitor quote. At Standard overage, plain 5-minute polling is $21.60/month and deterministic JSON $151.20, before sharing. *(inferred)*

For any site using cloud browsers, add `(43,200/c) × B × proxy_rate` and allocate real pool idle time. Do not use the Poshmark busy-time range as a measured Mercari or Facebook cost. A retained signed-in browser per person is a different cost model from a shared anonymous search pool. *(inferred)*

#### Apify: a result is not a check

These are advertised community actors, not proven routes or recommendations. Let `r` be charged rows/check and `p` charged pages/check. The illustrations use **48 Poshmark rows** from Nate's harness and **24 rows for the other sites** as a comparison workload, not measured output from these actors. All actor tariffs are *(observed)* on the linked pages; conversions are *(inferred)*.

| Site / actor | Published basic event tariff | Dollars/1,000 checks formula | Illustrated dollars/1,000 checks |
|---|---|---:|---:|
| [eBay, datascrapers](https://apify.com/datascrapers/ebay-scraper) | README $1/1,000 rows + $0.00005/start; header says from $1.07/1,000, unresolved | `r + 0.05`, README basis | $24.05 |
| [Poshmark, jeffev](https://apify.com/jeffev/poshmark-scraper) | $0.50/1,000 delivered rows; platform included | `0.50r` | $24.00 |
| [Depop, topapi](https://apify.com/topapi/depop-scraper) | $0.81/1,000 rows; no start fee; detail enrichment extra | `0.81r` | $19.44 |
| [Mercari, automation_craft](https://apify.com/automation_craft/mercari-scraper) | Free-plan tariff $0.99/1,000 rows + $0.006/start + $0.60/1,000 monitored pages | `6 + 0.99r + 0.60p` | $30.36 with `p=1` |
| [Grailed, unfenced-group](https://apify.com/unfenced-group/grailed-scraper) | README $0.99/1,000 rows; header from $0.88, unresolved | `0.99r`, README basis | $23.76 |
| [Facebook, automation_craft](https://apify.com/automation_craft/facebook-marketplace-scraper) | Free-plan tariff $1/1,000 rows + $0.006/start + $1.20/1,000 nonempty pages | `6 + r + 1.20p` | $31.20 with `p=1` |

Monthly costs below multiply those illustrated tariffs by `43.2, 8.64, 2.88, 0.72` thousand checks. They model independent runs returning those rows each time. *(inferred)*

| Site | 1 min | 5 min | 15 min | 60 min |
|---|---:|---:|---:|---:|
| eBay actor | $1,038.96 | $207.79 | $69.26 | $17.32 |
| Poshmark actor | $1,036.80 | $207.36 | $69.12 | $17.28 |
| Depop actor | $839.81 | $167.96 | $55.99 | $14.00 |
| Mercari actor | $1,311.55 | $262.31 | $87.44 | $21.86 |
| Grailed actor | $1,026.43 | $205.29 | $68.43 | $17.11 |
| Facebook actor | $1,347.84 | $269.57 | $89.86 | $22.46 |

Incremental-monitor behaviour changes this substantially: Depop's actor says remembered rows are free, whereas Facebook can still charge starts/pages. Empty results do not imply a free run. Paid-tier discounts require the associated platform spending; run startup, success rate and newest-first completeness remain untested. An actor's cheap listing tariff alone cannot establish cheap frequent checks. *(observed descriptions; inferred implication; linked actor pages)*

### 3. Sharing at 1k, 10k and 100k people

There is **no measured search-demand distribution** for secondhand, so no honest empirical sharing estimate yet. Use an explicit occupancy model to show the dependency: one active want/person on a given site, `N` people, `Q` equally likely reusable query buckets, one page/bucket/check. Expected occupied groups `G = Q × [1 − (1 − 1/Q)^N]`; for these sizes the approximation `Q × (1 − exp(−N/Q))` gives the table below. Effective sharing `s = N/G`; per-want search cost becomes unshared cost divided by `s`. *(inferred)*

`Q = 1k/10k/100k` are **sensitivity settings taken from the requested scale grid**, not estimates of the market's searches. Each cell shows approximate sharing and allocated five-minute Firecrawl plain cost (`$8.5536/s`). *(inferred)*

| People `N` | `Q=1k` buckets | `Q=10k` buckets | `Q=100k` buckets |
|---:|---:|---:|---:|
| 1k | 1.58× / $5.41 | 1.05× / $8.14 | 1.005× / $8.51 |
| 10k | 10.00× / $0.86 | 1.58× / $5.41 | 1.05× / $8.14 |
| 100k | 100.00× / $0.086 | 10.00× / $0.86 | 1.58× / $5.41 |

Without clustering, sharing can remain near one at every scale. Exact shared identity can be broader than a full want: one complete “Brewers jersey” stream can cover men's and women's sizes and different caps. But broadening may require more pages; local pickup searches fragment by geography; user-specific sessions/personalisation may prevent safe reuse. Measure `search reads saved / extra pages incurred`, not just duplicate text. Hot popular searches can have high sharing, while a rare long-tail want remains expensive even at 100k users. *(inferred)*

Sharing is also competition: many watchers can receive the same scarce item, but only one buys it. Do not multiply one physical sale's affiliate revenue by the number of alerted people. *(inferred)*

### 4. Expected value and which cadence wins

The Brewers trial found 48 still-visible newest-first Poshmark listings spanning 99.6 hours: about 11.6/day; 8 fit the men's L/XL jersey-under-$60 rule, about 1.9/day. It did **not** measure underpricing, true paid sold comps, sale lifetime or delivered-price eligibility. A snapshot of surviving listings can miss fast sales and distort arrival estimates. It is not a site-wide rate. *(observed repo result; inferred limitation; [trial](brewers-alert-trial.md))*

For illustration using its rounded rate, `mu = 1.9 × 30 = 57` fitting listings/month; stationary Poisson arrivals imply `P(any fitting listing) = 1 − exp(−57)`, effectively one. That does **not** mean all are bargains, that we find all of them, or that the person buys. No transferable numerical `mu` was found for the other five sites. *(inferred)*

A current defensible dollar value for **savings** could not be filled. eBay says [Product Research](https://www.ebay.com/help/selling/selling-tools/terapeak-research-and-SEO?id=4853) exposes actual accepted Best Offer prices, shipping and condition filters, but no authorised current matched sold-price extract was available in this run. Poshmark's $60 cap is willingness to pay, not a measured market value. Use `Delta` until such comps exist; substituting original retail price or two unlike sold items would invent savings. *(observed documentation/access gap; inferred modelling choice)*

For company-side arithmetic, use the existing ROI note's **historical** $33 order-value anchor, verified in [Poshmark's S-1](https://www.sec.gov/Archives/edgar/data/1825480/000119312520320132/d66583ds1.htm), and eBay's published fashion 4% rate: `$33 × 4% = $1.32` per eligible attributed order, before reversals. This is a portable calculation, **not** current eBay order value or confirmed Poshmark affiliate income. Other programs' unverified rates are zero in the confirmed-program case. *(observed historical filing and [rate card](https://secureir.ebaystatic.com/cr/v/c1/EPN/Rate%20Card.pdf); inferred arithmetic)*

To make the missing lifetime visible, the next table is a **stress test**, not a fitted curve: an opportunity survives exactly **5 minutes**, using one of Ben's requested cadence values as the test lifetime. With `d=r=0`, `a=q=z=1`, an alert captures `min(5/c,1)`. Let `A=P(a fitting opportunity appears in month)` for the one-opportunity model. All cells are *(inferred)*.

| Cadence | Reach probability in 5-minute test | Buyer value before any price paid for this service | eBay-fashion revenue before check cost | Fresh browser check cost / `s`, no traffic | Plain Firecrawl allocation / `s` |
|---:|---:|---:|---:|---:|---:|
| 1 min | 100% | `A × Delta` | `$1.32 × A` | `$43.20/s` | native Monitor unavailable |
| 5 min | 100% | `A × Delta` | `$1.32 × A` | `$8.64/s` | `$8.5536/s` |
| 15 min | 33.33% | `A × Delta/3` | `$0.44 × A` | `$2.88/s` | `$2.8512/s` |
| 60 min | 8.33% | `A × Delta/12` | `$0.11 × A` | `$0.72/s` | `$0.7128/s` |

Subtract the selected cost column from expected company revenue; add traffic and non-check costs. For a Facebook, Poshmark, Mercari, Depop or Grailed sale with **no approved payable program**, the affiliate-only contribution is simply negative check cost. Among the requested cadences, 60 minutes then loses least money, but calling that a successful product or a measured optimum would be wrong. A paid tier or retention value must fund the buyer benefit. *(inferred)*

In the one-opportunity test with `A=1`, fresh stopped browser sessions and no traffic, 5 versus 60 minutes costs an additional `$7.92/s` for `$1.21` extra fashion commission; it breaks even only above `s=7.92/1.21=6.55`. Five versus 15 costs `$5.76/s` for `$0.88` extra commission, requiring `s>6.55`. One-minute checking provides no additional capture in this particular 5-minute-lifetime test; a shorter lifetime or real response delays change that. These are optimistic **conditional thresholds**, not forecasts. *(inferred)*

The repeating-opportunity model changes the conclusion: with `mu=57`, the same artificial 5-minute lifetime and `q=1`, hourly checking gives `1−exp(−57/12)=99.13%` chance of at least one catch during the month. But expected time to a catch is `1/(1.9/12)=6.32 days`, versus `1/1.9=0.53 days` at five minutes under the stationary approximation. Monthly success alone can hide an unpleasant wait and missed exceptional bargains. *(inferred)*

For lifetime at least 60 minutes, the zero-delay stress model catches everything at every requested cadence, so hourly minimises paid checks. A quiet search lowers the expected benefit of extra reads but does not itself improve capture of a short-lived listing. For the eBay **published sold sample**, estimated extra capture from 5 versus 60 minutes is only 0.90 to 2.40 percentage points (subtract the conservative bounds above), worth about `$1.32 × [0.0090…0.0240] = $0.012…$0.032` per opportunity. This supports slow checks for ordinary stock if paid acquisition is expensive; it does not settle the underpriced tail. *(inferred)*

| Site | Defensible operational proposal / ROI conclusion | What can change it |
|---|---|---|
| eBay | **Approved API:** 1 minute weakly maximises capture among the four if per-call charge is zero, other costs equal, and quota is spare. At scale, allocate limited calls to groups with highest incremental value; 5 minutes is a reasonable spec-aligned trial, not a proven optimum. **Today:** API approval is pending, so page-harness costs apply. *(inferred; [Nate packet](../../../.agents/team/packets/team/67-nates-rulings-and-where-they-meet-bens-plans.md))* | Extra pages/details consume quota; permission, discovery lag, fit, category rate and purchase conversion. |
| Poshmark | **Agent proposal:** 5-minute shared hot search, 60-minute quiet search; choose only after measuring traffic and lifetime. No measured monetary optimum; zero confirmed affiliate-only case favours 60 on cost. *(inferred)* | Dense arrivals, large sharing and a paid/retention benefit can justify speed; large proxy bytes can reverse it. |
| Depop | Same conditional 5/60 trial on the public harness; seller API webhooks cannot be assumed to cover other people's new listings. No measured optimum. *(inferred)* | Public-read success, repeated new-row yield, traffic, approved affiliate terms. |
| Facebook Marketplace | **Agent proposal:** test 5-minute discovery against the spec's p95 target; 60-minute quiet searches only with their lag shown. No measured optimum; no confirmed consumer affiliate payout. *(inferred)* | Search visibility delay and location fragmentation can dominate; paid fast tier can fund extra reads. |
| Mercari US | **No scheduled sweep under Nate's current ruling.** Price the intervals as hypothetical alternatives; do not activate one through this research. Read a requested search under the linked person's approval. *(observed ruling; inferred application)* | Ben/Nate resolve product scope and authorised access; a usable sanctioned event/source changes the problem. |
| Grailed | Search/price-only later in the decided scope. No calibrated optimum; 60 is the cheapest paid-reader comparison, 5 needs proven buyer/paid-tier benefit. *(observed [vision](../../../product/vision.md); inferred proposal)* | Access, true category fast-tail data, approved payable affiliate access and demand density. |

### 5. Risk and experience at each cadence

**All six sites bar unauthorised automated collection.** A public page, a vendor selling a scraper, or the person's consent does not itself grant the marketplace's permission. An hour reduces volume; it does not turn prohibited collection into permitted access. *(observed terms; inferred consequence)*

| Site | Primary rule / access evidence | Cadence implication |
|---|---|---|
| eBay | [User Agreement](https://www.ebay.com/help/policies/member-behaviour-policies/user-agreement?id=4259) excludes automated access without permission; approved API access is the route priced here. *(observed)* | 5,000 API calls/day is shared application capacity, not a per-person allowance. |
| Poshmark | [Terms](https://www.poshmark.com/terms) §4 bars automated collection; §16 permits suspension/termination. The page was readable initially but targeted refetches timed out. *(observed)* | Anonymous reads avoid using a customer account, but still face IP blocks and terms risk. |
| Mercari US | [Prohibited Conduct](https://www.mercari.com/us/help_center/topics/account/policies/prohibited-conduct/) forbids nonprovided automated access/extraction and describes account restrictions. *(observed)* | Current project policy excludes timer sweeps; no safe public rate published. |
| Depop | [API access terms](https://partnerapi.depop.com/api-docs/terms/) bar automated access without written authorisation. The [general terms URL](https://depophelp.zendesk.com/hc/en-gb/articles/360001773148-Terms-of-Service) now leads with **2027-01-01** text, so that version cannot establish November 15 wording. The prior repo read documented the general automation ban. *(observed current API terms and date anomaly; asserted historical general wording from [Nate's note](../nate/buyer-side-actions-and-affiliate.md))* | Do not present a future effective date as today's rule, or a seller integration as a market-search licence. |
| Facebook | Meta says [automated collection without permission violates its terms](https://about.fb.com/news/2021/04/how-we-combat-scraping/); [Automated Data Collection Terms](https://www.facebook.com/legal/automated_data_collection_terms) were not independently readable in this run. *(observed official explanation; access gap)* | Pacing and anonymous reads do not establish permission. |
| Grailed | [Terms](https://www.grailed.com/about/terms) §12 names automated extraction including AI/LLMs; third-party tools require written consent. *(observed)* | Search-only keys available to the page are not permission for our service. |

At one call/group/check the 5,000/day eBay allowance fits at most **3, 17, 52, 208** continuously polled groups at 1, 5, 15, 60 minutes: `floor(5,000 × c/1,440)`. These leave only the arithmetic remainder for other uses, not an operational reserve. Detail verification, pagination and other methods sharing the allowance reduce capacity. Increased limits require approval, not extra accounts. *(inferred; official limits above)*

For browser routes, requested reads per group fall from 1,440/day at one minute to 24/day hourly. Aggregate IP/account/site load depends on groups, not people alone. No reliable published ban probability by cadence, safe marketplace request rate or block-cost curve was found. Record HTTP 429, challenges, missing data and successful freshness; honour backoff and the harness's pause-on-challenge behaviour. A blocked faster poll can produce worse real freshness than a working slower one. *(inferred; [harness evidence](../../../app/src/edge/harness/sites/poshmark/README.md))*

Checks run in the cloud, so a faster scheduler need not wake the person's phone every minute. Battery and push fatigue depend on delivery behaviour. Retain the spec's match-only notifications, dedupe, quiet hours and digest: do not send “checked again” pushes. Hourly batching can still be noisy when many matches accumulate; one-minute checking can remain quiet if nothing fits. No credible battery-per-check or resale-notification fatigue threshold was found to price numerically. *(inferred; observed search gap)*

### 6. Levers beyond an interval

| Lever | Mechanism and benefit | Drawback / evidence boundary |
|---|---|---|
| Adaptive groups | Speed up when measured fit arrivals × incremental capture × buyer/company value exceeds extra check cost; slow down when it does not. A lower cap may make matches rarer but more contested, so estimate both arrival rate and lifetime. *(inferred; agent proposal)* | No universal “hot category” threshold established. Avoid inferring zero demand from a short empty run. |
| Fresh events | A real sports result can change searches and competition; temporarily revise the scheduler from observed demand rather than assuming it. The World Series example is a hypothetical, not a claim the Brewers won. *(inferred)* | [Packet 66](../../../.agents/team/packets/data/66-roi-depop-partner-api-and-event-effects.md) says Ben parked the event-effect estimator. This note assesses the lever; it does not restart that work. *(observed)* |
| Source's own email/push | With the person's explicit linked-account permission, a usable email event can trigger a targeted recheck instead of continuous search. *(inferred)* | Native notification timing/delivery is not a guaranteed machine-readable webhook; do not count browser push as an ingestible server event. |
| eBay events | Current [Notification Topics](https://developer.ebay.com/develop/api/buy/notification_events) includes `LISTING` CREATED/UPDATED/ENDED for the subscribed **seller**, scope `sell.listing.read`; inventory availability/price topics also exist. *(observed)* | Corrects the repo's absolute “no new-listing topic”: no marketplace-wide keyword/new-search-match topic was found. Seller events help our own connected supply, not every listing. *(inferred)* |
| secondhand-originated listing | After a real successful cross-listing confirmation, index the one physical item and evaluate matching wants immediately; notify once with live links. *(inferred; agent proposal)* | Covers only our sellers. Confirm the listing is actually buyable and honour consent/visibility and buyer ceilings. This is real supply detection, not a staged alert. |
| Paid fast tier | Charge for the incremental cost of faster **shared groups**, reflecting workload and actual delivery quality. Flipify's $5/10-minute versus $10/1-minute **per watchlist** is a price anchor. *(observed; [pricing](https://www.flipifyapp.com/))* | A paid interval does not guarantee discovery or purchase. On fresh-session browser arithmetic alone, 1 versus 5 minutes adds `$34.56/s` monthly before traffic, so a $5 uplift needs `s>6.912` just to cover that increment. *(inferred)* |
| Pooling / incremental reads | Keep busy public readers shared; reuse session setup and filter locally; charge uncertain-model judgement only on new candidates. *(inferred)* | Dedicated idle pools and personalised sessions can eliminate savings. Validate newest-first completeness and pagination before widening queries. |

Native evidence rechecked: [eBay](https://www.ebay.com/help/buying/search-tips/saved-searches?id=4051) promises new-match emails but states no numeric cadence; [Depop](https://depophelp.zendesk.com/hc/en-gb/articles/360019648117-Saved-Searches) says weekly push; [Mercari US](https://www.mercari.com/us/help_center/topics/account/guides/how-it-works/) describes saved-search updates without a timing promise. *(observed)* Poshmark's [official April 2026 blog](https://blog.poshmark.com/2026/04/06/sellerupdatesapril6/amp/) confirms saved-search work without a numeric interval; support bodies were not readable. Grailed's [archived official 2022 email](https://milled.com/grailed/save-time-by-saving-a-search-VONWFRqUylBkDZGA) offered daily/weekly emails, not proof of today's behaviour. Facebook's official help was blocked; vendors disagree about email delivery, so the prior “Facebook-only/no email” statement is unresolved. *(observed source/access limits; asserted historical offer)*

### 7. Direct answer: what is the drawback of making it an hour?

1. The person learns later. Average polling wait is 30 minutes; p95 is 57, before other delays. It cannot meet the spec's p95 10-minute target on eBay/Facebook. Even the “within the hour” promise needs allowance for indexing, failures and delivery. *(inferred)*
2. Short-lived opportunities are often lost. In the explicit 5-minute-lifetime stress test, hourly checks reach 1/12, versus all at five minutes with ideal reads. The share of real underpriced listings in that fast cohort remains unknown by site. *(inferred)*
3. An exceptional bargain is not replaceable by any later match. A month-level success metric can look healthy while the person waits days or misses the best savings. No honest dollar loss can be assigned until matched sold comps and the lifetime distribution are measured. *(inferred)*
4. The upside is concrete. Hourly uses 12× fewer checks than five minutes and 60× fewer than one minute for the same search workload. It helps paid readers, quotas and aggregate load; it saves little browser-time money when a dedicated session is left running anyway. *(inferred)*

## What changed, what to measure, and scope

Draft before research: choose five minutes for hot wants, hourly for quiet wants; a browser read is cheap and fast listings are common. The search changed that answer: the fast-tail evidence is narrower than that premise; proxy traffic and per-session rounding can exceed browser busy time; Firecrawl deterministic JSON can cost seven credits/check; affiliate revenue outside approved programs cannot be assumed. The strongest rival is hourly shared checking of ordinary stock, with immediate internal-supply events. A measured underpriced cohort with materially higher early-sale losses would justify buying speed. *(inferred)*

To resolve the optimum, record successful search visibility, first-seen and last-live intervals, confirmed sold/reserved/removed outcomes, fit/underpricing labels from actual sold comps, all bytes/billed events, group membership, delivered alert time, click, purchase and settled attribution. Follow both sold and unsold listings to avoid sold-only and survivor bias; record buyer response separately; stratify by site, category, cap and geography. Replaying those real lifetimes against all four cadences can compare capture at the same demand, rather than comparing unrelated days. No experiment was run here and no sample size is invented. *(inferred; agent proposal)*

Builds on the requested [watch spec](../../../spec/features/watch.md), [Brewers trial](brewers-alert-trial.md), [new-listing research](../nate/new-listing-detection.md), [fanout loop](fanout-and-watch-loop.md), [monitor alternatives](monitor-alternatives.md), both harness READMEs, [ROI](../../../product/roi.md), [business](../../../product/business.md), and [affiliate research](../nate/buyer-side-actions-and-affiliate.md), all read before research. The spec's “a repeat check of a quiet site costs nothing new” conflates cached processing with acquisition; its absolute eBay-topic statement is too broad. Neither file was edited. *(observed repo statements; inferred corrections)*

Search scope: six marketplaces' sale-time/first-like/first-offer data, alert vendors' speed/lifetime claims, official notification docs, terms, Browser Use/Firecrawl/Apify tariffs and Facebook reader pricing. Missing: calibrated underpriced survival on all six sites; actual current matched sold-price savings; production approvals; real transfer bills and failures at load; actual sharing, notification response, settled affiliate conversion. A limited search does not prove these data do not exist. *(observed search/access limits)*

Verification: an independent reader checked the cadence, sharing and revenue arithmetic and primary sources; corrections distinguish quiet demand from long lifetime and API-only ROI from full costs, and include the spec's flat-price monitor rival. Scoped repository link, research-header/evidence and secret checks pass for both requested files. The full `node .agents/check.mjs` fails on pre-existing missing links/headers and tests including Node 20's inability to load the repository's TypeScript; no unrelated files were repaired. *(observed)*
