# Buy
Status: draft, *agent proposal* except where a line links a decision. Slug: buy (proposed, no feature page yet). Written 2026-11-14.

The hassle: buying used means searching five apps that each describe the same thing differently, guessing whether a price is fair, working out shipping and fees by hand, messaging sellers one by one, and not knowing which site would let you return it. Buy is one search box that knows what the thing is and what it is worth, and an agent that does the legwork up to the moment you pay. Buying is a full side of the app, run by the same engine as selling ([decision](../../product/decisions.md#2026-11-14-selling-comes-first-buying-is-a-full-side)).

## What the person does and sees

The Buy tab mirrors Sell: a search box with a camera and a link field, then the shelves New matches, Watching, Bought ([decision](../../product/decisions.md#2026-11-14-the-buy-tab-mirrors-sell-with-shelves)). Lines from Nate's buying proposal ([vision Proposed](../../product/vision.md#proposed), [words](../../product/words.md#2026-11-14-nate-store-and-buying)) are marked Nate; Ben has not answered them.

| Step | The person | They see |
|---|---|---|
| 1 | Types, photographs, or pastes a link ([search box](../../product/words.md#2026-11-14-search-box), [appraise from Buy](../../product/words.md#2026-11-14-appraise-from-buy)) | First, what it is: the product identified by capture or lookup, the same engine as selling ([Nate](../../product/words.md#2026-11-14-nate-vision)). One chip to correct it. |
| 2 | Waits about 2 seconds | The buyer's Valuation card: fair price and the most to pay; how many are out there, per site, "as of" a time; the price range; price history. Sites fill in as they answer. |
| 3 | Scrolls | The best ones, ranked by delivered total against fair value, each with its match label, return terms and seller terms. Then "Similar for less": equivalents in quality and material ([Nate](../../product/words.md#2026-11-14-nate-store-and-buying)). |
| 4 | Taps Save on a listing | It goes to Watching; where the site allows, it is also liked, watched or carted on the site (Nate). |
| 5 | Taps Ask or Offer | The agent asks the seller a question or makes offers up to a ceiling the person sets (Nate). Replies land in the chat icon. |
| 6 | Taps Buy | The listing opens on its own site to pay. We never take payment ([Nate](../../product/words.md#2026-11-14-nate-store-and-buying)). |
| 7 | Comes back, taps "Bought it" | The item joins Bought with its cost, and can become "Sell this" ([decision](../../product/decisions.md#2026-11-14-the-buy-tab-mirrors-sell-with-shelves)). |
| 8 | Opens "For you" | A shelf built from their listings, sizes, brands, watches and imported past purchases (Nate). Never their own items. Each card says what it inferred ("your size M, from 6 items"); one tap resets it. |
| 9 | Sells something they still need (a desk, a phone) | A "Replace it?" card with matches under the sale price (*agent proposal*). |

Match labels, shown on every card: exact match, likely same model, same family, different variant, comparable substitute, looks similar but unverified. "Similar for less" only shows comparable substitutes whose material and condition are known, and it says which is which.

Delivered total = price + shipping + fees and tax where the site charges them. Local pickup shows distance instead of shipping. Return terms come per site: a Facebook local pickup carries no protection, and Poshmark does not cover fit ([trust note, section 9](../../research/sold/nate/trust-returns-disputes.md#9-buyer-protection-per-marketplace-and-what-voids-it), *observed* and *asserted*).

Where Ben's design makes a person stumble:
- We never see the payment, so "Bought" needs the person to tap "Bought it". Proposal: when they return from a link-out, ask once, "Did you buy it?"; on sites with order read access, confirm it from the site.
- Ben's shelves have no "For you". Proposal: a fourth shelf, shown only after the person opts in, because it uses inferred personal data.
- New matches and Watching overlap (see the watch spec).

What the backend makes possible that the design does not use yet: delivered total and return terms per match; replace-after-sale; "Bought" items that already carry their purchase cost when they come back to be sold.

## What it reads and writes

| Entity | Fields used here |
|---|---|
| `product` | Resolved identity: brand, model, variant, GTIN; `confidence`. |
| `capture`, `photo` | Photo searches (same capture engine as selling). |
| `valuation`, `comp` | Fair range per site, history, demand counts; every live listing seen is a comp. |
| `match` | `id`, `source search|want|for_you|replace`, `site`, `site_id`, `url`, `product_id`, `label`, `total {price, shipping, fees, tax, shipping_known}`, `return_terms`, `seller_terms`, `saved`, `saved_on_site {state, at}`, `cluster_id` |
| `want` | Created by Watch or by replace (`source=replace`). |
| `conversation`, `message`, `offer` | Buyer-side threads with sellers; `offer.direction=outgoing`. |
| `limits` | Buy ceiling per match or want. |
| `order` | A purchase: `kind=purchase`, `site`, `match_id`, `paid_total`, `paid_at`, `source user_said|site_read|imported`. |
| `item` | Created from a purchase order in `researching`, with purchase cost as an attribute (`source=you_said` or `marketplace`). |
| `user` preferences | Inferred sizes, brands, price band, each a provenance value; `for_you_opt_in`, reset time. |

## States

| Thing | States | Moves on |
|---|---|---|
| search (`job`, kind `search`) | stages `identify`, `fetch`, `dedupe`, `value`, `rank` | each site's deadline |
| match | `found`, `saved`, `asked`, `offered`, `bought`, `dismissed`, `gone` (*agent proposal*) | person taps, seller replies, re-fetch |
| `saved_on_site` | `none`, `pending`, `done`, `failed`, `unsupported` (*agent proposal*) | adapter result, read back |
| purchase `order` | `paid` then `shipped` or `handed_over`, `delivered`, `claim_window`, `released`, or `return_open`, `dispute_open`, `refunded` | "Bought it", site read, person taps |
| item from a purchase | `researching`, `review`, then the selling path, or `kept` | "Sell this" |

## Systems underneath

| Piece | Does here |
|---|---|
| Capture and identify | The selling engine; Lens and eBay image search for photos; per-site link parsing ([routes](../../research/watch/ben/fanout-and-watch-loop.md#paste-a-link)). |
| Fan-out search | Our own index answers at once, then each site within a deadline, streamed in batches with a status chip per site ([one search box](../../research/watch/ben/one-search-box.md)). |
| Price engine | Fair range, history, the most to pay and a buy, offer, skip or unsure verdict in code ([appraisal run](../../research/appraise/ben/appraisal-run.md)). |
| AI Search | Similar-item and substitute retrieval; "For you" candidates from embeddings of the person's items. |
| Marketplace adapters | Search everywhere; save, like, cart, message and offer through each site's official API or a cloud browser holding the person's login ([harness decision](../../product/decisions.md#2026-11-14-each-marketplace-gets-its-own-harness-run-on-browser-use-cloud)). |
| Agents | Draft seller questions and offer messages; read replies. Offers stay under the ceiling by code. |
| Lakeflow jobs | Purchase history import; re-fetch saved matches; reconcile saved-on-site state. |
| MLflow 3 | "Why this one?" on every ranked card. |

## Contract for the frontend

| Call | Shape |
|---|---|
| `POST /v1/search` | `{query?, photo_upload_id?, url?}` returns a `job`; SSE events `identified {product, confidence, alternatives}`, `site {site, state, count}`, `batch {matches}`, `valuation {range, history, max_pay, verdict}` |
| `GET /v1/search/:job/matches?group=best|similar` | ranked `match` list |
| `POST /v1/matches/:id/act` | `{action: save|unsave|ask|offer|bought|dismiss, text?, ceiling?, paid_total?}`; `save` returns `saved_on_site.state` |
| `GET /v1/matches/:id/link` | the site URL to pay |
| `GET /v1/buy/for-you`, `DELETE /v1/buy/for-you/profile`, `PATCH /v1/buy/for-you/profile` | shelf; reset; edit inferred values |
| `POST /v1/imports/purchases` | `{account_id}` returns a `job` |
| Decision kinds | `offer_over_ceiling`, `seller_counter`, `did_you_buy`, `replace_after_sale` |

A price range is `{low, high, basis_count, as_of, per_site}`. Counts read "N found on <sites searched> as of <time>", never a sum across sites as if complete, and a range is hidden under about 6 data points ([analytics note, section 6](../../research/data/nate/analytics-and-recommendations.md#6-closing-table-inferred)).

## Who may act

| Action | Mode |
|---|---|
| Search, read, rank | `auto` |
| Save on the site (like, watch, cart) | `ask` the first time per site, then `auto` once the person turns it on (Nate's proposal) |
| Ask a seller a question | `ask`, promotable after 3 unedited approvals ([decision](../../product/decisions.md#2026-11-14-always-accept-is-offered-at-listing-and-only-unedited-approvals-count)) |
| Make or counter an offer | `auto` under the person's ceiling for that match (Nate); above it, `ask` |
| Accept a seller's counter that binds a purchase | locked |
| Completing a purchase, paying | locked, always the person |
| Moving a deal off the site | locked ([trust note, section 7](../../research/sold/nate/trust-returns-disputes.md#7-prohibited-and-restricted-items-off-platform-deals)) |
| Sharing an address | locked |
| Sharing inferred sizes with a seller | `never` |

A recommendation is never permission to buy. Committed spending (offers out) is tracked apart from money the person has not yet received from sales.

## How it fails

| Failure | The person sees | Recovery |
|---|---|---|
| Product not identified | "Which one?" with 3 candidates | Their pick is a label |
| A site times out | Its chip greys, "Mercari: no answer" | Results from the rest; retry tap |
| Save on site fails or is not supported | "Saved here only" | `saved_on_site=failed|unsupported`; retried by reconcile |
| Seller accepts an offer | A Today card "Pay on Depop by 6 pm" | Link out; the purchase stays with the person |
| Listing gone | Greyed card, "sold" | `gone` |
| Person forgets "Bought it" | A `did_you_buy` card after the link-out | Or a site read |

## How we will know it works

| Claim | Check |
|---|---|
| Identifies the product | Top-1 identity right on 50 real searches (typed, photo, link). |
| Fair price | Share of "Bought" items that resell within the shown range. |
| Delivered total is right | Our total vs the site's checkout total on 30 link-outs: within $1. |
| Similar for less is honest | People keep at least as many substitutes as exact matches (returns and "not the same" labels). |
| For you excludes own items | Zero own items across 1,000 shown cards (seller account plus image and GTIN match). |
| Save mirrors the site | `saved_on_site=done` confirmed by reading the site back. |

## Facts that constrain it

- Buyer-side site actions (like, watch, cart, buyer offers, purchase history) have no official API in our research; the seller-side offer APIs exist ([platform-access](../../research/connect/nate/platform-access.md), *observed*). Each is a cloud-browser route to verify.
- Buyer protection and what voids it, per site ([trust note, section 9](../../research/sold/nate/trust-returns-disputes.md#9-buyer-protection-per-marketplace-and-what-voids-it)).
- eBay's licence limits price modelling with eBay content, mixing eBay listings into one public display and keeping listing data more than 6 hours stale ([comps-sources-live](../../research/price/ben/comps-sources-live.md), *observed*).
- What a person sells is not what they buy; inferred sizes are personal data ([analytics note, section 5](../../research/data/nate/analytics-and-recommendations.md#5-recommendations-how-marketplaces-personalise-and-cold-start), *inferred*).
- No competitor joins search to valuation ([one search box](../../research/watch/ben/one-search-box.md), *agent proposal*).

## Demo path

For Ben and Nate to mark.

## Open for Ben and Nate

| Question | Recommendation | Depends on it |
|---|---|---|
| Does the agent ask sellers questions and make offers under a ceiling? Nate picked "Also negotiate for me" ([words](../../product/words.md#2026-11-14-nate-store-and-buying)); Ben has not answered. | Yes, offers `auto` under a per-listing ceiling, questions `ask` until promoted. | Buyer threads, `offer.direction`, agent drafts |
| Does Save also like, watch or cart on the site? Nate proposed it; Ben has not answered. It runs a cloud browser on the person's account, with a ban risk. | Opt in per site, with that risk stated. | `saved_on_site`, adapters |
| Is "For you" a fourth shelf? Ben's shelves are New matches, Watching, Bought; Nate's proposal adds it. | A fourth shelf, opt in, after the first sale or import. | Buy tab layout |
| Import past purchases: no API found. | A cloud-browser read per site, opt in. | Import job |
| eBay matches in one ranked list with other sites, given the licence. | A separate eBay group until eBay's terms are checked. | Ranking |
| Business model: a referral or affiliate link-out would pay per purchase; whichever is picked, it must never decide what "best" means. | Not picked. | Ranking |

## Needs from the shared model

- `match.source` (`search|want|for_you|replace`), `match.label`, `match.total` with fees and tax, `return_terms`, `seller_terms`, and `saved_on_site {state, at}`.
- A purchase `order` (`kind=purchase`, `source user_said|site_read|imported`) that starts at `paid` with no payment of ours, and creates an `item` in `researching` with its purchase cost.
- `offer.direction` (`incoming|outgoing`) and the buy ceiling per match in `limits`.
- `want.source=replace`, created from a sold item.
- User shopping preferences: inferred provenance values, opt-in and reset time, and a fit profile (shared with watch).
- A `purchase_import` job kind, and buyer-side rows in each `account`'s capability table (save, like, cart, buyer offer, read orders).
- Decision kinds `offer_over_ceiling`, `seller_counter`, `did_you_buy`, `replace_after_sale`.
