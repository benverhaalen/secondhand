# Price
Status: draft, *agent proposal* except where a line links a decision. Slug: price. Written 2026-11-14.

Today a seller searches sold listings on two or three sites, guesses a number, forgets fees and shipping, then drops the price at random when nothing happens. Price takes that off them: one range per site with what it rests on, what they keep on each site, how long it should take, and a plan they pick once. Feature page: [features/price](../../features/price/README.md). Ben asked "how do you price things in context" ([words](../../product/words.md#2026-11-14-pricing-in-context)); Nate asked that users "select the marketing strategy (with a suggested one generated...)" ([words](../../product/words.md#2026-11-14-nate-vision)).

## What the person does and sees

| Step | Where | What they see |
|---|---|---|
| 1 | Sell, item in `researching` | The Valuation card fills by stage: identified, sales found, range ready. |
| 2 | Valuation card | One range per site, with "based on 14 sales, last 90 days" ([copy.md](../../product/copy.md) wording, no "n=") and "about 9 days" to sell. Tap a range for the sales under it, each with photo, date and sold or asking. |
| 3 | Valuation card | "You keep" per site, after that site's fee, shipping and tax. Sites that do not fit are greyed with one reason ("too big to ship", "Depop buyers want clothes"). |
| 4 | Plan | Three plan cards: **Sell this week**, **Typical**, **Get the most** (Ben's slider labels, [MV](../../research/price/ben/what-market-value-is.md)). One carries a "Suggested" pill. Each shows start price, lowest price, sites, ship or pickup, and the price path as a small step line. |
| 5 | Plan | The lowest-price field, prefilled from the plan, and "Always accept $X or more", prefilled at the plan's lowest price ([decision](../../product/decisions.md#2026-11-14-always-accept-is-offered-at-listing-and-only-unedited-approvals-count)). |
| 6 | Today | Follow-ups the plan scheduled show as done events ("Dropped to $52 on Depop"); undo on each. |
| 7 | You | Earned, fees and kept per site, derived from orders ([decision](../../product/decisions.md#2026-11-14-the-you-tab-leads-with-numbers-and-a-by-site-comparison)). |

When there is too little data the card says "Not enough sales to price this" and offers one question ("Is there a tag with a model number?") or a deep search, never a number ([VE](../../research/price/ben/valuation-engine.md)).

Where Ben's design would make a person stumble: a single slider ($45 / $60 / $75) hides that the three positions differ in sites and terms, not just price; the plan cards show that. What the backend makes possible that his design does not yet use: days to sell per price, so each card can say "about 3 days" against "about 25 days".

## What it reads and writes

| Entity | Reads | Writes |
|---|---|---|
| `item`, `attribute`, `product` | identity, condition, measured size, defects | nothing (an answered question writes a `you_said` attribute through capture) |
| `comp` (Delta) | source, price type, date, rights note, adjusted price | new comps from each run, with rights note |
| `valuation` | | per site: `{low, high, basis_count, as_of, days_to_sell, net_low, net_high, fee_table_version}`, or `abstained` with reason |
| `strategy` | | the chosen plan: objective, price path, lowest price, sites with reason, ship or pickup, follow-ups, markdown and relist times |
| `limits` | | lowest price per item, ship or pickup |
| `rule` | | "Always accept $X or more" for this item |
| `listing`, `offer`, `order`, `event` | outcomes for learning | `event` per markdown, relist and plan change |
| `goal` | monthly target and progress | nothing |

Fee table: one row per site and version, `{site, fee_pct, fixed_cents, base: item|item+ship|item+ship+tax, min_cents, valid_from, source_note}` ([fees-and-taxes](../../research/price/nate/fees-and-taxes.md)).

## States

| Move | Trigger |
|---|---|
| item `researching` to `review` | valuation job arrives (with a range or an abstain) |
| item `review` to `live` | person picks a plan and lists |
| item `live` to `stale` | no sale by the plan's last step and no watchers or likes gained in 14 days |
| item `stale` to `live` | relist or a new plan |
| item `stale` to `unsold` or `kept` | person ends it |
| strategy `active, paused, done, replaced` | *agent proposal*; a manual price edit pauses the path |

## Systems underneath

| Piece | Role |
|---|---|
| Lakeflow job `valuate` | stages: `identify`, `find_sales`, `adjust`, `range`, `net`, `plans`. Each stage `started, running, arrived, failed`. |
| Site adapters and comp sources | fetch comps (table under Facts) |
| AI Search | nearest products and comps by text and image embedding, with back-off from exact model to family to category ([VE](../../research/price/ben/valuation-engine.md)) |
| Model gateway | Sonnet reads listing text into driver attributes; a bounded yes/no check "same product?" per comp ([decision](../../product/decisions.md#2026-11-14-typed-judgements-run-on-both-the-decisions-api-and-jev-and-our-labels-pick)); Opus only for deep search |
| Plain code (never a model) | adjustment factors, weighted p25/p50/p75, abstain rule, fees, shipping, tax, net, days to sell, price path, lowest price checks, money in cents |
| Delta | comps, outcomes, training sets; MLflow 3 trace per job is the "why?" timeline |
| Lakeflow job `follow_up` | runs scheduled markdowns and relists through the posting adapters |

The range: `adjusted = sold x condition x drivers x time`, comps dropped above about 25% adjustment, weighted quantiles per site, a learned site ratio where a site has no sold data ([VE](../../research/price/ben/valuation-engine.md)). Abstain under 6 sales in 12 months or 2 in 90 days. Days to sell = place in the queue of adjusted asks divided by sales per day ([PC](../../research/price/ben/pricing-in-context.md)).

**You keep** (reconciled): `net = price - fee(base) - fixed - seller_shipping - processing`. Ben's $16.88 (eBay) and about $18.90 (Depop) on a $20 sale ([pitch-evidence](../../research/cross-cutting/ben/pitch-evidence.md)) hold only with no shipping in the fee base; Nate's note puts shipping and tax in the base and gets $16.06 and $18.69 ([fees-and-taxes](../../research/price/nate/fees-and-taxes.md)). Both are right for their inputs; the engine takes shipping and tax as inputs and uses each site's base. The card shows the shipped figure when the plan ships.

**Plans.** Each card is one `strategy`, chosen as `p = argmax P(sale within T | p) x net(p)` for its objective (Nate's research, [analytics](../../research/data/nate/analytics-and-recommendations.md)):

| Plan | Objective | Start, path | Lowest | Sites |
|---|---|---|---|---|
| Sell this week | sale within 7 days | p25, drop 10% day 3, day 5 | p25 less 10% | every site that fits |
| Typical | highest net within 30 days | p50, drop 7% day 10, day 20 | p25 | every site that fits |
| Get the most | highest net | p75, drop 5% day 21, relist day 45 | p50 | sites with the highest p75 |

Site fit is a code rule from item size, category and site rules: bulky items go Facebook local only (Mercari will not ship furniture, [fees-and-taxes](../../research/price/nate/fees-and-taxes.md)); Depop is offered for clothes and accessories. Suggested plan: the one whose net by its date best closes the gap to this month's `goal`; with no goal, Typical. Nate's wider choices (repair, bundle, sell separately, consign, keep or donate) appear as a row under the cards when the data supports them. Relist timing is a hypothesis to measure, not a promise: "Do not assume relisting improves ranking" (Nate's research).

## Contract for the frontend

| Call | Returns |
|---|---|
| `POST /v1/items/:id/valuation` | `job` kind `valuate` |
| `GET /v1/items/:id/valuation` | `{per_site:[{site, range:{low, high, basis_count, as_of}, days_to_sell, net:{low, high, currency, shipping_cents, fee_cents}, fits, reason}], abstained?, next_question?}` |
| `GET /v1/items/:id/valuation/basis?site=` | comps: `{photo_url, price_cents, price_type, date, site, adjusted_cents, why_kept}` |
| `GET /v1/items/:id/strategies` | 3 plans, `suggested` id |
| `POST /v1/items/:id/strategy` | `{strategy_id, lowest_price_cents, always_accept_cents?}`; 422 `below_lowest` if always accept is under the lowest price |
| `PATCH /v1/strategies/:id` | pause, resume, edit a step |
| `GET /v1/fees?site=&price_cents=&ship_cents=` | `{net_cents, lines[], fee_table_version}`, for live edits |

Decision kinds: `price_below_lowest` (never promoted), `plan_end` (stale item: relist, new plan, or end).

## Who may act

| Action | Mode |
|---|---|
| Markdown on the plan's path, at or above the lowest price | `auto` ([decision](../../product/decisions.md#2026-11-14-buyers-are-handled-inside-limits-you-set-then-it-learns)) |
| Accept an offer at or above "Always accept" | `auto` once set at listing ([decision](../../product/decisions.md#2026-11-14-always-accept-is-offered-at-listing-and-only-unedited-approvals-count)) |
| Relist on schedule | `auto` where the site allows it; a relist that changes the listing id records both ids on the `listing` |
| Any price below the lowest price | `ask`, never promoted ([decision](../../product/decisions.md#2026-11-14-a-price-below-your-floor-always-asks)) |
| Changing the lowest price itself | the person only |

Policy check in code before each executor; idempotency key per markdown; the site is read back to confirm the price.

## How it fails

| Failure | Person sees | Recovery |
|---|---|---|
| Too few sales | "Not enough sales to price this" and one question | answer, or deep search job |
| A source down or blocked | that site's range marked "older" with its date | next run; other sites unaffected |
| Identity unsure | "Which one is it?" with 2 or 3 product photos | the pick becomes a `you_said` attribute |
| Fee table out of date | nothing; a check flags rows older than 90 days | owner updates the row |
| Markdown not confirmed on read-back | Today card "Price change didn't go through" | retry with same key, reconcile job |

## How we will know it works

| Claim | Check |
|---|---|
| Ranges are honest | on 40 to 60 of our own items and a backtest of sold listings, 7 in 10 sale prices fall inside the range; MdAPE reported per category ([VE](../../research/price/ben/valuation-engine.md)) |
| Abstain is right | share abstained, and error on items just above the threshold |
| Days to sell holds | median error in days on sold items, with unsold items counted as censored at their end date, not dropped |
| You keep is right | computed net against payout read from each site's finances or sales report, to the cent |
| Plans help | sale rate and net per plan; how often the suggested plan is picked and left unedited |

**Learning.** Every outcome is a label: sold price and days, offers received, markdowns that preceded a sale, and unsold items as censored observations ("Do not evaluate only successful sales", Nate's research). These refit the price-to-days curve per category and the site ratios. Our own outcomes are the data no rival has ([CS](../../research/price/ben/comps-sources-live.md)).

## Facts that constrain it

| Source | Route | Rights limit |
|---|---|---|
| eBay sold | Marketplace Insights (Limited Release), or paid scrapers (Apify, SoldComps, CompsAPI, 130point) | licence bars price modelling from eBay content and comparing eBay to others ([CS](../../research/price/ben/comps-sources-live.md), [platform-access](../../research/connect/nate/platform-access.md)); Best Offer accepted price hidden ([sold-price-data](../../research/price/ben/sold-price-data.md)) |
| eBay active | Browse API, `watchCount`, image search | 6h / 24h freshness, no co-mingled public display |
| Poshmark | sold via `availability=sold_out` | terms of use |
| Mercari | scraper actor, about 45% success; listings purge after about a year | terms of use |
| Depop | no keyword sold route | ratio from Poshmark and Grailed |
| Grailed, Facebook, OfferUp | Algolia; GraphQL with days on market; active only | terms of use |
| Category sources | Discogs, PriceCharting (internal use only), StockX, Reverb, WorthPoint, Exa Websets | per source ([CS](../../research/price/ben/comps-sources-live.md)) |

Wider sources Nate asks for ([words](../../product/words.md#2026-11-14-nate-frameworks-and-goals)), what each honestly adds: retail price sets a ceiling and depreciation baseline, never a value; price history (PriceCharting, StockX, our own Delta) gives the trend and time factor; finance and sales databases add little for single used items beyond those. "A measured price advantage" from more sources is not established (Nate's research). Fees, fee bases and tax lines: [fees-and-taxes](../../research/price/nate/fees-and-taxes.md); the app shows records, not tax advice.

## Demo path

For Ben and Nate to mark.

## Open for Ben and Nate

| Question | Recommendation | Depends on it |
|---|---|---|
| The eBay licence bars modelling prices from eBay content. Model from non-eBay sources and show eBay sales only as a separate shelf, or apply to eBay for permission? | show eBay separately and apply; the model trains on other sites and our outcomes | the largest sold source, and the range on eBay |
| Three named plans (Ben: "Sell this week", "Get the most") or Nate's wider list (repair, bundle, consign, keep)? | three cards plus a row of the wider choices when data supports them | Plan screen, `strategy.objective` values |
| Suggest from the monthly goal? Nate asked for goals; Ben has not answered. | yes, Typical when no goal | `goal` entity, suggested pill |
| Is Mercari in? ([vision](../../product/vision.md#open)) | keep its fee row; it changes nothing else | site fit table |
| Business: paid comp sources cost per call; a premium deep search or paid data could earn. | note only | cost per valuation |

## Needs from the shared model

- `valuation` per site needs `days_to_sell`, `net`, `fits`, `reason`, `fee_table_version` and an `abstained` reason.
- A `fee_table` entity (site, version, base, valid dates). The frame has none.
- `strategy` needs a state (`active, paused, done, replaced`) and a `follow_ups[]` schedule with times.
- Decision kind `plan_end` for a stale item.
