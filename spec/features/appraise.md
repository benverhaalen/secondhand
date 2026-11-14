# Appraise
Status: draft, *agent proposal* except where a line links a decision. Slug: appraise. Written 2026-11-14.

At a garage sale, on a Facebook listing or holding a card, a buyer today guesses, or searches sold listings on a phone while the seller waits, and still does not know what they would keep after fees if they resold. Appraise answers in seconds: the most to pay, what it is worth on each site after its flaws, cheaper equal options, and the one check that settles the price. It is the same engine as [price](price.md), pointed at a thing you do not own ([decision](../../product/decisions.md#2026-11-14-selling-comes-first-buying-is-a-full-side)). Ben: "Appraise anything" ([words](../../product/words.md#2026-11-14-pavlo-and-appraise)). Nate: "negoitate at a garage sale, or check pokemon card investments... similar in quality... at lower prices" ([words](../../product/words.md#2026-11-14-nate-store-and-buying)). Feature page: [features/appraise](../../features/appraise/README.md).

## What the person does and sees

| Step | Where | What they see |
|---|---|---|
| 1 | Buy search: camera icon or pasted link; or ＋, "What's it worth" ([decision](../../product/decisions.md#2026-11-14-the-buy-tab-mirrors-sell-with-shelves), [bar](../../product/decisions.md#2026-11-14-the-bottom-bar-is-today--sell----buy--you)) | Camera opens; a link fills in the listing's photos and asking price |
| 2 | Valuation card, buyer framing | **Glance**, within 2 s: what it likely is and a rough range, marked estimated |
| 3 | Same card | **Check**, within 10 s: verdict pill (Buy, Offer, Skip, Unsure), "Pay up to $40", "Offer $30", and the range per site after flaws |
| 4 | Same card | One check: "Check the zipper works" or "Photo of the tag". Answering moves the numbers |
| 5 | Haggle pad | Type the seller's price; verdict and profit update at once, offline |
| 6 | Card sections | Cheaper equivalents (match label on each), price history line, recalls if any |
| 7 | **Deep**, minutes, on tap | full research job; the card updates when it arrives and a Today card says so |
| 8 | "Bought it" | enter what you paid; the item appears in Sell as `researching`, with photos and purchase cost carried over ([decision](../../product/decisions.md#2026-11-14-the-buy-tab-mirrors-sell-with-shelves)) |

Speed tiers are Ben's ([appraisal-run](../../research/appraise/ben/appraisal-run.md)). Batch: at a sale with many things, several photos in a row rank by profit per minute of effort ([garage-sale](../../research/appraise/ben/garage-sale.md)).

Where Ben's design would make a person stumble: "What's it worth" sits under ＋, which otherwise adds things you own, while the Buy camera does the same lookup; a person who taps ＋ for a thing they do not own may expect it to land in Sell. Recommendation: both open the same card, and nothing becomes an item until "Bought it" (or "Sell this" for a thing they already own). What the backend makes possible that the design does not yet use: the result can become a `want` with a watch ("Tell me if one shows up under $30"), and the price history line.

## What it reads and writes

| Entity | Reads | Writes |
|---|---|---|
| `capture`, `photo` | camera shots or link images | a lightweight capture (no item yet) |
| `product`, `comp` | identity candidates, comps | new comps with rights notes |
| `valuation` | | per site range after flaws, `max_pay`, `fair_offer`, `walk_away_above`, verdict |
| `match` | | the source listing (link case) and cheaper equivalents, each with a match label; can be saved |
| `want` | | on "Watch for this" |
| `item`, `attribute`, `event` | | on "Bought it": `item` with purchase cost, observed attributes carried as `inferred` or `you_said` |
| `limits` | buy ceiling | none |
| user setting | target profit (casual 0, reseller a set amount or share) | |

## States

| Move | Trigger |
|---|---|
| appraisal job stages `glance`, `check`, `deep` | each `started, running, arrived, failed` |
| verdict `unsure` to `buy | offer | skip` | answering the one check, or Deep arriving |
| new `item` in `researching` | "Bought it" |
| `match` saved | "Save"; *agent proposal*: also saves or likes it on its site (Nate's proposal, not yet answered by Ben, [vision](../../product/vision.md#proposed)) |

## Systems underneath

| Piece | Role |
|---|---|
| App API `appraise` | starts a job; Glance answers from AI Search over products and recent comps by image embedding |
| Model gateway | Haiku for Glance identity; Sonnet for Check reading listing text and flaws; Opus for Deep; bounded yes/no checks ("same model?", "flaw visible?") |
| Site adapters | read a pasted listing (eBay API, else cloud browser), search equivalents across the platform list ([decision](../../product/decisions.md#2026-11-14-the-platform-list-is-set)) |
| Plain code | `max_pay`, offer, walk-away, verdict, net per site, haggle pad (runs on the phone from the returned numbers) |
| Delta | price history from stored comps and category sources; labels from outcomes |
| MLflow 3 | trace per appraisal; the "why?" timeline |

The most to pay, from Ben's research ([appraisal-run](../../research/appraise/ben/appraisal-run.md)):
`max_pay = P(identity) x P(condition) x P(authentic) x net(best site, p25) - hassle - risk_margin - target_profit`.
Net uses the same fee table as [price](price.md). For a casual buyer target profit is 0 and the card frames "fair price"; for a reseller it shows profit at the asking price. Local or bulky things use asking prices only, labelled as asking ([garage-sale](../../research/appraise/ben/garage-sale.md)).

The one check is picked by value of information: the question whose answer would move `max_pay` most, at most 3 in a row ([appraisal-run](../../research/appraise/ben/appraisal-run.md)).

Cheaper equivalents: search on the factors Nate lists (identity, variant, condition, completeness, shipping, taxes, returns, authenticity, fit), ranked by total cost to the door, each labelled Exact verified, Likely same model, Same family different variant, Comparable substitute, or Visually similar unverified ([analytics](../../research/data/nate/analytics-and-recommendations.md)). Nate's couch: "A guy offers a couch for 3,000, but a scan shows one on ebay of the same type for less" is this section.

Price history: median sold price by month from our comps and category sources (PriceCharting, StockX, Discogs, [CS](../../research/price/ben/comps-sources-live.md)), with the dates it rests on; for cards and collectibles it is the main view.

## Contract for the frontend

| Call | Returns |
|---|---|
| `POST /v1/appraisals` `{photo_upload_ids[] | url}` | `job` kind `appraise`, stages `glance, check, deep` (deep only when asked) |
| `GET /v1/appraisals/:id` | `{identity:{product_id?, label, match_label, confidence}, verdict, max_pay_cents, fair_offer_cents, walk_away_above_cents, per_site:[{site, range, net, days_to_sell}], check?:{id, ask, kind: photo|yes_no}, equivalents:[match], price_history:[{month, median_cents, basis_count}], recalls[], basis}` |
| `POST /v1/appraisals/:id/answers` | new appraisal result |
| `POST /v1/appraisals/:id/deep` | job |
| `POST /v1/appraisals/:id/bought` `{paid_cents, currency}` | `{item_id}` |
| `POST /v1/appraisals/:id/watch` | `{want_id}` |

All money in cents; ranges in the frame's shape.

## Who may act

| Action | Mode |
|---|---|
| Appraising, searching, saving a match | `auto`, nothing outward |
| Save or like on the site | `auto` if the person turned it on (proposal) |
| Messaging a seller or making an offer under the buy ceiling | `ask`, per Nate's "Also negotiate for me" (Nate, [words](../../product/words.md#2026-11-14-nate-store-and-buying); not decided) |
| Completing a purchase, paying | locked to the person; they pay on the site |

A verdict is advice, not authorization to buy (Nate's research).

## How it fails

| Failure | Person sees | Recovery |
|---|---|---|
| Identity unresolved | "Unsure" pill and 2 or 3 candidates, no price | pick one, or the tag photo check |
| Too few sales | "Not enough sales to price this" | Deep, or watch |
| Link site blocked | "Couldn't open that listing" | photos of the screen instead |
| No signal at the sale | Glance from the cached on-phone index if present, else queued; haggle pad still works on the last numbers | runs when back online |
| Deep runs long | job card in Today | arrives later |

## How we will know it works

| Claim | Check |
|---|---|
| Max pay is safe | on 40 to 60 of our own items and a backtest, the share where a buy at `max_pay` would have lost money after fees; target set with Ben and Nate |
| Verdicts are right | live labels: every "Bought it" and its later sale ([appraisal-run](../../research/appraise/ben/appraisal-run.md)) |
| Speed tiers hold | p95 time to Glance under 2 s and to Check under 10 s from traces |
| The check is worth asking | how far the answer moved `max_pay`, per question kind |
| Equivalents are equal | share of Exact or Likely labels the person accepts |

## Facts that constrain it

- Comp rights and access per site: [price](price.md#facts-that-constrain-it).
- Existing appraisal apps do not cross-list or learn from outcomes ([existing-tools](../../research/appraise/ben/existing-tools.md)).
- An estimate is not an offer ([adjacent-valuation](../../research/price/ben/adjacent-valuation.md)).

**It must never claim:** a flaw is absent when it was not seen; an exact model without evidence; a price without the sales under it; that something is authentic; that it will sell; that buying is advised as an investment. These are code checks on the output, not prompt lines ([appraisal-run](../../research/appraise/ben/appraisal-run.md)).

## Demo path

For Ben and Nate to mark.

## Open for Ben and Nate

| Question | Recommendation | Depends on it |
|---|---|---|
| Does the agent make offers to sellers under a ceiling (Nate's "Also negotiate for me"), or only appraise? Ben has not answered. | appraise and draft the offer; sending is `ask` | buy-side messaging, `limits.buy_ceiling` |
| Who is the user: casual buyer or reseller ([vision](../../product/vision.md#open))? It sets target profit and the card's framing. | a setting, default casual | `max_pay`, verdict words |
| "What's it worth" under ＋ and the Buy camera: one card for both? | yes, nothing becomes an item until "Bought it" | ＋ sheet, Buy search |
| Business: links out to sites could carry referral fees; they must not decide which equivalent ranks first (Nate's research). | note only | equivalents ranking |

## Needs from the shared model

- An `appraisal` entity (or a `valuation` with no `item_id`, keyed by capture), with verdict, `max_pay` and the one check.
- A capture that exists without an item until "Bought it".
- User setting for target profit; `limits.buy_ceiling` per want.
