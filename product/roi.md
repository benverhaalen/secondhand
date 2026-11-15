# What it costs, what it earns, and where it breaks even

Ben, 08:09: "look at our costs and estimate an roi for everything at scale... explain our revenue streams. like the referral links too... use hypotheticals backed in research but research that flatters us but it honest and inspectable" ([words](words.md#2026-11-15-quantify-every-feature-with-why-the-review-step-and-roi)). *Agent proposal*. Nothing here has been billed or earned yet.

The model is code, not a spreadsheet: [scripts/bench/roi.mjs](../scripts/bench/roi.mjs). Every input carries its source and a mark (observed, asserted, inferred, assumption). Change one and run `node scripts/bench/roi.mjs`; the tests in `roi.test.mjs` check the arithmetic adds up. The numbers below are its output on 2026-11-15.

## The answer first

1. **One referred purchase earns about $0.71 from programmes we can verify, $0.94 if the unverified ones pay.** That is a $33 order (Poshmark's own 2019 average, *observed* in its S-1) at eBay's category rates (fashion 4%, home 3%, electronics 2%, weighted 60/25/15 to 3.45%) for the 45% that go to eBay and Amazon's 4% for the 15% that go to retail. Poshmark, Depop, Mercari and Etsy count as zero until a programme a new app can join is verified ([affiliate research](../research/cross-cutting/ben/affiliate-economics.md#answer): "Working 0"). Every rate is after approval, which we don't have yet.
2. **Free does not pay today, and two levers each make it pay.** The base case loses $0.25 per person per month. The signed-in Depop sweep is $0.45 of that cost. Checking Depop every 2 hours while live instead of every 15 minutes ([cadence](cadence.md)) turns the base case to +$0.15 a person a month; Depop's partner API, which we propose and have not joined, turns it to +$0.20.
3. **The purchase rate is an assumption, with one real anchor.** A Poshmark buyer made 6.3 orders a year in 2019 (*asserted*, a write-up of the S-1), which is 0.525 a month, so the flattering case, 0.5 a month, is "as often as a Poshmark buyer already buys on Poshmark". That is what a buyer does, not what they would send through us. *Corrected 2026-11-15:* this line used to call Honey a second, independent anchor (about $0.49 per monthly user per month, so 0.52 of our purchases). The [market research](../research/cross-cutting/ben/revenue-market.md#1-who-already-earns-from-shopping-assistance) shows that figure divides 2018 revenue by the user count PayPal gave in 2019 and counts all of Honey's revenue, so it shows the business is real and checks nothing about our rate. Only settled orders will.
4. **What we run today, and what we propose.** Today Depop is watched by the signed-in sweep every 15 minutes while live (Ben's choice, 08:32). We are not in Depop's partner programme and have not applied. *Proposed:* the check schedule in [cadence.md](cadence.md), hot 15 minutes, live 2 hours, quiet 4 hours, and joining the partner programme. The cost of the slower schedule: a second buyer pays for an item already sold in about 6.4 of every 1,000 Depop sales, against about 1.0 at 15 minutes (*inferred* in that model, from *assumed* times for the copies on the other sites to sell: eBay 90 days, Poshmark and Mercari 30, Facebook 14). Each one is a refund and a cancellation on the seller's record.

## Revenue streams

| Stream | How it pays | Rate and source | Counted? |
|---|---|---|---|
| Buy-side referral, eBay | eBay Partner Network pays a share of the sale when a buyer we sent buys within 24 hours of the click | Fashion 4.0%, Home and Collectibles 3.0%, electronics 2.0% (computers 1.5%), cap $550 a sale (*observed*, EPN rate card PDF) | yes |
| Buy-side referral, Poshmark, Depop, Mercari | No programme a new app is known to be able to join. Posh Affiliate pays creators by campaign; Depop's Rakuten campaigns sit behind a login; Mercari's is Japan-only and pays points ([affiliate research](../research/cross-cutting/ben/affiliate-economics.md#answer), *observed*) | 0 confirmed. Flattering case only: 3% through a network that keeps 30% (*assumption*, a negotiation test) | 0, except flattering at 2.1% |
| Buy-side referral, retail and Amazon | The better official option (refurbished, new) shown beside a used result | Amazon apparel 4%, home 3% (*asserted*, a third-party reading of the Associates table) | yes |
| Buy-side referral, Etsy | Etsy's programme runs through Rakuten; app approval unproved | "case-by-case" (*observed*); 7 days for an app sale, 30 for web (*observed*, Etsy help); 3.2% (*asserted*, third party) | 0, except flattering at 3.2% |
| Facebook Marketplace | None | no programme found (*observed* absence in [buyer-side research](../research/watch/nate/buyer-side-actions-and-affiliate.md)) | 0 |
| Studio photos | The one paid extra | $0.99 an item (*assumption*); our cost up to $0.96, so as little as $0.03 margin | yes |
| A plan for resellers | Flat monthly, under the crosslisters | $9.99 a month (*assumption*). It competes with Flyp at $9 and Vendoo Starter at $14.99 (*observed*, pricing pages, [market research §2](../research/cross-cutting/ben/revenue-market.md)), so it is not the cheapest | yes |
| Market data | Anonymous, from consenting sellers and sources whose terms allow it | not priced | no, later |

The rule that keeps referrals honest: the order of results is computed with every referral field removed ([buy.ts](../app/src/edge/buy/buy.ts)). A referral can pay us; it can never move a listing up.

### How Honey and Capital One Shopping earn, and why we differ

| | Honey | Capital One Shopping | secondhand |
|---|---|---|---|
| Money | affiliate commissions, 0.5% to 10% (*asserted*, Honey via productmint and Seeking Alpha) | affiliate commissions across 30,000+ retailers (*observed*, Wikipedia) | the same commissions, only on purchases the person chose |
| Scale | ~17M monthly users (PayPal, 2019, *asserted*); ~$100M revenue in 2018 (Fortune, PayPal-supplied, *asserted*); bought by PayPal for about $4B cash, completed 2020-01-06 (*observed*, PayPal newsroom) | 30,000 partner sites (Capital One engineering post, 2020, *asserted*); revenue and users not published | 0 today |
| What hurt them | class actions alleging the extensions replaced creators' affiliate links at checkout (*asserted*: suit titles seen in search results, classaction.org and the Oganesyan v. Capital One complaint, 2025; not read in full) | the same | we never touch a link we did not create, and never inject at checkout. The person clicks our link from our search |

The lesson we take: shopping help is a real business (Honey earned about $100M in 2018 and sold for $4B), but its revenue per user mixes years and includes more than commissions, so it does not price us. The way to lose trust is to take credit you did not earn: in June 2026 a federal court let the creators' case against Honey go forward (*observed*, the order; no ruling on the merits).

## The market

From the [market research](../research/cross-cutting/ben/revenue-market.md#4-the-market-and-the-people-inside-it), read 2026-11-15:

| Market | Size | What it is not |
|---|---|---|
| US secondhand apparel | $78.8B by 2030 (ThredUp and GlobalData, *asserted*, sponsor forecast) | software revenue; it is goods sold |
| Broader US recommerce | $246.7B in 2026, $307.7B by 2030 (OfferUp and GlobalData, *asserted*) | additive with apparel; apparel is inside it |
| Depop | 3.2M active sellers, 7.0M active buyers, 59% of sellers also bought (Etsy 10-K for 2025, *observed*) | US resellers who would pay for tools |
| eBay | 136M active buyers (Q3 2026, *observed*) | used-only or US-only |

What our users route is the market that matters, and it is small: at 0.2 purchases a month and $33 an order, 1,000 people send $79,200 of goods a year, and at eBay fashion's 4% that is $3,168 of commission before costs; 100,000 people send $7.9M and earn $316,800. A program we have not been approved for counts as zero there.

## Why companies pay for affiliate links

From the [affiliate research](../research/cross-cutting/ben/affiliate-economics.md#part-1-the-advertisers-economics), read 2026-11-15.

1. **They pay only when something sells.** A 4% commission on a $33 order is $1.32, owed only after the sale (*observed*, eBay's rate card). Paid search and social are paid for attention whether or not anyone buys. Retail Google Search spends about 20% of each attributed sales dollar, and Meta about 39% (*asserted*, one agency's 2026 accounts). Those are retailers' numbers, so they don't transfer to a marketplace, which earns only its fee.
2. **What they really buy is the sale that wouldn't have happened.** If only a quarter of credited orders are new, that 4% costs $5.28 per extra order ($1.32 ÷ 0.25, *inferred*; the quarter is an *assumption*). eBay's own experiment found brand search ads earned almost nothing extra, because buyers came anyway (Blake, Nosko and Tadelis 2015, *observed*). So advertisers pay less for buyers who were coming anyway: ThredUp pays 15% for a new customer and 1% for a returning one; Grailed 8.8% and 0.8% (ThredUp *observed*, Grailed *asserted*).
3. **The last click usually wins, inside a short window.** eBay counts a Buy It Now purchase within 24 hours of the click; Amazon 24 hours; Etsy 7 days in the app and 30 on the web (*observed*). A later affiliate click can take the credit. That is exactly what Honey is accused of doing to creators.
4. **A marketplace can only afford a slice of its own fee.** Its ceiling per referred order is about its take rate × the share of the order that is new demand. eBay's sales and marketing spend is 3.2% of all its sales (Q3 2026 filing, *observed*), and its fashion rate is 4%.

**What that means for us.** eBay is the one programme a new app can apply to with published rates, and it still needs separate written approval for a mobile app. The others count as zero until one says yes. The rate rises if we can show three things: buyers who were new to that marketplace, a holdout test where the advertiser can see the orders we added, and settled orders that don't get returned. A search that shows someone an item they didn't know about is worth more to the marketplace than a link pasted after the buyer already chose. So the honest pitch to a marketplace is new buyers, not clicks.

## Costs

| Cost | Per | Amount | Source |
|---|---|---|---|
| Identify an item | item | $0.035 (range $0.015 to $0.06) | [numbers](numbers.md#what-it-costs-us), *inferred* |
| Post to 4 sites and take down after the sale | item | $0.015 | same |
| Studio, as built | item that asks for it | up to $0.96: 2 slides × (4 Nano Banana 2.1 seeds at $0.037 + 1 Gemini 3 Pro Image at $0.14) + 10 judge reads at ~$0.005 = $0.63, then a second pressing of the 2 smoothest redraws × 2 seeds on each relay slide, 8 renders and 8 reads, $0.34 | run log (*observed*, [slides note](../research/studio/ben/slides.md)), code (*observed*, `STEAM_TOP` in [slides_run.py](../jobs/studio/slides_run.py)), judge (*assumption*) |
| Watching for sales, eBay, Facebook, Poshmark, Mercari | account-day | ~$0 | eBay pushes; we booked the pickup; a public page read is one 0.44 s request ([trace sd-1](../research/cross-cutting/nate/runs/sd-1.md)) |
| Watching for sales, Depop, signed in | account-day while live | $0.10 | [numbers](numbers.md#what-it-costs-us), *inferred* |
| A buy search | search | $0.01 | *inferred* from one web search |
| The platform | month | $1,500 fixed plus $0.02 a person | *assumption*; replace with the first bill |

Note on the studio: [numbers.md](numbers.md#what-it-costs-us) says about $0.25 for studio light. That figure is 3 Seedream relights; the run as built (Ben kept Nano Banana at 08:33) makes 10 candidates for 2 slides, which is $0.63, and the second pressing adds up to $0.34. At $0.99 that leaves $0.03 an item in the upper case, so the price or the recipe has to move before studio earns anything. Dropping the Gemini 3 Pro second opinion saves $0.28.

## Per person per month

Every bound below has its reason in the [affiliate research, Part 2](../research/cross-cutting/ben/affiliate-economics.md#part-2-reasons-for-the-money-model-bounds). Most of them are tests, not measurements: no app cohort exists yet, and the research says so for each.

| | conservative | base | flattering | Why these bounds |
|---|---|---|---|---|
| Referred purchases | 0.05 | 0.2 | 0.5 | Measured against a Poshmark buyer's 0.525 a month (6.3 a year, S-1): conservative is 9.5% of that, base 38%, flattering 95%. Zero is possible |
| Items listed | 1.0 | 1.5 | 2.0 | A 36-item closet cleared over 36, 24 or 18 months. Both the 36 and the months are *assumption*; no crosslister publishes listings per user |
| Studio attach / plan share | 5% / 1% | 10% / 2% | 15% / 3% | No measured photo-upgrade rate exists. Plan share is set near freemium apps' 2.1% median download-to-paid (RevenueCat 2026, *asserted*), which is not the same measure |
| Programmes counted | verified only | verified only | plus Poshmark, Depop, Mercari, Etsy | Unverified programmes are a negotiation test, not income |
| Depop | sweep, 15 min (today) | sweep, 15 min (today) | partner API (proposed, not joined) | Today's setting, and the proposal |
| **Revenue** | $0.185 | $0.490 | $1.06 | |
| of which referrals | $0.036 | $0.142 | $0.468 | |
| **Cost** | $0.748 | $0.739 | $0.489 | |
| of which Depop watching | $0.600 | $0.450 | $0 | |
| **Margin** | −$0.56 | −$0.25 | +$0.58 | |
| Purchases a month to break even | 0.84 | 0.55 | 0 | |

At scale, after the fixed platform cost, per year:

| Monthly users | conservative | base | base, Depop checked every 2 h while live (proposed) | base with Depop's partner API (proposed) | flattering (proposed API) |
|---|---|---|---|---|---|
| 10,000 | −$86k | −$48k | −$1k | +$6k | +$51k |
| 100,000 | −$694k | −$317k | +$156k | +$223k | +$674k |
| 1,000,000 | −$6.8M | −$3.0M | +$1.7M | +$2.4M | +$6.9M |

The $1,500 a month platform cost has no bill behind it and no honest narrower range yet; the research says to cost the deployment and then replace it with the first invoice.

**What flatters us, and why it's still honest.** The $33 order value is Poshmark's, and many of our purchases go to eBay, where order values are higher, so commission per purchase is likely understated. The flattering purchase rate is the rate Poshmark buyers already showed. What cuts against us: buyers who already know where to shop won't route through us, every programme can refuse a new app, a later affiliate click can take the credit, and eBay requires approval before production Buy API access ([buyer-side research](../research/watch/nate/buyer-side-actions-and-affiliate.md) §1).

## What the person gets, the other side of ROI

`sellerValue()` in the same script, the buyer paying $6 shipping, no tax:

| Item price | Best site keeps | Worst site keeps | Picking the site is worth | Against consignment (keeps 85%) |
|---|---|---|---|---|
| $20 | $18.69 (Depop) | $16.00 (Poshmark) | $2.69 | +$15.69 |
| $33 | $31.26 (Depop) | $26.40 (Poshmark) | $4.86 | +$26.31 |
| $100 | $96.05 (Depop) | $80.00 (Poshmark) | $16.05 | +$81.05 |

The fee is never the only reason: who buys there matters more ([feature breakdown §4](feature-breakdown.md#4-fees-and-where-to-sell)).

## Sources

All in the `source` field of each input in [roi.mjs](../scripts/bench/roi.mjs). The pages behind them, read 2026-11-15: Poshmark S-1 (sec.gov, filed 2020-12-17); eBay Partner Network rate card and its PDF; Skimlinks support "How much does Skimlinks charge"; Etsy affiliate terms (updated 2026-11-23 per the page); getlasso.co on Amazon and Etsy (third party); productmint.com, seekingalpha.com and a Substack on Honey (third party); Wikipedia on Capital One Shopping; search-result titles for the Capital One Shopping suit (not read in full); Value Investors Club on Poshmark (third party). Impact.com's 2025 benchmark gives only year-on-year change in affiliate conversion (−6%) and a $123 all-retail order value, too broad to use for secondhand.
