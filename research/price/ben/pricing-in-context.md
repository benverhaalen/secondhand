# What do financial markets teach us about pricing a secondhand item in context?
Researched 2026-11-14 by Ben (Claude Code agent, project thread "Research market-value pricing and appraisal"). Feature: price.

Ben: "another thing is its almost adjacent to markets i guess. how do you price things in context" ([words](../../../product/words.md#2026-11-14-pricing-in-context)).

This note builds on [what-market-value-is.md](what-market-value-is.md) and [valuation-engine.md](valuation-engine.md). Several primary sources failed to load this session (S&P Case-Shiller methodology, ICE bond evaluations, ThredUp's resale report, Wikipedia's matrix-pricing and repeat-sales pages), so more of this note rests on memory than the others; each such claim is marked.

## The right analogy: illiquid, one-of-a-kind assets

Inferred. A used item is not like a share of stock, where identical units trade every second and the last trade is the price. It is like a house, an artwork or a corporate bond that rarely trades: each unit differs a little, trades are rare, and the price has to be **estimated from similar trades** and labelled with how confident the estimate is. Finance has well-developed methods for exactly this.

| Finance idea | What it is | Secondhand equivalent | Evidence |
|---|---|---|---|
| **Evaluated pricing** (Bloomberg BVAL) | Prices "thinly-traded and hard-to-price" bonds; "For securities that are less liquid, BVAL derives a comparable relative value price" | Price an item with no exact recent sale from adjusted comps | observed (bloomberg.com pricing-data page) |
| **Confidence score** (BVAL Score) | "a proprietary measure showing the relative amount and consistency of market data used to generate each evaluated price" | Show how much and how consistent the comp data is, not just a range | observed (same page) |
| **Fair value hierarchy** (accounting Level 1/2/3) | Level 1: quoted price for the identical asset in an active market. Level 2: observable prices for similar assets. Level 3: model and unobservable inputs | Tier every estimate: identical item on an exchange (StockX, Discogs) → similar sold comps adjusted → model or expert guess | asserted, from memory (IFRS 13 / ASC 820) |
| **Hedonic regression** | Value a "differentiated good" by decomposing it into characteristics; "a more statistically robust form of the sales comparison approach" | Learn what each attribute (made-in, era, size, defect) is worth | observed (Wikipedia, Hedonic regression) |
| **Repeat-sales index** (Case-Shiller) | Built from "repeat sales of single-family homes"; it "is able to adjust for the quality of the homes sold, unlike simple indices based on averages" | Track how a category's prices move over time from items that sold twice (sneakers, cards, flips), then time-adjust old comps | observed (Wikipedia, Case–Shiller index); pair weighting details not verified |
| **Category index** (Card Ladder) | Card market indices from "75M+ historical sales", gives estimates "even if the last sale was years ago" | A trend index per category so a comp from 8 months ago can be brought to today | observed (cardladder.com, marketing page; method not published) |
| **Bid–ask spread** | "the cost of making transactions without delay"; its parts are "a cost of asymmetric information" and "a cost of immediacy"; thin markets have wider spreads | The gap between the quick-cash price and the patient price | observed (Wikipedia, Bid–ask spread) |
| **Order book** (StockX) | "Buyers see the lowest available Ask; sellers see the highest available Offer." "Sell Now: Match immediately with the highest existing buyer Offer." | A real order book for standardised items; a synthetic one for everything else (below) | observed (stockx.com help) |

## Seven things that transfer

### 1. Label every price by how it was derived (Level 1, 2, 3)

Inferred. Users and the engine should both know whether a number is "an identical item trades at $X right now" (Level 1: StockX offer, Discogs, a PriceCharting product), "similar items sold for about $X" (Level 2: adjusted comps), or "our best guess" (Level 3: model or long-tail research). This is a clearer confidence signal than a percentage, and it tells the user when an auction or a human expert would beat us. BVAL publishes a score for the same reason.

### 2. Make the spread the speed-vs-price slider

The spread is the price of immediacy. For secondhand (inferred):

- **Bid** = what you can get now: a reseller or dealer offer, a "Sell Now" on StockX, a garage-sale price, a buy-it-now at a low price on a busy channel.
- **Ask** = what a patient seller can get: a listing on the channel with the best buyers, waiting for the right one.
- The width depends on liquidity. An iPhone has a narrow spread (many buyers, identical units). A 1970s band tee has a wide one (few buyers, each item different).

So the slider should not be a fixed ±20% around a midpoint. Its ends come from data: the quick-sale price from fast-selling comps, the patient price from slow-selling comps, and its width tells the user how much waiting is worth for this particular item. The UX research already proposes "Sell this week ~$45 · Typical ~$60 · Hold out ~$75" ([direct-references.md](../../cross-cutting/ben/direct-references.md), Flow 4); this note supplies the mechanism.

### 3. Disclosure narrows the spread

The spread's other part is "asymmetric information": buyers discount what they cannot verify. In used goods this is condition and authenticity. Diagnostic disclosure raises prices on eBay Motors (Lewis 2011; Dimoka et al. 2012, observed in [psychology.md](../../cross-cutting/ben/psychology.md)). So the defect photos, measurements and authenticity checks are not just honesty; they move the patient price up and the item's time to sell down. The engine can show this: "adding a tag photo and measurements typically closes about $X of the gap" once our own outcome data supports a number (inferred).

### 4. Build a synthetic order book for non-standard items

Only standardised items get a real order book like StockX. For everything else, construct one from public data (inferred):

- **Asks** = active listings of comparable items, each adjusted to our item's condition and normalised to total price.
- **Trades** = sold listings with dates.
- **Latent bids** = signals of demand: watchers, likes, offers, saved searches (where a platform exposes them), and secondhand's own watch requests.

From that, expected time to sell is a queue problem: if your adjusted price would be the 3rd lowest of 40 comparable asks and that pool clears about 2 items a week, you should expect roughly 1 to 2 weeks. Undercut the cheapest ask and it should go in days. This turns "days to sell" from a guess into a number with an explanation the user can check, and it updates as competitors list and sell (inferred).

### 5. Time-adjust comps with an index, and watch for shocks

- **Trend.** A comp's price should be moved to today with a category index (Case-Shiller style repeat sales for items that resell, or a hedonic index otherwise). Appraisers do the same "market conditions" adjustment (observed, McKissock, in [adjacent-valuation.md](adjacent-valuation.md)).
- **Seasonality.** Demand is seasonal (coats in autumn, bikes and patio furniture in spring, gifts before Christmas). Many seller guides publish calendars (unopened: underpriced.app's "best time to list" calendar, eBay's seasonal guide), but I found no rigorous public measurement. Learn it from our own sold data per category and recommend "list now" or "hold until September" when the gap is large (inferred; Hopper's "wait or book" pattern is in [adjacent-references.md](../../cross-cutting/ben/adjacent-references.md)).
- **Demand shocks.** A death, reunion, film, or social-media trend can spike one artist's or product's prices overnight (unopened: press reports on Prince LP prices "soaring on eBay" after his death, and on Kavinsky vinyl after his; an academic paper by Brandes, Nüesch and Franck, Marketing Letters 2016, came up in the same search). Detect shocks as a sudden jump in sold volume and price for one identity against its category index. Hype usually decays, so the advice is to sell into the spike quickly and to widen the range while it lasts (asserted, from memory; not measured here).

### 6. The platform is the market structure, and it changes prices

eBay's 2011 search redesign changed what buyers saw first; "After the change, transaction prices fell by roughly 5–15 percent for many products", and buyers "regularly do not buy from the lowest-price seller" (observed, Dinerstein, Einav, Levin and Sundaresan, AER 2018). So platform differences in price are partly about who the buyers are and partly about how each platform's search ranks and shows listings. Each channel needs its own price distribution, and the engine should not assume a price that works on Depop transfers to eBay (inferred; consistent with the VoucherCodes comparison in [what-market-value-is.md](what-market-value-is.md)).

### 7. When there is no market price, run price discovery

When an item is truly Level 3 (no comps, rare, possibly valuable), finance and art markets use auctions to discover the price. Recommending an auction listing (eBay auction, or a specialist auction house for high-value pieces) is the honest answer, rather than inventing a number (inferred; the research literature on eBay's shift from auctions to fixed prices was not retrieved this session).

## Context also means the seller's own situation

"In context" has a personal side that markets also price (inferred):

- **Urgency.** Needing cash this week means paying the spread; the slider should start where the user's urgency puts it.
- **Holding costs.** Storage space, a couch blocking the garage, the risk of the item dropping in value. Finance calls this carry; it argues for selling sooner when it is high.
- **Selling several of the same thing.** Listing ten identical items at once floods a thin market and pushes the price down (market impact). Stagger them, or sell as a lot to a reseller.
- **Reservation price.** What the item is worth to the owner. Keep it separate from market value (endowment effect, in [psychology.md](../../cross-cutting/ben/psychology.md)) and use it as a floor, not as the estimate.

## What changes in the engine

Agent proposal, folded into [valuation-engine.md](valuation-engine.md):

1. Every estimate carries a **level** (1, 2 or 3) and a **data score** (amount and consistency of comps).
2. The slider's ends and width come from fast-selling and slow-selling comps, not a fixed percentage.
3. Days to sell comes from a **synthetic order book**: queue position among adjusted competing asks and the clearing rate.
4. Comps are **time-adjusted** with a category index; shocks and seasons are flagged.
5. Level 3 items get a "run an auction or ask an expert" route.

## Limits

The methodology documents for Case-Shiller, BVAL and bond matrix pricing were not read in full (they failed or are not public), and the fair-value hierarchy is from memory. No study measured seasonality or demand-shock size for secondhand goods in this session. These are good targets for backtesting on our own sold data rather than for more reading.
