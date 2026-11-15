# What market can pay for secondhand, and through which revenue streams?
Researched 2026-11-15 by Ben (Codex, GPT-6). Feature: cross-cutting.

## Answer

**Shopping referrals and reseller subscriptions are established businesses; secondhand's access, purchase frequency and net yield are still unproved.** The strongest published per-purchase anchor is eBay's category rate card. Several other marketplaces have affiliate activity, but that does not establish an open US cash commission available to this app. Count their unverified payouts as zero in a confirmed-program case and show them separately as proposals. *(inferred; program evidence below)*

**The market is large enough for a useful small business without assuming implausible national share.** The existing ROI model's 0.2 referred purchases/person/month and historical $33 order anchor imply $79,200 / $792,000 / $7.92M annual routed merchandise at 1k / 10k / 100k active people. If every order qualified at eBay fashion's 4%, that produces $3,168 / $31,680 / $316,800 annual commissions **before costs**. These are conditional arithmetic, not forecasts or proof of a viable free service. *(inferred; [existing inputs](../../../product/roi.md), official rate and historical order evidence below)*

**The present business case needs two qualifications.** Honey's revenue/user comparison mixes years, so it cannot validate our purchase frequency. And a low-priced reseller plan competes with Flyp's $9/month and Vendoo's $14.99 entry plan, not only a $39.99 crosslister. Faster alerts can be sold separately, but must cover real acquisition costs and must not promise a sale. *(inferred; evidence below)*

Evidence convention: *(observed)* means a source, tariff or filing was read; *(asserted)* means a company/vendor/secondary author claims a market size, performance or user count without independent replication; *(inferred)* means arithmetic, an explicit assumption or an agent proposal. **Every external URL below was searched and opened on 2026-11-15**, including sources read by bounded research helpers. Page publication dates, historical statistics and temporal anomalies are stated separately. No program application, attributable purchase, settled payout or customer interview ran here. *(observed)*

## Model

### Reachable demand is not all resale spending

Use four distinct quantities: merchandise sold in the overall market; people this product can serve; transactions they choose to route through us; and dollars we actually keep. A market's gross merchandise value is not affiliate revenue. A registered member is not an active buyer, and a casual seller is not a paying reseller-tool customer. *(inferred)*

For `N` monthly active people:

```text
Affiliate revenue/month
 = N × routed orders/person/month
     × sum over merchants(category mix × eligible order value × rate
                          × approved-access factor × settled-attribution factor)

Seller-plan revenue/month = N × paying reseller share × seller-plan price
Fast-alert revenue/month  = N × paying fast-alert share × fast-alert price
Studio revenue/month      = N × items/person/month × paid-studio attach × price
Studio contribution       = same paid-item count × (price − generation cost)

Total contribution = earned revenue − acquisition/processing/payment/support costs
Profit             = contribution − fixed operating costs
```

These are definitions. “Routed orders” means attributable purchases, not clicks, alerts, registered users or total marketplace orders. If modelling clicks instead, multiply by click-to-purchase conversion; do not apply conversion again after using completed routed orders. Approved access and net settlement can each reduce the headline rate to zero. Do not subtract a network cut twice from a dashboard rate already reported net. *(inferred)*

The existing [ROI note](../../../product/roi.md) and [business note](../../../product/business.md) already propose referrals, optional studio photos, a reseller plan and later permissioned anonymous market data. This note extends those streams with program gates, competitors, a faster-alert proposal and a conditional user-scale model. It does not change the free core, pricing, result ranking or product scope. *(observed repo proposals; inferred scope)*

### Inputs carried forward, with their actual status

| Input | Value used here | Status / reason |
|---|---:|---|
| Order value | $33 | Historical Poshmark **2019** average, reported in its [2020 S-1](https://www.sec.gov/Archives/edgar/data/1825480/000119312520320132/d66583ds1.htm). Not a 2026 category-specific average. *(observed)* |
| Referred orders/person/month | 0.05 / 0.2 / 0.5 | Existing conservative/base/flattering **assumptions** in [ROI](../../../product/roi.md), retained for comparison, not independently validated by Honey. *(observed repo assumptions)* |
| eBay fashion / home rate | 4% / 3% | Published [eBay Partner Network (EPN) rate card](https://secureir.ebaystatic.com/cr/v/c1/EPN/Rate%20Card.pdf); conditional on approved qualifying traffic. *(observed)* |
| Reseller-plan price and take-up | $9.99; 1% / 2% / 3% | Existing ROI **assumptions**. No willingness-to-pay evidence established here. *(observed repo assumptions)* |
| Studio | $0.99 price; $0.63 generation cost | Existing ROI price **assumption** and run-based cost calculation; price not sold to customers. *(observed repo inputs)* |
| Base studio volume | 1.5 items/person/month; 10% attach | Existing ROI **assumptions**. *(observed repo inputs)* |
| Faster-alert price | $10/month comparison | Flipify Premium's **per-watchlist** price anchor, not secondhand's chosen price or an unlimited-wants allowance. *(observed; [Flipify](https://www.flipifyapp.com/))* |
| Faster-alert take-up | variable `h` | Unknown. Tables show revenue per percentage point of take-up, not a forecast. *(inferred)* |
| Unverified marketplace affiliates; market-data sales | $0 confirmed | No approved payable contract/settled revenue established in repo or this research. Zero confirmed is not proof that no possible program exists. *(observed evidence gap; inferred case construction)* |

## Numbers

### 1. Who already earns from shopping assistance?

| Business | Evidence for how it earns and scale | What can and cannot be transferred |
|---|---|---|
| Honey / PayPal | PayPal announced approximately $4B consideration in November 2019 and [completed the purchase for approximately $4B cash on January 6, 2020](https://newsroom.paypal-corp.com/2020-01-06-PayPal-Completes-Acquisition-of-Honey). Its [2019 announcement](https://newsroom.paypal-corp.com/2019-11-20-PayPal-to-Acquire-Honey) reports about 17M monthly active users and says Honey was profitable in 2018. *(observed transaction announcement; asserted usage/profitability)* | Shopping discovery, rewards and merchant conversion can have strategic value. Purchase price is not annual revenue, profit or a valuation rule for us. *(inferred)* |
| Honey revenue | Fortune reports PayPal-supplied information describing **$100M audited 2018 revenue**; underlying audit not located. *(asserted; [2019 report](https://fortune.com/2019/11/21/paypal-honey-acquisition-worth-4-billion/))* | Revenue source proportions and current standalone earnings were not established. *(observed search gap)* |
| Capital One Shopping | Its [current disclosure](https://capitaloneshopping.com/) says eligible purchases earn commissions, potentially shared as rewards. A [Capital One engineering article, November 18, 2020](https://www.capitalone.com/tech/cloud/capital-one-shopping-cloud-native-since-day-one/), describes 30,000 partner retail sites. *(observed monetisation disclosure; asserted historical coverage)* | Replaces the prior Wikipedia citation with a primary source. Current Shopping-specific monthly active users, annual revenue and net commission yield were not found. *(observed search gap)* |
| Rakuten Rewards | [Rakuten's explainer](https://www.rakuten.com/blog/rakuten-explained-how-it-works-every-way-you-can-shop/) says stores pay it and it shares income as cashback; it claims 17M+ members and $4.6B+ cumulative US cashback. *(observed model; asserted counts)* | Members are not monthly active users; cumulative cashback is neither annual revenue nor retained margin. *(inferred)* |
| Rakuten financials | The [FY2025 release, February 12, 2026](https://global.rakuten.com/corp/news/press/2026/0212_01.html), reports $2.1B Rakuten International revenue, covering several businesses including Rewards, Kobo and Viber. *(observed)* | Do not label that $2.1B “Rakuten Rewards revenue.” No clean standalone annual Rewards number was established. *(inferred; observed gap)* |
| Klarna shopping/app/extension | Its [March 14, 2025 F-1](https://www.sec.gov/Archives/edgar/data/2003292/000162828025012824/klarnagroupplcf-1.htm) reports **$180M 2024 advertising revenue** and 32M average monthly app openers. Advertising includes affiliate programs, sponsored search and brand ads; contracts can pay for actions, clicks or campaigns. *(observed filing)* | Evidence for monetising shopping intent, not $180M of extension-only or affiliate-only revenue. Credit/payment revenue is a different business. *(inferred)* |

The prior Honey-derived monthly revenue/user figure is a **mixed-vintage calculation**, not an observed monetisation metric. Nor does converting it using secondhand's assumed commission prove purchase frequency: merchant mix, order value, sponsored revenue, cashback and attribution differ. Treat the existing purchase assumptions as assumptions until settled orders establish them. *(inferred)*

Counterweight to the flattering comparison: these businesses aggregate retail merchants willing to pay for distribution; many used-goods destinations do not publish comparable open US terms. Their scale does not prove that a free resale monitor can pay a private browser bill for every want. The [cadence note](../../watch/ben/cadence-levers.md) prices that distinction. *(inferred)*

### 2. Affiliate programs, actual rates and access gaps

The eBay [official rate card](https://secureir.ebaystatic.com/cr/v/c1/EPN/Rate%20Card.pdf) publishes the following. Amounts on a $33 eligible order are `33 × rate`, before exclusions, reversals and any separate network fee. *(observed rates; inferred amounts)*

| Category | Commission | Per-sale cap | Example earnings on $33 |
|---|---:|---:|---:|
| Fashion, clothing, shoes, accessories, jewellery/watches | 4% | $550 | $1.32 |
| Home/garden; collectibles; media | 3% | $550 | $0.99 |
| Cameras, phones, TV/audio, video games/consoles | 2% | $550 | $0.66 |
| Computers/tablets/networking | 1.5% | $550 | $0.495 |
| Business/industrial | 2.5% | $225 | $0.825 |
| Vehicle parts/accessories | 3% | $550 | $0.99 |
| eBay Motors vehicles | 4% | $100 | $1.32 |

EPN's [rate page](https://partnernetwork.ebay.com/our-program/rate-card) defines qualifying timing: Buy It Now purchase within 24 hours of click; auction bid within 24 hours then win within ten days; Best Offer within 24 hours then acceptance. Some transactions pay reduced or zero commissions. The [Buy API requirements](https://developer.ebay.com/api-docs/buy/static/buy-requirements.html) require business-model approval, compliance review and contracts for production access. A published rate is not approval for secondhand, and API access is not a guarantee of attributable paid orders. *(observed conditions; inferred consequence)*

| Destination | What was actually found | Rate available for modelling |
|---|---|---|
| Poshmark | [Official Posh Affiliate article, May 2019](https://blog.poshmark.com/posh-affiliate/), describes creator/ambassador campaigns and cash compensation; no public per-purchase schedule. Current support body could not be retrieved. *(observed historical program)* | No confirmed open cash percentage for secondhand. The prior 1 to 5% aggregator range is unverified; **$0 confirmed**, not “no affiliate activity exists.” *(inferred)* |
| Mercari US | No readable official US per-purchase cash terms found. Aggregator listings mix percentage and cost-per-click claims. *(observed search gap)* | **$0 confirmed**. A listed merchant in an affiliate aggregator is not acceptance, geography or rate confirmation. *(inferred)* |
| Mercari Japan | Its [March 4, 2024 Ambassador announcement](https://jp-news.mercari.com/info/35870) describes 2% in Mercari points, up to 1,000 points/item and 3,000 per referred buyer/month, 24-hour attribution. *(observed)* | Japan-only points are not US cash revenue. *(inferred)* |
| Depop | [Depop-authored affiliate-manager recruitment text](https://talent.octopusventures.com/companies/depop/jobs/62811970-affiliate-marketing-manager), hosted by an investor, names **Rakuten**, US/UK/Australia publishers, purchases and registrations. The job is closed; it is historical evidence of a channel, not current offer terms. *(observed)* | This qualifies the prior broad “no open direct programme” interpretation: affiliate activity exists, but a public 3% US purchase rate/acceptance was not verified. **$0 confirmed** until contracted. *(inferred)* |
| Grailed | Its [affiliate landing](https://www.grailed.com/drycleanonly/grailed-affiliate-program) and [affiliate help](https://www.grailed.com/drycleanonly/grailed-affiliate-program-faq) resolved without readable bodies. [FlexOffers' program page](https://www.flexoffers.com/affiliate-programs/grailed-affiliate-program/) advertises 8.8% new customers / 0.8% others and a 15-day cookie; other network listings disagree. *(observed access gap; asserted network offer)* | No verified current official rate for us. Do not substitute the largest aggregator rate; **$0 confirmed**. *(inferred)* |
| Etsy | [Official affiliate landing](https://www.etsy.com/affiliates) confirms application/approval and no numeric public rate. The fetched [UK policy](https://www.etsy.com/uk/legal/affiliates/) gives case-by-case rates, seven-day last-referrer attribution and requires written permission for price-comparison sites, but is **dated November 23, 2026**, after this note's cutoff. *(observed source and temporal anomaly)* | No verified 3.2% entitlement. Treat those detailed conditions as due-diligence leads, **not established November 15 terms**; obtain the applicable dated contract. Etsy also remains outside the core posting/search scope. *(inferred; [vision](../../../product/vision.md))* |
| Amazon / official retail alternative | [Official US Associates table](https://affiliate-program.amazon.com/help/node/topic/GRXPHT8U84RAYDXZ): apparel/shoes/watches/jewellery/luggage 4%; home/furniture/toys 3%; kitchen 4.5%. *(observed)* | Real published retail rates, conditional on program and channel eligibility. A different alternative can pay us, but cannot alter its ranking against used listings. *(inferred)* |
| Facebook Marketplace / OfferUp | No consumer per-purchase program established in the searched official sources or the prior [buyer-side note](../../watch/nate/buyer-side-actions-and-affiliate.md). *(observed search gap)* | **$0 confirmed**; substantial buyer benefit need not produce a referral payout. *(inferred)* |
| Skimlinks intermediary | [Official help body](https://support.skimlinks.com/hc/en-us/articles/223835508-How-much-does-Skimlinks-charge) says publisher normally receives 70%, Skimlinks 30%, and displayed Hub figures already show publisher share. Search snippets disagreed; opened body used here. *(observed)* | If a merchant actually pays 3% gross, net is `3% × 70% = 2.1%`; this is arithmetic, **not proof any named marketplace pays 3%**. Confirm the account agreement. *(inferred)* |

The rates matrix is the commercial gate, not a claim of secondhand enrolment. Before using any nonzero merchant forecast, verify app/deep-link eligibility, item/category exclusions, geography, cookie/app handoff, attribution precedence, reversal rules and a settled test transaction. These inputs change realised yield directly. *(inferred)*

### 3. Paid seller tools and paid speed: price and scale evidence

Published prices are *(observed)* offers, not verified revenue. Customer/usage claims are *(asserted)* by the vendor. Sources were opened on the research date; prices exclude any taxes and may vary with billing term.

| Product | Published price | Public audience evidence | What it benchmarks |
|---|---|---|---|
| [Vendoo pricing](https://www.vendoo.co/pricing), [home](https://vendoo.co/) | Monthly Starter $14.99, Growth $29.99, Pro $59.99; unlimited items | Main page claims **81,000+ resellers**. Its [UK page](https://www.vendoo.co/uk) still says 40,000+; definitions/dates not reconciled. Neither establishes US paid active accounts. | Seller workflow, cross-listing, sale detection and paid feature tiers. |
| [List Perfectly](https://listperfectly.com/pricing/) | Simple $29, Business $49, Pro $69, Pro Plus $99+/month | No numeric paying/active user count found on opened official pricing/home pages | Established monthly seller software; different plans include different features. |
| [Crosslist pricing](https://crosslist.com/pricing), [home](https://crosslist.com/) | Bronze $29.99/200 new listings; Silver $34.99/500; Gold $39.99/1,000; Diamond $44.99/unlimited; AI add-on $4.99/month | Claims **50,000+ sellers**; geography/paid/active definition not established | Inventory volume and optional AI can support distinct price points. |
| [Flyp](https://www.joinflyp.com/) | 100 days free, then $9/month for crosslister + sharer | Current page says “thousands”; its [free-to-paid announcement](https://resellertools.zendesk.com/hc/en-us/articles/24320182629133-We-re-going-from-Free-to-Almost-Free) reported 15,000 monthly active resellers at that transition, not a current paid count | Direct counterexample to claiming our proposed $9.99 plan is below every crosslister. |
| [Swoopa pricing](https://getswoopa.com/sign-up-swoopa/), [home](https://getswoopa.com/) | Monthly Go $47, Turbo $144, Nitro $352. Committed equivalents: Go $28 billed $336/12 months; Turbo $99 billed $594/6 months; Nitro $199 billed $1,194/6 months | Home claims **2,672 vehicle buyers** and 47-second average listing-to-app alerts. Not an independently verified subscriber/revenue count. | High-value flipper speed, not casual closet-clearer willingness to pay. |
| [Flipify](https://www.flipifyapp.com/), [help](https://www.flipifyapp.com/help) | **Per watchlist**: Basic $5/month for 10-minute checks; Premium $10 for 1-minute checks | Claims **2,000+ active users** | Direct paid-cadence benchmark. One-minute checks are not a guarantee of one-minute listing-to-phone delivery. |
| [Photoroom](https://www.photoroom.com/pricing) | Free and paid product-image plans, with enterprise arrangements; no stable localised dollar price used here | No paid resale-customer/revenue count established in this run | Paid image editing exists as a category. Its pricing is not willingness to pay for our $0.99 studio output. |

No reliable vendor revenue figures were found for the six named reseller/alert tools. Multiplying a headline member count by its cheapest plan would invent paying share, plan mix and retention. Their prices show what is offered; current paying customers and retained revenue remain separate unknowns. *(observed search gap; inferred limit)*

### 4. The market and the people inside it

| Market / population | Sourced number | What it measures / excludes |
|---|---|---|
| US secondhand apparel | **$78.8B by 2030**, sponsor forecast in [ThredUp/GlobalData's April 2, 2026 release](https://thredup.gcs-web.com/news-releases/news-release-details/thredups-14th-annual-resale-report-reveals-new-era-structural) | Future goods spending, not present annual software revenue. Includes channels beyond app-addressable marketplace supply. *(asserted)* |
| Global secondhand apparel | **$393B by 2030**, same report | Global forecast; cannot use it as the US market. The release's body confusingly describes $393B as current, but headline/report landing identify the projection. *(asserted forecast; observed wording conflict)* |
| Broader US recommerce | **$246.7B estimated for 2026; $307.7B projected 2030**, [OfferUp/GlobalData release, October 22, 2026](https://www.prnewswire.com/news-releases/secondhand-isnt-about-settling-81-of-us-shoppers-say-resale-puts-what-they-really-want-within-reach-according-to-offerups-2026-recommerce-report-302916051.html) | Broader categories including furniture, electronics, home improvement, sporting goods and auto. Apparel is a subset; do not add the two markets. Some categories are outside secondhand's scope. *(asserted)* |
| Casual US participation | OfferUp's same release says 90% bought and 51% sold secondhand in the prior year; Pollfish surveyed 1,500 US adults in August 2026 | Self-reported participation, not professional reseller counts or monthly active app users. Sponsor-funded survey, not a user census. *(asserted)* |
| Depop active sellers | **3.2M** at December 31, 2025, in [Etsy's 2025 10-K](https://www.sec.gov/Archives/edgar/data/1370637/000137063726000019/etsy-20251231.htm) | Global marketplace sellers with a sale in the trailing year, not US professional resellers or independent software subscribers. *(observed filing)* |
| Depop buyers and two-sided overlap | **7.0M active buyers** at the same date; 59% of sellers making a sale in 2025 also bought that year, same 10-K | Supports overlap between buying and selling. Does not establish that our casual seller buys through us at a particular monthly rate. *(observed filing; inferred limit)* |
| eBay active buyers | **136M excluding Depop and Tise**, [Q3 2026 release](https://investors.ebayinc.com/investor-news/press-release-details/2026/eBay-Inc--Reports-Third-Quarter-2026-Results/default.aspx) | Global marketplace activity, not US used-only buyers or alert subscribers. *(observed release)* |
| Broad deal-shopping audience | [Slickdeals advertiser page](https://getstarted.slickdeals.net/advertise-with-slickdeals) advertises **12M+ multichannel users** | Not a resale-alert census or count of people who pay for alerts. *(asserted)* |
| Paid-tool audience | Vendoo/Crosslist/Flyp/Swoopa/Flipify claims above | Partial, overlapping global vendor audiences. They cannot be added into a US reseller count. *(inferred)* |

ThredUp's research describes market modelling plus a January to February 2026 survey of 3,268 US adults and 50 brands/retailers. The methodology is inspectable, but the sponsor benefits from market-growth claims; projections are not observed future transactions. No credible deduplicated US professional-reseller count or resale deal-alert subscriber total was found. *(observed method; inferred limitation; same official release)*

The **serviceable market** is narrower: people wanting supported, lawful goods from supported US destinations, able to link accounts when needed, and with supply we can reliably access. Restricted categories, cars, unsupported sites, unusable marketplace permissions and offline spending reduce the broader total. No sourced percentage divides that total into secondhand's reachable share, so this note does not invent a serviceable-market dollar number. *(inferred; [existing scope](../../../product/business.md))*

### 5. Our share at 1k, 10k and 100k people

#### Affiliate merchandise and revenue

Hold the existing base assumptions at 0.2 attributable purchases/person/month and $33/order; use one **eligible fashion** rate of 4% to make the arithmetic visible. This is the optimistic approved-eBay illustration, not a blended rate over six sites. Every value below is *(inferred)*.

| Monthly active people | Routed orders/month | Routed merchandise/year | Affiliate revenue/month | Affiliate revenue/year |
|---:|---:|---:|---:|---:|
| 1,000 | 200 | $79,200 | $264 | $3,168 |
| 10,000 | 2,000 | $792,000 | $2,640 | $31,680 |
| 100,000 | 20,000 | $7,920,000 | $26,400 | $316,800 |

Arithmetic: `orders=N×0.2`; `annual merchandise=orders×33×12`; `commission=merchandise×4%`. Relative to OfferUp's **2026** broader estimate, that annual merchandise is **0.0000321% / 0.000321% / 0.00321%**, respectively. This is an order-of-magnitude comparison, not a claim those auto-inclusive national transactions are all eligible or within scope. *(inferred)*

For an apparel-only comparison, the same merchandise would equal **0.0001005% / 0.001005% / 0.01005%** of the **2030 projected** $78.8B market. This deliberately names the mismatched future denominator; it is not current share. *(inferred)*

At 1k / 10k / 100k users, the counts are **0.0143% / 0.143% / 1.43%** of Depop's 7M global annual active buyers. This shows scale, not actual penetration: our monthly US audience is a different population, may use several sites, and is not necessarily drawn from Depop. At 100k people we would also exceed any one small alert vendor's reported audience; a small national percentage does not make acquisition automatic. *(inferred)*

Purchase frequency and rate both matter. Each cell below gives monthly affiliate revenue at **0.05 / 0.2 / 0.5** routed orders/person, using the same historical $33 basket and approved 4% fashion rate. They are source-carried scenarios, not estimated probabilities. *(inferred)*

| People | Low frequency | Base frequency | Flattering frequency |
|---:|---:|---:|---:|
| 1k | $66 | $264 | $660 |
| 10k | $660 | $2,640 | $6,600 |
| 100k | $6,600 | $26,400 | $66,000 |

If the actual rate is 3%, multiply by `3/4`; at 1.5%, by `1.5/4`; multiply again by actual eligible merchant share and settled attribution. If no purchases earn payable commission, the result is zero at any user scale. The old 2.8% blend is a modelling assumption, not a verified cross-market rate. *(inferred)*

#### Plans, faster alerts and studio

These are **independent stream illustrations**, not additive forecasts. A reseller subscription may already include speed/studio; do not bill the same entitlement twice in the model. Subscription take-up is not established by a competitor's advertised price. *(inferred)*

| Stream / input | 1k active people | 10k | 100k |
|---|---:|---:|---:|
| Seller plan, existing base 2% × $9.99/month | 20 payers; $199.80/month | 200; $1,998 | 2,000; $19,980 |
| Seller plan sensitivity, existing 1 to 3% take-up | $99.90 to $299.70/month | $999 to $2,997 | $9,990 to $29,970 |
| Faster alerts, **per one percentage point** of people paying $10/month | 10 payers; $100/month | 100; $1,000 | 1,000; $10,000 |
| Studio, existing base 1.5 items × 10% attach × $0.99 | 150 paid items; $148.50/month | 1,500; $1,485 | 15,000; $14,850 |
| Studio contribution at $0.63/item generation cost | $54/month | $540 | $5,400 |
| Anonymous market data | $0 contracted revenue established | $0 | $0 |

All cells are *(inferred)*: seller revenue `N×take-up×9.99`; fast revenue `N×0.01×10` per percentage point; studio revenue `N×1.5×0.10×0.99`, generation contribution `N×1.5×0.10×(0.99−0.63)`. These exclude payment fees, refunds, support, infrastructure and sales costs. The 1% fast-alert unit is a normalisation, not an assertion of take-up. *(inferred)*

An inspectable **combined base illustration**, only if seller-plan and studio charges are independent and all base orders earn 4%, is `$0.264 + $0.1998 + $0.1485 = $0.6123 revenue/person/month`. Subtracting the existing ROI base cost of `$0.689` gives about **−$0.0767/person/month**, before its separate $1,500/month fixed-cost assumption. Changing only affiliate eligibility does not establish profitability. This reuses that note's rounded cost, does not re-estimate seller-side Depop sweeps, and does not add the new buyer-watch cost twice; any buyer-watch cost missing from that model must still be added from the cadence note. *(inferred; [ROI base](../../../product/roi.md))*

At 1k / 10k / 100k people that combined illustration gives about **$612 / $6,123 / $61,230 monthly revenue** and **−$1,577 / −$2,267 / −$9,170 monthly profit** after the same fixed cost. Rounding in the carried cost prevents more precise interpretation. A dollar of new approved commission or plan revenue helps only if the marginal service cost it induces is lower. *(inferred)*

**What “realistic” means here:** these scale cases are numerically modest against national merchandise spending, but no retention, acquisition-cost, payable-order or take-up cohort establishes that secondhand can obtain them. The credible range includes zero revenue. The useful favourable case is “people route purchases at a rate already contemplated in our model, and qualifying fashion orders pay the published rate,” with every condition visible. It is not a claim of a forecasted national share. *(inferred)*

### 6. Each stream's opportunity and drawback

| Stream | Existing earner / market | Value secondhand can sell | What prevents treating it as free money |
|---|---|---|---|
| Buy-side purchase referrals, existing proposal | Honey, Capital One Shopping, Rakuten; eBay and retail rate schedules above | Buyer discovery that leads to a genuine chosen purchase; merchandise and user-scale tables above | Approval, thin used-goods merchant coverage, cancellations, last-click loss, app handoff and paid acquisition costs. Click volume alone does not earn a purchase commission. *(inferred)* |
| Seller subscription, existing proposal | Vendoo, List Perfectly, Crosslist, Flyp | Time saved for a frequent seller, reliable inventory/sold-state management | Casual closet clearers may not renew; existing $9.99 is not cheapest. Paid-service costs and retention must fit that price. No vendor's actual subscription revenue was established. *(inferred)* |
| Faster-alert tier, new proposal requested for evaluation | Flipify, Swoopa | Earlier access to a relevant scarce listing, with honestly measured discovery/delivery | Faster polling can cost more than the fee; competition means an alert need not win. Supported search groups/site access constrain service. *(inferred)* |
| Paid studio, existing proposal | Product-image software such as Photoroom; Crosslist's $4.99 AI add-on is a bundle, not a studio-only sale | Optional usable images, priced separately from the free listing path | The existing $0.36 generation contribution/item is `0.99−0.63`, before fees/refunds/support. Quality and fidelity decide take-up; no observed customer price test. *(inferred)* |
| Permissioned anonymous market data, existing later proposal | eBay offers seller Product Research; its existence shows demand for price/supply information, not permission for us to resell its data | Rights-cleared aggregate sell-through and price insights from consenting supply | Consent does not override source contracts. Existing [vision](../../../product/vision.md) records API resale/aggregation restrictions. No buyer contract, rate or serviceable data-market size established: model zero. *(inferred)* |
| Sponsored discovery / merchant leads, additional agent proposal | Klarna's filing establishes sponsored search/brand advertising and affiliate action models | A separately labelled offer or relevant approved service referral | Would need an advertiser, measurable incremental action and explicit product agreement. Keep paid placement out of organic “best” ranking. No secondhand price per ad impression/click or revenue estimate established. *(inferred)* |
| Selling the workflow to partners, additional agent proposal | [ThredUp's release](https://thredup.gcs-web.com/news-releases/news-release-details/thredups-14th-annual-resale-report-reveals-new-era-structural) describes Resale-as-a-Service; Photoroom lists enterprise/API offerings | A rights-cleared workflow for organisations with recurring inventory | Different buyer, integration, support and contracting; not established by consumer signup counts. No comparable contract price/revenue found: zero in current model. *(inferred)* |
| Transaction/success fee or consignment, alternative already considered in business.md | Marketplaces/consignment charge for transaction services; Poshmark's [fee policy](https://www.poshmark.com/terms#fee-policy) publishes $2.95 under $15 and 20% from $15 | A service might charge if it adds enough proceeds or handles real transaction work | A second fee reduces seller proceeds and conflicts with the proposed free core. Current product links out and handles no marketplace payment; no authority to charge, and no such revenue counted. *(observed policy; inferred product tradeoff)* |

Keep the buying-side watcher separate from seller sold-state monitoring. Depop partner seller webhooks might reduce the latter's sweep cost, but that does not supply a marketplace-wide buyer new-listing feed or remove buyer monitoring costs. Joining a partner program remains a proposal, not an accomplished integration. *(inferred; [current ROI status](../../../product/roi.md), [cadence model](../../watch/ben/cadence-levers.md))*

### 7. Honey's 2024 to 2025 controversy and attribution we should keep

The public controversy began with MegaLag's December 2024 investigation. The creators' case alleges Honey replaced earlier affiliate attribution when users interacted with its checkout prompts, redirecting commission to Honey even though the creator supplied the buying intent. Cohen Milstein's [case page](https://www.cohenmilstein.com/case-study/in-re-paypal-honey-browser-extension-litigation/) describes the alleged mechanism and January 15, 2025 filing. These are **plaintiffs' allegations**, not findings of liability. *(asserted)*

The [June 22, 2026 court order](https://law.justia.com/cases/federal/district-courts/california/candce/5:2024cv09470/441974/277/) denies dismissal of the second amended complaint; it also records the consolidated case beginning December 29, 2024. Denial of dismissal does not decide whether Honey ultimately violated the law. The January complaint PDF linked in earlier research was not consistently retrievable in this run, so the court order and counsel's case page are the readable evidence used here. *(observed procedural record/access limitation; inferred distinction)*

Google's [March 11, 2025 affiliate policy](https://developer.chrome.com/docs/webstore/program-policies/affiliate-ads) and [announcement](https://developer.chrome.com/blog/cws-policy-update-affiliate-ads-2025) require prominent disclosure, related user action before each inclusion of an affiliate link/code/cookie, and a direct, transparent benefit. Enforcement began June 10, 2025. This is a Chrome extension rule; it is not evidence of every merchant's app attribution contract or automatic compliance by a mobile app. *(observed policy; inferred scope)*

For secondhand, an inspectable attribution contract would be: *(inferred; agent proposal, reinforcing the existing ranking rule)*

1. Add tracking only when the person deliberately opens a result we supplied; disclose that qualifying purchases may pay us. No background cookie setting, checkout interception or silent replacement of someone else's code.
2. Preserve incoming affiliate URLs and shared creator links. An explicit request to inspect a pasted listing is not permission to claim its acquisition credit.
3. Keep revenue fields out of organic ranking, as the existing business/spec requires; show any sponsored offer separately if that proposal is ever approved.
4. Record originating result, deliberate click, destination and network sub-ID, then reconcile with settled order reports. Store only the data needed with the person's permission; do not log account secrets or private checkout details.
5. Test browser-to-app handoff, prior referrer, later referrer, cancelled order and repeat purchase paths against the applicable merchant contract. Merchant-defined last-click replacement can also remove **our** attribution; price that in `z` rather than assuming every click earns.

The good transferable mechanism is **earning for discovery the person chose**. Cookie replacement is not needed to make that model work. Whether secondhand supplies enough incremental discovery to fund free monitoring remains an empirical question. *(inferred)*

## What changed and what remains unknown

Draft before searching: affiliate revenue can fund the casual free user, with reseller subscriptions and photos adding margin; Honey is evidence for the assumed purchase rate. Findings changed the last part and weakened the first: Honey establishes a shopping business, not our conversion; merchant availability is uneven; Flyp is cheaper than the proposed reseller plan; paid speed is a real category, but often charged per watchlist or at flipper-level prices. The strongest contrary case is an excellent buyer tool whose destinations pay nothing and whose watch traffic costs real money. *(inferred)*

Before assigning forecast probabilities, measure a cohort's retained active users, routed qualifying orders, settled commission by merchant/category, search-group sharing, buyer-watch bill, seller-side bill, paid attach and churn. Obtain actual merchant and partner agreements, with channel permissions and dated terms. Those observations can turn the tables into a forecast without guessing an arbitrary share of a large market. *(inferred; agent proposal)*

Source roles: company tariffs and affiliate contracts are **pricing/access evidence**; US Securities and Exchange Commission filings are **historical financial/population evidence**; ThredUp/OfferUp reports are **sponsored market-sizing evidence**, not conversion forecasts; reseller/alert pages are **competitive offer evidence**, not audited sales; the court record and Chrome rules are **attribution-risk evidence**. No competitor implementation or code was reused. *(inferred)*

Read first and preserved: [ROI](../../../product/roi.md), [business](../../../product/business.md), [Nate's buyer-side/affiliate note](../../watch/nate/buyer-side-actions-and-affiliate.md), and the requested watch/harness sources documented in [cadence-levers](../../watch/ben/cadence-levers.md). Material differences are called out here, not silently written into those files. Only the two requested notes are included in this change. *(observed)*

Search scope: official acquisitions, filings, shopping-business monetisation disclosures, affiliate schedules/program pages, named reseller and alert tools, US apparel/broader recommerce reports, user-count definitions and the Honey court/policy record. Could not establish: current standalone Honey/Capital One Shopping/Rakuten Rewards earnings; paid/active/US customer counts for most named tools; deduplicated US reseller or resale-alert audiences; historical Etsy affiliate terms at the cutoff; several marketplace payout contracts; current category average order value and savings; secondhand acquisition, retention, settled yield or willingness to pay. A limited search does not prove no such data or commercial agreement exists. *(observed search/access limits)*

Verification: independent arithmetic and primary-source spot checks passed. Both requested files pass scoped link, research-header/evidence and secret checks. The full repository check fails on existing unrelated link/header errors and test/runtime failures; those were left unchanged. *(observed)*
