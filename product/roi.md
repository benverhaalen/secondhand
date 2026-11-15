# What it costs, what it earns, and where it breaks even

Ben, 08:09: "look at our costs and estimate an roi for everything at scale... explain our revenue streams. like the referral links too... use hypotheticals backed in research but research that flatters us but it honest and inspectable" ([words](words.md#2026-11-15-quantify-every-feature-with-why-the-review-step-and-roi)). *Agent proposal*. Nothing here has been billed or earned yet.

The model is code, not a spreadsheet: [scripts/bench/roi.mjs](../scripts/bench/roi.mjs). Every input carries its source and a mark (observed, asserted, inferred, assumption). Change one and run `node scripts/bench/roi.mjs`; the tests in `roi.test.mjs` check the arithmetic adds up. The numbers below are its output on 2026-11-15.

## The answer first

1. **One referred purchase earns about $0.94.** That is a $33 order (Poshmark's own 2019 average, *observed* in its S-1) times a blended 2.8% commission, after a network's cut where a site has no direct programme.
2. **Free works if a person buys through us about once every three months, and Depop watching is designed down.** The base case loses $0.14 per person per month, and the whole loss is Depop: a signed-in sweep costs about $0.45 per person per month. With Depop's partner API (webhooks, no sweep), the same base case earns $0.31 per person per month, about $3.7M a year at 1M monthly users.
3. **Two independent anchors land on the same purchase rate.** Honey earned about $0.49 per monthly user per month in 2018 (*asserted*: PayPal's CEO via a secondary source). At our $0.94 a purchase, that is 0.52 purchases a month. A Poshmark buyer made 6.3 orders a year in 2019 (*asserted*, a write-up of the S-1), which is 0.525 a month. So the flattering case, 0.5 a month, is "as often as a Poshmark buyer already buys", not a fantasy.
4. **The decision this forces:** apply to Depop's partner programme. It is the difference between losing and earning money on free, at every purchase rate below the flattering one.

## Revenue streams

| Stream | How it pays | Rate and source | Counted? |
|---|---|---|---|
| Buy-side referral, eBay | eBay Partner Network pays a share of the sale when a buyer we sent buys within 24 hours of the click | Fashion 4.0%, Home and Collectibles 3.0%, electronics 2.0% (computers 1.5%), cap $550 a sale (*observed*, EPN rate card PDF) | yes |
| Buy-side referral, Poshmark, Depop, Mercari | No open direct programme; a network (Skimlinks-type) pays where the merchant runs one | merchant rate 3% (*assumption*, aggregators list Depop 0 to 7% and Poshmark 1 to 5%); the network keeps 30% (*observed*, Skimlinks support: "you receive 70%") | yes, at 2.1% |
| Buy-side referral, retail and Amazon | The better official option (refurbished, new) shown beside a used result | Amazon apparel 4%, home 3% (*asserted*, a third-party reading of the Associates table) | yes |
| Buy-side referral, Etsy | Etsy's programme runs through Rakuten | "case-by-case", 7-day cookie (*observed*, Etsy's terms); 3.2% (*asserted*, third party) | yes |
| Facebook Marketplace | None | no programme found (*observed* absence in [buyer-side research](../research/watch/nate/buyer-side-actions-and-affiliate.md)) | 0 |
| Studio photos | The one paid extra | $0.99 an item (*assumption*); our cost $0.54, so $0.45 margin | yes |
| A plan for resellers | Flat monthly, under the crosslisters | $9.99 a month (*assumption*); a crosslister lists at $39.99 (*asserted*) | yes |
| Market data | Anonymous, from consenting sellers and sources whose terms allow it | not priced | no, later |

The rule that keeps referrals honest: the order of results is computed with every referral field removed ([buy.ts](../app/src/edge/buy/buy.ts)). A referral can pay us; it can never move a listing up.

### How Honey and Capital One Shopping earn, and why we differ

| | Honey | Capital One Shopping | secondhand |
|---|---|---|---|
| Money | affiliate commissions, 0.5% to 10% (*asserted*, Honey via productmint and Seeking Alpha) | affiliate commissions across 30,000+ retailers (*observed*, Wikipedia) | the same commissions, only on purchases the person chose |
| Scale | ~17M monthly users; ~$100M revenue in 2018; bought by PayPal for $4B in January 2020 (*asserted*) | not published | 0 today |
| What hurt them | class actions alleging the extensions replaced creators' affiliate links at checkout (*asserted*: suit titles seen in search results, classaction.org and the Oganesyan v. Capital One complaint, 2025; not read in full) | the same | we never touch a link we did not create, and never inject at checkout. The person clicks our link from our search |

The lesson we take: the economics work (Honey proves a shopping helper can earn about $6 per monthly user a year from commissions alone), and the way to lose trust is to take credit you did not earn.

## Costs

| Cost | Per | Amount | Source |
|---|---|---|---|
| Identify an item | item | $0.035 (range $0.015 to $0.06) | [numbers](numbers.md#what-it-costs-us), *inferred* |
| Post to 4 sites and take down after the sale | item | $0.015 | same |
| Studio, as built | item that asks for it | $0.54: 2 slides × (4 Seedream 5.5 seeds × ($0.02 + 4 input images × $0.008) + 1 Nano Banana fallback at $0.037) + 10 judge reads at ~$0.005 | Seedream page (*observed*), run log (*observed*), judge (*assumption*) |
| Watching for sales, eBay, Facebook, Poshmark, Mercari | account-day | ~$0 | eBay pushes; we booked the pickup; a public page read is one 0.44 s request ([trace sd-1](../research/cross-cutting/nate/runs/sd-1.md)) |
| Watching for sales, Depop, signed in | account-day while live | $0.10 | [numbers](numbers.md#what-it-costs-us), *inferred* |
| A buy search | search | $0.01 | *inferred* from one web search |
| The platform | month | $1,500 fixed plus $0.02 a person | *assumption*; replace with the first bill |

Note on the studio: [numbers.md](numbers.md#what-it-costs-us) says about $0.25 for studio light. That figure is 3 relights; the run as built makes 10 candidates for 2 slides, which is $0.54. Cutting to 2 Seedream seeds a slide halves it.

## Per person per month

| | conservative | base | flattering |
|---|---|---|---|
| Referred purchases | 0.05 | 0.2 | 0.5 |
| Items listed | 1.0 | 1.5 | 2.0 |
| Studio attach / plan share | 5% / 1% | 10% / 2% | 15% / 3% |
| Depop | signed-in sweep | signed-in sweep | partner API |
| **Revenue** | $0.196 | $0.536 | $1.06 |
| of which referrals | $0.047 | $0.187 | $0.468 |
| **Cost** | $0.727 | $0.676 | $0.362 |
| of which Depop watching | $0.600 | $0.450 | $0 |
| **Margin** | −$0.53 | −$0.14 | +$0.70 |
| Purchases a month to break even | 0.62 | 0.35 | 0 |

At scale, after the fixed platform cost, per year:

| Monthly users | conservative | base | base with Depop's partner API | flattering |
|---|---|---|---|---|
| 10,000 | −$82k | −$35k | about +$19k | +$66k |
| 100,000 | −$655k | −$187k | +$353k | +$825k |
| 1,000,000 | −$6.4M | −$1.7M | +$3.7M | +$8.4M |

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

All in the `source` field of each input in [roi.mjs](../scripts/bench/roi.mjs). The pages behind them, read 2026-11-15: Poshmark S-1 (sec.gov, filed 2020-12-17); eBay Partner Network rate card and its PDF; Skimlinks support "How much does Skimlinks charge"; Etsy affiliate terms (updated 2026-11-23 per the page); getlasso.co on Amazon and Etsy (third party); productmint.com, seekingalpha.com and a Substack on Honey (third party); Wikipedia on Capital One Shopping; search-result titles for the Capital One Shopping suit (not read in full); openrouter.ai and runware.ai Seedream 5.5 pages; Value Investors Club on Poshmark (third party). Impact.com's 2025 benchmark gives only year-on-year change in affiliate conversion (−6%) and a $123 all-retail order value, too broad to use for secondhand.
