# What it costs, what it earns, and where it breaks even

Ben, 08:09: "look at our costs and estimate an roi for everything at scale... explain our revenue streams. like the referral links too... use hypotheticals backed in research but research that flatters us but it honest and inspectable" ([words](words.md#2026-11-15-quantify-every-feature-with-why-the-review-step-and-roi)). *Agent proposal*. Nothing here has been billed or earned yet.

The model is code, not a spreadsheet: [scripts/bench/roi.mjs](../scripts/bench/roi.mjs). Every input carries its source and a mark (observed, asserted, inferred, assumption). Change one and run `node scripts/bench/roi.mjs`; the tests in `roi.test.mjs` check the arithmetic adds up. The numbers below are its output on 2026-11-15.

## The answer first

1. **One referred purchase earns about $0.94.** That is a $33 order (Poshmark's own 2019 average, *observed* in its S-1) times a blended 2.8% commission, after a network's cut where a site has no direct programme.
2. **Free works if a person buys through us about once every three months, and Depop watching is designed down.** The base case loses $0.15 per person per month, and the whole loss is Depop: a signed-in sweep costs about $0.45 per person per month. With Depop's partner API (webhooks, no sweep), which we propose and have not joined, the same base case would earn $0.30 per person per month, about $3.5M a year at 1M monthly users.
3. **The purchase rate is an assumption, with one real anchor.** A Poshmark buyer made 6.3 orders a year in 2019 (*asserted*, a write-up of the S-1), which is 0.525 a month, so the flattering case, 0.5 a month, is "as often as a Poshmark buyer already buys on Poshmark". That is what a buyer does, not what they would send through us. *Corrected 2026-11-15:* this line used to call Honey a second, independent anchor (about $0.49 per monthly user per month, so 0.52 of our purchases). The [market research](../research/cross-cutting/ben/revenue-market.md#1-who-already-earns-from-shopping-assistance) shows that figure divides 2018 revenue by the user count PayPal gave in 2019 and counts all of Honey's revenue, so it shows the business is real and checks nothing about our rate. Only settled orders will.
4. **What we run today, and what we propose.** Today Depop is watched by the signed-in sweep (Ben's choice, 08:32). We are not in Depop's partner programme and have not applied. *Proposed:* join it, because its webhooks would replace the sweep and flip the base case to +$0.30 per person per month. Until then the lever is the sweep's cadence: every 23 minutes instead of 15 while live brings Depop watching to about $0.30 a person a month and the base case to break-even.

## Revenue streams

| Stream | How it pays | Rate and source | Counted? |
|---|---|---|---|
| Buy-side referral, eBay | eBay Partner Network pays a share of the sale when a buyer we sent buys within 24 hours of the click | Fashion 4.0%, Home and Collectibles 3.0%, electronics 2.0% (computers 1.5%), cap $550 a sale (*observed*, EPN rate card PDF) | yes |
| Buy-side referral, Poshmark, Depop, Mercari | No open direct programme; a network (Skimlinks-type) pays where the merchant runs one | merchant rate 3% (*assumption*, aggregators list Depop 0 to 7% and Poshmark 1 to 5%); the network keeps 30% (*observed*, Skimlinks support: "you receive 70%") | yes, at 2.1% |
| Buy-side referral, retail and Amazon | The better official option (refurbished, new) shown beside a used result | Amazon apparel 4%, home 3% (*asserted*, a third-party reading of the Associates table) | yes |
| Buy-side referral, Etsy | Etsy's programme runs through Rakuten | "case-by-case", 7-day cookie (*observed*, Etsy's terms); 3.2% (*asserted*, third party) | yes |
| Facebook Marketplace | None | no programme found (*observed* absence in [buyer-side research](../research/watch/nate/buyer-side-actions-and-affiliate.md)) | 0 |
| Studio photos | The one paid extra | $0.99 an item (*assumption*); our cost $0.63, so $0.36 margin | yes |
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

## Costs

| Cost | Per | Amount | Source |
|---|---|---|---|
| Identify an item | item | $0.035 (range $0.015 to $0.06) | [numbers](numbers.md#what-it-costs-us), *inferred* |
| Post to 4 sites and take down after the sale | item | $0.015 | same |
| Studio, as built | item that asks for it | $0.63: 2 slides × (4 Nano Banana 2.1 seeds at $0.037 + 1 Gemini 3 Pro Image at $0.14) + 10 judge reads at ~$0.005 | run log (*observed*, [slides note](../research/studio/ben/slides.md)), judge (*assumption*) |
| Watching for sales, eBay, Facebook, Poshmark, Mercari | account-day | ~$0 | eBay pushes; we booked the pickup; a public page read is one 0.44 s request ([trace sd-1](../research/cross-cutting/nate/runs/sd-1.md)) |
| Watching for sales, Depop, signed in | account-day while live | $0.10 | [numbers](numbers.md#what-it-costs-us), *inferred* |
| A buy search | search | $0.01 | *inferred* from one web search |
| The platform | month | $1,500 fixed plus $0.02 a person | *assumption*; replace with the first bill |

Note on the studio: [numbers.md](numbers.md#what-it-costs-us) says about $0.25 for studio light. That figure is 3 Seedream relights; the run as built (Ben kept Nano Banana at 08:33) makes 10 candidates for 2 slides, which is $0.63. Dropping the Gemini 3 Pro second opinion takes it to $0.35.

## Per person per month

| | conservative | base | flattering |
|---|---|---|---|
| Referred purchases | 0.05 | 0.2 | 0.5 |
| Items listed | 1.0 | 1.5 | 2.0 |
| Studio attach / plan share | 5% / 1% | 10% / 2% | 15% / 3% |
| Depop | signed-in sweep (today) | signed-in sweep (today) | partner API (proposed, not joined) |
| **Revenue** | $0.196 | $0.536 | $1.06 |
| of which referrals | $0.047 | $0.187 | $0.468 |
| **Cost** | $0.731 | $0.689 | $0.388 |
| of which Depop watching | $0.600 | $0.450 | $0 |
| **Margin** | −$0.54 | −$0.15 | +$0.68 |
| Purchases a month to break even | 0.62 | 0.36 | 0 |

At scale, after the fixed platform cost, per year:

| Monthly users | conservative | base | base with Depop's partner API (proposed) | flattering (proposed API) |
|---|---|---|---|---|
| 10,000 | −$82k | −$36k | +$18k | +$63k |
| 100,000 | −$660k | −$202k | +$338k | +$795k |
| 1,000,000 | −$6.4M | −$1.9M | +$3.5M | +$8.1M |

**What flatters us, and why it's still honest.** The $33 order value is Poshmark's, and many of our purchases go to eBay, where order values are higher, so commission per purchase is likely understated. The flattering purchase rate is the rate Poshmark buyers already showed. What cuts against us: buyers who already know where to shop won't route through us, an affiliate network can refuse us, and eBay requires approval before production Buy API access ([buyer-side research](../research/watch/nate/buyer-side-actions-and-affiliate.md) §1).

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
