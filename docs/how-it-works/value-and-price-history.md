# How the app finds a value, and tracks price over time

This document explains how the app arrives at a price range for one item, what you would keep after fees, and how it follows a product's price as the weeks pass.

Status: explanation of the current design (agent proposal). Written 2026-11-14.

Nothing here is built yet. "The current design" means what the specs propose today, not what has been decided. It describes the design in [spec/](../../spec/), mainly the [Price spec](../../spec/features/price.md) and the [money determinations](../../spec/determinations/money.md). Every weight below is a starting value to be tuned against real sales.

## The idea in one paragraph

A value is built from past sales of the same product, each weighed by how much it should count, then adjusted to your item's condition, the date and the site. The app shows a range, not a point, and shows how many sales it rests on. When the evidence is thin the number is hidden and the screen says why. Every shown number opens a citation, and recomputing from that citation gives the same value. Model steps only read text and photos into fields. The weighing and the arithmetic after that are plain code with fixed seeds.

We follow one item: a pair of sneakers, in good condition, with the original box.

## Which prices count

Not every price is a sale. Each past price gets a weight that is the product of four factors ([card D1, comparable set](../../spec/determinations/money.md#d1-comparable-set-and-weights)).

| Source | Weight |
|---|---|
| A sale with a known price (eBay sold, Mercari sold, Depop sold) | 1.0 |
| Our own completed orders | 1.2 |
| An eBay Best Offer accepted, amount unknown | 0.6, with the price reduced by a learned amount |
| A live asking price | 0 for value. Used as a cap and for ranking |
| A listing that ended unsold | 0 for value. Kept as a censored row for the time-to-sell model |
| Retail price | Never a comp |

**Sold against asking.** Asking prices are hopes. Sold prices are what people paid. So asking never enters the value. It only caps the top of the range.

The other three factors are match, age and extraction.

- **Match.** Same product and variant 1.0, same product other variant 0.5, same family 0.25, and "visually similar, unverified" 0.
- **Age.** The weight halves every 90 days. For fast categories, which are sneakers, trading cards and consumer electronics, it halves every 30. Anything older than 365 days is out.
- **Extraction.** A measured value or a label read counts 1.0, a marketplace's structured field 0.9, and a model's inference 0.7.

Candidates come from an embedding search plus a Claude Haiku 5.5 step that reads comp text, filtered by category and hard attributes. Junk is dropped: parts, lots, reproductions, your own listing, and relists, which are caught by a fingerprint. If the effective count of comps, `n_eff = (sum of weights)^2 / sum of squared weights`, is under 6, or there are fewer than 2 sales in 90 days, the app widens to a coarser group and tries again. If it is still thin, the number is hidden as "Not enough sales to price this yet".

The screen reads "Based on 14 sales, last 90 days". A tap shows each comp, its adjustments, and "counts a lot", "some" or "a little".

## Adjusting each sale to your item

A comp is a different pair in a different month on a different site. Three steps bring it to yours.

**Condition, completeness, variant and size** ([D2](../../spec/determinations/money.md#d2-condition-variant-completeness-and-size-adjustment)). The method is chosen by the best evidence available. First choice is paired sales of the same product in two conditions within 60 days. Next is a per-category regression of log price on condition, variant, completeness, size, site and month. Then a parent-category regression, blended in with a strength of 50 rows. Last, starting priors relative to Good: new with tags 1.35, new without tags 1.20, excellent 1.10, fair 0.75, for parts 0.35. The spec marks these priors as placeholders. A missing original box counts 0.90 for sneakers and electronics. Size has no prior at all, because it differs by category and gender, so it comes only from the fit.

For the sneakers: "This one sold for $40, yours has its box, so we count it as $44."

**Time** ([D3](../../spec/determinations/money.md#d3-time-adjustment)). Prices drift. The app builds a monthly index for the category from repeat sales of the same item (a Case-Shiller style method) and scales each sale by `index now / index at sale`, capped between 0.8 and 1.25. With fewer than 30 pairs and 200 sales, the factor is 1 and the age weight does the work.

**Site** ([D4](../../spec/determinations/money.md#d4-site-translation)). A site's own comps are used when it has at least 6 effective ones. Otherwise the app uses the median ratio between that site and a reference site over products sold on both within 90 days, widens the range by the ratio's spread, and labels it "estimated from other sites". Under 20 shared products it says "Not enough sales on Depop yet".

A comp whose total adjustment exceeds 25% is dropped. Outliers beyond three scaled median deviations are dropped. The top 3 to 8 comps by weight are shown.

## The range, and why you can trust its width

A LightGBM model gives the 10th, 50th and 90th percentile, with the site as an input ([D5](../../spec/determinations/money.md#d5-fair-value-range-overall-and-per-site)). The range is then widened by a conformal margin, measured from how far real sale prices fell outside past ranges in that category ([D6](../../spec/determinations/money.md#d6-range-calibration-and-display-state)). The rolling backtest runs by month, leaves a 7-day gap, and removes leakage. The spec cites two reasons to measure instead of asserting: one public tool covered 75.3% of 81 sales inside a stated 80% range, and a language-model estimate missed by $30 to $43 on a $100 item.

A range has three states.

| State | When | What the person sees |
|---|---|---|
| Checked | The lower bound of the 95% Wilson interval on coverage is at least 70%, with 30 or more tests | The range and a share such as "8 in 10", rounded down |
| Not checked yet | Too few tests in this category | The parent category's range, drawn wider, with no share |
| Hidden | `too_few`, or `too_wide` when high minus low exceeds the median | "Prices for this vary too much to say" |

For new-with-tags items, the top is also capped by the lowest live ask and today's new price. The design is wrong if, in our own backtest, the median's error is worse than the better of two simple baselines (the median of recent sold comps, and the last sale of the same product), or the 80% range holds outside 75% to 85% ([money.md D6](../../spec/determinations/money.md#d6-range-calibration-and-display-state); starting values). Vendors' published tests are not the bar ([published-price-tests-and-their-flaws](../../research/price/nate/published-price-tests-and-their-flaws.md)).

## Original retail

Retail is context, never a comp ([D7](../../spec/determinations/money.md#d7-original-retail-price)). The app looks for the maker's store page matched by GTIN or style code, then authorised retailers, then an archived page for discontinued items. A model's memory is never used alone. Vintage, unbranded and handmade items have no matching page, so no retail line appears and nothing is guessed. The line reads "It cost $120 new in 2023 at the brand's store" ([M2](../../spec/determinations/market-insight.md#m2-retail-price-and-release-date)).

## What you keep

A sale price is not what lands in your account ([D8 shipping](../../spec/determinations/money.md#d8-shipping-cost-and-fit-per-site), [D9 what you keep](../../spec/determinations/money.md#d9-what-you-keep-per-site)). Each site has its own fee table, base and shipping rule.

| Site | Fee | Charged on |
|---|---|---|
| eBay | 13.6% to $7,500, then 2.35%, plus $0.30 at $10 or less, else $0.40 | Item, shipping and sales tax |
| Depop | No selling fee, payment processing 3.3% plus $0.45 | Item, shipping and tax |
| Poshmark | $2.95 under $15, else 20% | Item only |
| Mercari | 10% | Item and buyer shipping |
| Facebook, shipped | 10%, $0.80 minimum (asserted) | Item, shipping and tax |
| Facebook, local | 0 | Nothing |

The spec's worked example is a $20 shirt with $6 buyer-paid shipping: the seller keeps $16.06 on eBay and $18.69 on Depop. A flat percentage would say $16.88 for both. Tax is a 7% placeholder. A fee row older than 30 days shows "fees may have changed". Shipping is the package (item plus padding plus packaging) priced at a median zone, with a category default as fallback. An item over the carrier limit greys out those sites with "too big to ship".

## Tracking a product's price over time

An item's value and a product's history are separate numbers with separate cards. The history serves product pages and needs a number "a person can check by counting sales" ([M3](../../spec/determinations/market-insight.md#m3-used-price-per-site-over-time)).

Each week, per product, site and condition band, the app takes a weighted 25th, 50th and 75th percentile of sales from the 90 days before. Weights: a sold-final price (eBay sold, our orders) 1.0, a sold-tag price (Poshmark, Mercari, Depop, whose last ask can overstate a sale) 0.7, and ended listings 0. Asking prices form a separate series labelled "asking, not sold". Recency halves every 30 days. A model step flags lots, bundles, parts-only and replicas, and those leave. A daily Lakeflow job writes a snapshot synced to Lakebase.

A product's history is hidden as "Not enough sales yet" under 6 sales in 12 months or 2 in 90 days. A low-basis mark shows when `n_eff` is under 5. The line reads "Sold for $36 to $52 lately, from 41 sales in 90 days", with the sales behind it.

**Change.** ([M22](../../spec/determinations/market-insight.md#m22-price-change-over-time-for-a-product)) The change over 30, 90 and 365 days is `median now / median then - 1`. It reads "Held" if the two points sit inside a bootstrap 90% band (500 draws, fixed seed). The line reads "Up about 12% since August, from 60 sales".

**Site gap.** ([M23](../../spec/determinations/market-insight.md#m23-where-it-is-cheaper-to-buy-and-better-to-sell)) A gap counts only when two sites' middle ranges do not overlap. Otherwise: "about the same everywhere". For sellers the comparison uses net after fees and shipping.

## What differs by kind

| Kind | What the spec says |
|---|---|
| Shoes | Fast category, 30-day age half-life. A missing box counts 0.90. Size comes from the fit only |
| Trading cards | Fast category, 30-day half-life. No other card-specific rule in these cards |
| Clothes | The default 90-day half-life. Size comes from the fit only. A shirt defaults to 0.5 lb in a poly mailer (asserted) |
| Furniture | Often over the carrier limit, so only Facebook local remains. No retail line if vintage or handmade |

## What is not settled

- **Two weightings of the same sales.** [D1](../../spec/determinations/money.md#d1-comparable-set-and-weights) weighs Mercari and Depop sales 1.0 with a 90-day half-life (30 for fast kinds). [M3](../../spec/determinations/market-insight.md#m3-used-price-per-site-over-time) weighs them 0.7 with a 30-day half-life for all kinds, and its hide rule differs. A product page and an item's range can differ for the same product. The spec does not say which wins.
- **Two definitions of launch price.** D7 takes the median of list prices in the first 90 days. M2 takes the highest regular price in the first 30.
- **Placeholders.** The condition priors, the 7% tax and several shipping figures are asserted, not sourced.
- **Cards.** The by-kind table is thin for trading cards. The spec has no card-specific rule beyond the fast-category half-life.

## Where to read more

- [Price spec](../../spec/features/price.md): the feature, and when an item's value goes stale.
- [Appraise spec](../../spec/features/appraise.md): the same engine for a thing you do not own yet.
- [Market spec](../../spec/features/market.md): product pages, metrics and the index.
- [Score spec](../../spec/features/score.md): the four axes shown per site.
- [Money determinations](../../spec/determinations/money.md): every weight and rule above.
- [Market insight determinations](../../spec/determinations/market-insight.md): the product-level history.
- [Fees and taxes research](../../research/price/nate/fees-and-taxes.md) and [range calibration research](../../research/price/nate/range-calibration.md): the evidence behind D9 and D6.
