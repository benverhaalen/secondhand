# What do car valuation, real estate comps, card grading and category price guides teach us about pricing used goods?
Researched 2026-11-14 by Ben (Claude Code agent, project thread "Research market-value pricing and appraisal"). Feature: price.

These fields have priced used, non-identical goods for decades. Each row gives the reference a job. UX takeaways from KBB, Zillow and Collectr are already in [adjacent-references.md](../../cross-cutting/ben/adjacent-references.md) §C; this note covers the **mechanism** behind the number.

## Cars: Manheim Market Report (MMR)

Job: **implementation mechanism** for a comp-based value with adjustments, ranges and an abstain rule.

Observed (site.manheim.com MMR help, modified 2026-06-01; autoremarketing.com on options adjustments):

- Base value is "the average wholesale price, odometer, condition grade and build quality of recent transactions for a given year, excluding outliers. Recent transactions are more heavily weighted."
- Identity is year, make, model and style (trim), then VIN-level options. Cox says "some 85% of vehicles transacted" can now get a VIN-specific option adjustment.
- Adjustments for odometer, region, condition and colour are "recalculated daily for each year, make, model, and style". Mileage uses "a separate average mileage and per-mile depreciation factor for every vehicle", not a generic table.
- **Abstain rule:** a value needs "at least 6 transactions in the past year, and at least 2 transactions in the past 90 days, for a specific trim level". Below that, a "Small Sample Size" estimate from MSRP and depreciation of similar vehicles.
- **Range:** "a confidence interval representing the probability that 70% of sales with similar attributes will fall within the range", hidden when transactions are too few.
- Retail values are "estimated mark-ups over wholesale values". Wholesale and retail are different channels with different prices for the same car.
- Exclusions: salvage, lemon-law and title brands; outliers flagged on price, mileage and condition.

What we take (inferred):
- Identity at the finest grain that still has enough sales, falling back to a coarser grain (trim → model → category) with a wider range. This is the same back-off as "Levi's 501 Big E 33x30" → "Levi's 501 vintage" → "vintage jeans".
- Per-identity adjustment factors learned from data, not one global condition discount.
- Publish the minimum-sales rule and the range's meaning ("7 in 10 similar sales fell here").
- Channels differ by design: wholesale vs retail ≈ garage sale / Facebook vs eBay / Depop.

## Collector cars: Hagerty

Job: **evidence** that condition grades should be few, named and defined in words.

Observed (hagerty.com/valuation-tools/about-our-conditions): four grades, "#1 vehicles are the best in the world" through "#4 vehicles are daily drivers, with flaws visible to the naked eye". Values come from peer-to-peer sales, auctions and dealer sales, and are expert-filtered rather than "programmatically compiled". Other value factors named: number of owners, originality, documentation, mileage, modifications.

Take (inferred): originality and documentation (receipts, original box, tags) are value drivers in their own right; ask for them. A few named condition grades with plain-word definitions beat a 1–10 slider for casual sellers.

## Real estate: comparable sales and adjustments

Job: **implementation mechanism** for choosing and adjusting comps, and **evidence** on how many to use.

Observed:
- "The optimal number of comparable sales is usually small", set by "a tradeoff between random errors that decrease as sample size increases versus biased misspecification and measurement errors that increase with sample size" (Kummerow, PRRES paper, abstract). Random error falls with the square root of the count while dissimilarity error rises, so total error is U-shaped. The paper notes US forms "use three comparable sales" and cites data where 5 comps gave 5.4% error vs 8.1% for 3 (summary of the unread third).
- Secondary-mortgage standards cited there: total absolute adjustments under 25% of a comp's price and net adjustments under 15% (Kummerow, footnote 7).
- An appraisal "begins with a selection of a small number of recent transactions in the same development or neighborhood"; "On average, there are four comps in an appraisal"; comps must be "locationally, physically, and functionally the most similar" (Conklin et al. 2023 working paper hosted by Fannie Mae).
- Adjustment methods: paired sales ("Compare two very similar sales that differ in only one feature to isolate the market's reaction"), regression, cost to cure, and market-conditions (time) adjustments, e.g. "If the market has increased by 5% since a comparable sold, the appraiser would adjust the sale price upward" (McKissock).
- Zillow publishes Zestimate error openly (1.80% on-market vs 7.21% off-market) and Zillow Offers shut down after Zillow could not predict prices well enough (observed, in [adjacent-references.md](../../cross-cutting/ben/adjacent-references.md)).

Take (inferred):
- **Show a handful of close comps (about 3 to 8), not 200 loose ones.** Weighted by similarity and recency.
- **Write each adjustment out**: "Sold $52 · stain on cuff −$6 · 40 days ago +$0 = $46". If adjustments exceed roughly 25% of a comp's price, that comp is too different; drop it. Borrow the 15/25 rule as a heuristic.
- **Paired sales are how to learn defect discounts:** find two sales of the same identity that differ only in one defect or driver.
- **Cost to cure** applies to fixable defects: a missing button, dirty sneakers, a cleanable stain. Suggest the fix when the price gain exceeds the cost.
- **Estimate is not an offer.** Keep "worth about" separate from anything that promises a payout (Zillow Offers).

## Trading cards: grading

Job: **implementation mechanism** for per-aspect condition scoring from images, and **evidence** that grade is a price multiplier.

Observed:
- Ximilar's pre-grading uses separate models for "corners, edges, card surface, and centering"; corner and edge grades are "simply an average"; centering follows Beckett, where a 10 needs "a 50/50 ratio". It needs "relatively high-resolution images, with good lighting conditions and with low post-processing". Its example graded a BGS 6 card as 6.5 (ximilar.com, modified 2026-05-20).
- TAG grades with "Photometric Stereoscopic Imaging" on a 1000-point scale mapped to 1–10 and reports corners, edges, centering, surface and dimensions (phantomdisplay.com, a retailer blog, 2026-07-28). 2025 volumes: PSA 19.26M, SGC 1.42M, Beckett 824,000+, TAG 440,000+. "No authoritative or neutral source publishes a reliable TAG-versus-PSA price gap."
- PriceCharting prices cards separately at ungraded, 7, 8, 9, 9.5, PSA 10 and BGS 10, reading the grade from the listing (pricecharting.com).

Take (inferred):
- Condition is a vector of aspects (for clothing: fabric wear, pilling, stains, holes, fading, hardware, odour; for electronics: cosmetic, function, battery), each scored from targeted photos, then combined.
- The grader's identity matters to price (PSA vs TAG). Similarly, "who says so" matters for authenticity: a platform-authenticated sneaker and an unauthenticated one are different markets.
- Garage-sale phone photos will not support lab-grade condition. Carry the uncertainty into the range and ask for the one close-up that matters.

## Records, games and other catalogue categories

Job: **evidence** that a catalogue ID makes pricing tractable.

- Discogs exposes `/marketplace/price_suggestions/{release_id}` (observed, endpoint path in an R wrapper). Per-condition-grade output is asserted from memory.
- PriceCharting splits Loose, CIB, New and Graded, uses "most recent sale price, median price, average price, age weighted average price", flags "abnormally high or low prices" for manual review, and drops listings with words like "For Parts", "Reproduction", "Broken" (observed).

Take (inferred): use catalogue IDs wherever they exist (UPC/GTIN, Discogs release, card number, sneaker style code, ISBN). Copy PriceCharting's junk-keyword filter and outlier review for every category.

## Mercari Price Suggestion Challenge

Job: **evidence** that listing text predicts price well, and a public baseline.

Observed (engineering.mercari.com, 2018-11-14): metric RMSLE; winning score 0.3875 from a small MLP; at RMSLE 1.0 a ¥3,000 item's estimate spans ¥1,103 to ¥8,156, which shows how wide "good" text-only models still are. The winner "was unable to achieve the same score in the Japanese version". Mercari built price suggestion because "some items ... cannot be sold because their listing prices are too high".

Take (inferred): a text model over titles and item specifics is a good prior and a good way to discover value drivers. On its own it is too wide to show a user; use it to back up comps, not replace them.

## Limits of this note

Kummerow and the Fannie Mae-hosted paper were read partly through a summary. Discogs' own docs and Reverb were not read. Seasonality and hype dynamics (sneaker drops, a band reunion, a TikTok trend) were not researched here; Google Trends-style demand signals are a gap worth a separate look.
