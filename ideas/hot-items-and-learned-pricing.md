# Hot items and a pricing model that learns from signals

Raised by Ben, 2026-11-15 00:12: "secondhand should be able to tell when something is 'hot' like monitor when it got things wrong and dynamically manage supply demand of the business. and we collect that data and can better manage business with ai from such signals. also everything is relative. views correlate differently from likes, shares, offers, etc. maybe use rdd with x algorithm and have this as a potential future feature maybe out of scope. but training a model to know what to move price by, how, etc." ([words](../product/words.md#2026-11-15-pricing-levers-signals-and-hot-items)).

**Waits on:** listings live on several sites with `read_stats` recording each site's signals daily, and a few hundred finished listings (sold or ended) to learn from.

## What it is

Four jobs on one log of signals per listing, per site, per day:

1. **Hot**: an item or product whose sales come faster than a model expects for its price and age, or whose offers per view run well above listings like it. The app says so and suggests holding or raising the price, sourcing more, or listing it on more sites.
2. **Wrong-price monitor**: after each sale or end, was our price wrong? Sold much faster than expected means it was underpriced; still unsold well past expected means overpriced. Tracked per category, site and kind of item, so the app knows where its prices are bad.
3. **Stock**: across a person's live items, which to push, which to hold and which to move to another site, from demand against how much of the same is listed.
4. **A learned price policy**: what to move the price by, how (which site lever) and when, learned from what happened after each move.

## References and what to take from each

Found by reference-driven research; the helper's full notes were scratch, these are the claims that carry the idea. Marks as in [research/README.md](../research/README.md).

| Reference | Why it is a good reference | What to take |
|---|---|---|
| X's ranker, 2023 (`twitter/the-algorithm-ml`, `projects/home/recap/README.md`) and 2026 (`xai-org/x-algorithm`, `home-mixer/params/param.rs`, synced 2026-11-10) | its weights are public and dated, and it separates what is predicted from what is valued | Score = sum of weight × predicted probability of each action. 2026 weights include Favorite 0.708, Reply 5.0, Share 2.118, ShareViaCopyLink 20.0, Click 0.274, NotInterested −53.07, Report −234.0 (*observed*). The code says the weights reflect "how much an action is valued" and "typical propensities", and do not multiply raw counts (*observed*). A rare signal carries weight as value over base rate. Weights drift between syncs (a second source gives Favorite 0.5 on 2026-09-18, *asserted*). It also explores new authors with Thompson sampling from a Beta(0.75, 49.25) prior (*observed*) |
| Pinterest per-action calibration (engineering blog) | it explains how scores from different actions became comparable | One calibration model per action, with position and device as features, so probabilities are stable across models (*observed*). For us: calibrate each site's signals to one outcome, a sale |
| Airbnb Smart Pricing, Ye et al., KDD 2018 | it learns prices with no true price to learn from, our exact case | A booked night means the price could have been higher; an unbooked night means it was too high. The loss is zero inside that band, and offline metrics are price-decrease recall and booking regret (*observed* abstract; loss details *asserted* from a summary). This is the wrong-price monitor almost as is |
| Rue La La, Ferreira, Lee, Simchi-Levi, MSOM 2016 | it priced items with no sales history and ran a field test | Price relative to competing items is the top feature; bagged trees; revenue +9.7% (90% CI 2.3 to 17.8%) (*observed*). Thompson sampling that ignores stock limits settles on the wrong price (Ferreira, Simchi-Levi, Wang 2018, *observed*) |
| Zara clearance, Caro and Gallien, OR 2012 | it was adopted, and says how people used it | Weekly decisions on a fixed ladder of prices that only go down; "support tool rather than an automated decision maker"; about 6% more clearance revenue (*observed*) |
| Zillow Offers (Buchak, Matvos, Piskorski, Seru, NBER w28252, via Stanford GSB) | a pricing model that failed at scale, for a reason we share | Errors are one-sided and selected: what is underpriced sells first, and sellers who know of hidden flaws take the model's average price (*observed* article). Track error separately for ordinary and unusual items, cap moves where the model is weak, and log every override |

## The shape it would take (*inferred*)

1. **Log**: one row per listing per site per day: impressions, views, likes, watchers, saves, shares, offers with amounts, messages, price, and the outcome.
2. **Outcome model**: a survival model per item for P(sale by day d | price relative to comparables, site, signals so far), calibrated per site and signal. The weight of each signal is learned as how much it raises the chance of a sale on that site, not set by hand. Hand-set weights stay only for value, such as fees that differ per site.
3. **Hot**: observed sale hazard or offers per view well above what the model expects for comparable items at that price.
4. **Wrong-price monitor**: sold before the 25th-percentile time of the model means underpriced; unsold past the 75th means overpriced. Reported per category and site as the Airbnb-style regret and decrease recall.
5. **Policy**: the [money D15](../spec/determinations/money.md#d15-markdown-path-stale-and-relist) ladder, moving down unless the item is hot, with Thompson sampling inside caps on move size, as suggestions the person approves, every override logged.

## What already exists

- Each site's signals, what they mean and how to read them, and the first relative readings (band, exchange rate, pull) with tests: [levers-and-signals.md](../research/list/ben/levers-and-signals.md#5-why-the-signals-are-relative-and-how-to-compare-them) and [levers/interest.mjs](../research/list/ben/levers/interest.mjs).
- Tests on live listings and whether a change helped: [listing D22, D23](../spec/determinations/listing-and-marketing.md#d22-test-design-for-a-change). Whether a site changed its ranking: [D24](../spec/determinations/listing-and-marketing.md#d24-whether-a-site-changed-its-ranking).
- The insights suite's anomaly notice and slow movers: [insights](../spec/features/insights.md#analytics-suite-agent-proposal).

## First step

With no price changes at all: on finished listings that were cross-posted, test whether a calibrated P(sale within 14 days) from the signals of days 1 to 3 beats a model with relative price alone (AUC and calibration error). Then backtest the wrong-price monitor: did items it called overpriced sell sooner after a cut than items cut by the same amount that it did not flag?

Not yet read, because a shared page-read limit ran out: StockX's and eBay Terapeak's own definitions of demand and sell-through, Joachims et al. 2017 on position bias, Keskin and Zeevi 2014 on greedy repricing that stops learning.
