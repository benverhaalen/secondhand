# Insights
Status: draft, *agent proposal* except where a line links a decision. Slug: insights (a proposed new slug; there is no `features/insights/` page yet). Written 2026-11-14.

Nate: "set goals on how much they want sold" ([words](../../product/words.md#2026-11-14-nate-frameworks-and-goals)). Ben put earned, count, potential and insights in You, and By site shows how fast each site sells and at what share of the asking price ([decision](../../product/decisions.md#2026-11-14-the-you-tab-leads-with-numbers-and-a-by-site-comparison)). Where this page differs from Ben's earlier plan, those decisions win. Data underneath: [data](data.md).

## What the person does and sees

All in the You tab. Every number is one tap from its source rows, and a number with no source is a marked empty slot, never a guess ([copy](../../product/copy.md)).

| Step | They see |
|---|---|
| 1 | Top: "You kept $X" (paid out), then "On its way $Y" (sold, not yet paid out), then "Could earn $A to $B" on live items |
| 2 | Sold count, total listed value, goal bar if a goal is set |
| 3 | By site: days to sell and share of the asking price, per site |
| 4 | Per item, on its card: views and likes where the site reports them, offers and messages we received, days listed |
| 5 | Per product, "Market": similar ones sold, for sale now, who is watching |
| 6 | "Fees and records": fees paid, cost, a downloadable record, a plain note on tax forms |

A sale ends on the amount kept, no confetti, no streaks, no countdowns, no guilt copy. Payouts are one quiet line on Today ([today](today.md)).

Where Ben's design could trip someone: "Earned" and "Could earn" have no spec yet, and a person who sold on Facebook sees nothing paid out unless we ask them. The backend allows an honest "On its way" line and a goal pace in plain arithmetic, which Ben's tab does not yet use.

## Each number

| Number | Source | Wording | Hidden when |
|---|---|---|---|
| Kept | `order` with a payout, minus fees | "You kept $X" | no payout recorded; a person's tap on "I got paid" counts as *you said* |
| On its way | `order` paid but not released | "On its way $Y" | none; never added to Kept |
| Could earn | `valuation` range of live items, less estimated fees | "Could earn $A to $B" | an item has no range (fewer than about 6 sold) |
| Listed value | our own listing prices | "Listed for $X" | never |
| Sold count | `order` reaching paid | "N sold" | never |
| Days to sell | our `event`s | "Sold N days after you listed it" | listing made outside the app and no list date |
| Share of asking | sold price over last ask | "Sold at N% of asking" | fewer than about 6 sales on that site |
| Own views, likes | eBay traffic report; Etsy `views`, `num_favorers` | "Views as reported by <site>, updated <time>" | other sites, unless typed in |
| Own messages, offers | our inbox adapters | "N offers we saw since you linked" | site not read by us |
| Retail price | retailer page | "Listed by <retailer> at <price> on <date>" | no page matched |
| Competing asks | eBay Browse, own searches | "Asking prices of N live listings, lowest X, median Y" | fewer than about 6; never shown as sold |
| How many sold | Marketplace Insights (gated, 90 days) or our own sales | "N sold on eBay in the last 90 days" | only `estimatedSoldQuantity`; Facebook; sold hidden |
| Watching | eBay `watchCount`; Depop likes | "N people are watching the live listings" | App Check not granted; few listings |
| Search interest | Google Trends (alpha) | "Google search interest is higher or lower than <name2> over 5 years" | no access; ambiguous name |
| For sale now | Browse total plus own searches | "N live listings found on <sites> as of <time>" | a site unreachable; never summed as complete |
| Sell-through | own calculation | "Of N similar items, M sold in the last 90 days" | window, denominator or formula unknown; over 100% |
| Price range | sold comps | "Similar ones sold for $36 to $52 lately" | below the minimum; no sold data |

Marks: the first block is *inferred* from our own events; the market rows are from the closing table of [Nate's note](../../research/data/nate/analytics-and-recommendations.md) (*observed* and *asserted* per row there). Can never be known: search volume on closed marketplaces, sold counts on Facebook, Poshmark and Mercari beyond what we saw disappear (an undercount, so labelled so), offers and messages on others' listings.

## What it reads and writes

| Entity | Use |
|---|---|
| `order`, `event`, `listing`, `valuation`, `comp`, `offer`, `conversation` | read; numbers are derived, not stored twice |
| `goal` | written by the person: target, deadline, and Nate's fields (items eligible, items excluded) |
| `attribute` `cost_basis` | written by the person, `you_said`, optional |
| `order` money lines | written by import: fee by type, shipping, tax, refund, payout, each with source `api | csv | typed | estimated` |

## States

| Thing | Moves |
|---|---|
| Number | `known`, `estimated`, `missing`; an estimate becomes `known` when the site's actual figure arrives |
| Money | estimated, offered, accepted, paid, available, settled, kept as separate states (Nate); only a recorded payout is Kept |
| Goal | `active`, `reached`, `ended`; a refund after a payout lowers progress with an `event` |

## Systems underneath

| Piece | Job |
|---|---|
| Lakebase | numbers are queries here, never Delta, so they are never stale |
| Delta | By site and market rollups, comp history |
| Lakeflow | payout poll, fee report import, comp refresh ([data](data.md)) |
| Fee routes | eBay Sell Finances (lagging); Depop partner API or CSV; Mercari Gross Sales Report; Poshmark CSV; Facebook none found |
| Genie | free questions; answers show their rows |

## Contract for the frontend

| Endpoint | Returns |
|---|---|
| `GET /v1/you` | each number as `{value, source, as_of, state, why_missing?}` under `kept, on_its_way, could_earn, listed, sold_count, goal, by_site[]` |
| `GET /v1/numbers/:id/rows` | the rows behind a number |
| `GET /v1/items/:id/market` | the market block for the item's `product` |
| `PUT /v1/goal` | `{target_cents, currency, deadline, basis}` |
| `PUT /v1/items/:id/cost_basis` | `{cents, how}` |
| `GET /v1/records?tax_year=` and `.csv` | sales, fees, basis, gain or loss, labelled a record |

The tax note names its source and date, read from a stored citation, not typed into the app: for tax year 2026 the IRS says a 1099-K needs more than $20,000 and more than 200 transactions, a form can arrive below that, some states set lower limits, and a gain is taxable with or without a form (*observed*, [fees and taxes](../../research/price/nate/fees-and-taxes.md)). The app never says whether a sale is taxable to this person, whether they are a business, or what to file.

## Who may act

| Action | Mode |
|---|---|
| Compute and show numbers | auto |
| Set a goal, enter cost, mark "I got paid" | the person |
| Export records | the person |
| Push | auto only for an offer at or above the lowest price, a deadline, or a pickup; all else batched about 3 times a day ([copy](../../product/copy.md)) |

## How it fails

| Failure | They see | Recovery |
|---|---|---|
| No payout data on a site | "On its way", plus "Got paid?" | their tap, stored as `you_said` |
| Fee report late | fee marked "estimated" | replaced by actual; difference logged |
| Refund after payout | Kept goes down, step in "Why?" | `event`, never silent |
| Site unreachable | its row marked "as of <time>" | next poll |
| Import mismatch | the line stays "estimated" | person can correct; correction kept as `you_said` |

## How we will know it works

| Claim | Check |
|---|---|
| Every number has a source | scan `/v1/you` on real accounts: zero values without `source` |
| Kept is right | equals the sum of real payouts to the cent on test accounts for eBay, Depop, Mercari, Poshmark |
| Unpaid never counts | a fixture order in `claim_window` leaves Kept and goal unchanged |
| Hiding works | fixtures with 5 sales, a missing list date, `estimatedSoldQuantity` only: each renders an empty slot |
| Fee estimates are fair | median estimate-versus-actual difference per site, from imports |
| No nagging | pushes per user per week; share of opens that follow a real event; opt-outs |

Retention here is a hypothesis (*agent proposal*, Nate): people return when something real happened to their things, not for a streak. The reasons we serve are understanding activity, reaching a goal, deciding whether to wait, and finishing transactions. Not sent: empty engagement alerts, price-fluctuation spam, pressure to replace things.

## Facts that constrain it

| Fact | Mark | Source |
|---|---|---|
| No API for messages or offers on any marketplace; Poshmark, Depop, Mercari, Facebook, Vinted have no analytics API found | asserted | [analytics](../../research/data/nate/analytics-and-recommendations.md) |
| Depop partner API cannot pull analytics | observed | [Ben, local files](../../research/price/ben/comps-sources-live.md) |
| eBay licence limits cross-service performance comparison and pricing models; Ben's notes number the clause differently | observed, unresolved | same and [fees](../../research/price/nate/fees-and-taxes.md) |
| Fee base differs per site, so net needs shipping and tax | inferred | [fees](../../research/price/nate/fees-and-taxes.md) |
| Items under $15 sell within 30 days 8.6% of the time, $100 to $249.99 27.6% | observed (FlowLister) | [Ben](../../research/cross-cutting/ben/pitch-evidence.md) |
| Robinhood removed confetti after a regulator cited gamification | observed | [Ben](../../research/cross-cutting/ben/adjacent-references.md) |

## Demo path
For Ben and Nate to mark.

## Open for Ben and Nate

1. Cost basis. Ben: never ask what the person paid. Nate: basis reduces a taxable gain. Recommend: ask only in Fees and records, optional, after a sale, never in the selling flow. Depends on: gain or loss.
2. What a goal counts. Nate: "set goals on how much they want sold". Ben: "You kept $X". Recommend: the goal counts kept after fees, with the sold amount one tap away. Depends on: goal bar, Today.
3. By site and the eBay licence. Recommend: By site uses only our own measured times and prices, with no eBay-sourced statistics, until the clause is read. Depends on: By site.
4. Business: records export, Marketplace Insights and any analytics-linked fee change cost or pricing. Say, not picked.

## Needs from the shared model
- `order` money lines with `source`, a payout record with date, and `cost_basis` as an attribute.
- A number shape `{value, source, as_of, state}`.
- `goal` fields, and events `order.paid_out`, `order.fee_reported`, `goal.set`.
