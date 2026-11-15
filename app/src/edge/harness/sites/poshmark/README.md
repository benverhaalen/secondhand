# Poshmark harness

This is the operating design for each kernel verb on Poshmark (spec/product.md#the-harness-protocol). The evidence is anonymous Browser Use Cloud recon and live runs on 2026-11-15 (research/cross-cutting/nate/runs/ad-poshmark.md), plus Poshmark's own terms and help pages, cited below.

The code is in `adapter.ts`, which defines the verbs, manifests, parsers, the Offer to Likers checks and the watch snapshot. `live.ts` proves the public reads on one cloud browser. `recon.ts` records a page and its client calls. `fixtures/` holds reduced real pages, with handles hashed as `h` plus 8 hex characters and no names, bios, pictures or descriptions. The signed-in `.json` fixtures are synthetic and marked as such. Route ids are `poshmark.<verb>.<route_kind>`.

## How it runs for the person

The person links Poshmark once, by signing in on the web inside our app, and opts in to the verbs they want. From then on every verb, share included, runs in the background on that stored web session over days and weeks. No one has to leave the platform (Nate, 2026-11-15, via the coordinator).

- A challenge or a login wall pauses the job and asks the person. It is never solved or routed around.
- Only the public site and the person's own signed-in web session are used. No mobile-app API is used.
- Payment, address, purchase and account-deletion controls are never touched.
- Every write is dry by default until Nate says go.

## How Poshmark answers (observed 2026-11-15)

- Every public page carries its data in `window.__INITIAL_STATE__=` up to `};(function`. Read the **navigation response body**, not `page.content()`. After hydration the DOM no longer holds the state script: `content()` gave 0.7 to 0.9 MB with no state, and the response gave 2.4 to 4.4 MB with it.
- The data paths are:
  - search: `$_search.gridData.{data, more.total}`;
  - one listing: `$_listing_details.listingDetails`, comments included;
  - a closet: `$_closet.closetUserInfo.data.aggregates` and `$_closet.listingsPostData`.
- `/listing/<id>` answers 301 to the slug url.
- A search with no hits still renders about 2 suggested rows, but `more.total` is 0, and the harness returns ok [].
- Status mapping:

| status | result |
|---|---|
| 401 | auth_expired (relink) |
| 404 | not_found (stillUp returns gone instead) |
| 410 | page_changed |
| 429 | rate_limited |
| any other status of 400 or more | blocked (pause the session) |
| challenge text | blocked |
| missing marker or field | page_changed |

### Search sorts (`sort_by` values observed in recon)

| value | meaning |
|---|---|
| relevance_v2 | relevance; the default for a query |
| best_match | the label is "Just Shared" |
| added_desc | the label is "Just In" |
| price_desc | price, high first |
| price_asc | price, low first |
| price_drop | price drops |
| like_count | most likes |

Sold search is `availability=sold_out`. An unknown sort is refused as `missing_input`.

## Terms and automation policy (data, shown to the person at opt-in; fetched 2026-11-15)

These are facts the person sees at opt-in. They do not shape the build.

| source | what it says |
|---|---|
| [Terms of Service](https://poshmark.com/terms), v4.6, dated October 3, 2024 (page header: "Effective June 3rd 2025") | §4 forbids to "copy, scrape, harvest, crawl or use any technology, software or automated systems to collect any information or data for the Service". §16: "We may suspend or terminate your Account at our discretion without explanation, notice". |
| [Community Guidelines](https://poshmark.com/community_guidelines) | "we don't allow Poshers to use unauthorized programs or other forms of automation to participate on Poshmark. This includes, but is not limited to, deleting and reposting content, liking, sharing, following, and unfollowing." |
| [Seller Policy](https://poshmark.com/terms#seller-policy), v3.9, effective July 23rd 2026 | "Sellers are prohibited from excessive listing removal and reposting of the same or similar listings." Also: "Once you accept a Buyer's offer, a binding transaction also exists." |
| [Fee Policy](https://poshmark.com/terms#fee-policy), v1.7, effective Nov 25th 2024 | "For sales under $15, the fee is a flat rate of $2.95. For sales $15 and above, the fee is 20%". |

## The four facts

1. **The minimum listing price is not $15.** $15 is the fee threshold: below it the fee is a flat $2.95, and from $15 up it is 20% (Fee Policy). No page fetched states a minimum price. `MIN_PRICE_CENTS = 300` ($3) is asserted from common knowledge and unverified. It is checked on the signed-in listing form.
2. **Offer to Likers** must be at least 10% below the listing price, or below the lowest offer in the past 90 days. Per [support article 759242802](https://support.poshmark.com/s/article/759242802), it "must include a shipping discount" and expires after 24 h. Open conflict: support article 831745541 reportedly says no shipping discount is required. `likersOffer` requires a reduced or free shipping discount, the stricter reading, until a signed-in form settles it.
3. **Smart Sell is still the name** ([blog, July 1 2025](https://blog.poshmark.com/smart-sell/); [support](https://support.poshmark.com/s/article/What-is-Smart-Sell): "Smart Sell will send or counter offers through Offer to Likers on single listings"). It asks for a "Lowest Price". The Seller Policy also mentions Smart List AI.
4. **A comment is not a message.** Comments are public on the listing, and an @username tag notifies that user. Private messages exist only on an order ([How to message](https://support.poshmark.com/s/article/How-to-message)). `send_message` therefore posts a public comment unless `order_id` is given, and the plan says `public: true`.

**Relist is never a fallback.** Poshmark has no relist button: a relist is delete plus repost, which the Seller Policy prohibits when excessive, and spec/sites.mjs marks `relist.penalized`. `relist` is refused as `relist_penalized` unless `person_asked` is set.

## Public reads (built, proved live 2026-11-15)

| verb | route | live result (count, ms) | account risk | breaks when |
|---|---|---|---|---|
| search (active) | page `/search?query=`; `$_search.gridData` | 48 rows, about 2.0 to 2.5 s | none: no account is used | the state key or `gridData` moves |
| search (sold) | page with `availability=sold_out` | 48 rows, about 1.8 to 2.0 s | none | the same |
| search (sorted) | `sort_by=` from the table above | 48 rows, about 1.8 to 2.8 s | none | a sort value is renamed |
| read one listing (`readListing`) | page `/listing/<id>`; `$_listing_details.listingDetails` | 1, about 1.4 to 1.7 s | none | the key moves |
| still up (`stillUp`) | the same page; `inventory.status` is available, sold_out or other; 404 is gone | 1, about 1.2 to 1.3 s | none | that a deleted listing answers 404 is not yet observed |
| comments (`readComments`) | the same page, `comments[]`; author handles hashed | 0 to 3 (3 in the fixture), about 1.3 to 1.4 s | none | the key moves |
| read_storefront | closet page; `closetUserInfo.data.aggregates` | followers, following, review_count (5-star count), sold_count (orders shipped), active_count, sold_display, vacation, last_active_at; about 1.4 to 1.5 s | none | the aggregates keys are renamed |
| read_listings | closet page, active and sold (`availability=sold_out`) | 46 rows, about 1.9 to 2.5 s | none | shortcut: the first page of each status only |
| reviews (`readReviews`) | none: love notes are empty in the closet state and `/closet/<u>/love_notes` answers 404 | no_route with a handoff to the closet | - | - |

Views and watchers on the person's own listings need a session.

## Signed-in verbs (built on fixtures; not proved live because no account is linked)

All of these run in the background on the stored session after the person opts in. With no session, they return auth_expired with `do: relink`.

| verb | design | account risk |
|---|---|---|
| read_inbox | endpoint `PATHS.inbox`, unobserved guess | low: a read |
| read_offers | endpoint `PATHS.offers`, unobserved; expires_at = `offerExpiresAt` (24 h, spec/sites.mjs); a cancelled offer is withdrawn | low |
| read_orders | endpoint `PATHS.orders`, unobserved | low |
| read_stats | endpoint `PATHS.stats`, unobserved | low |
| post | page `/create-listing`; photos, title, description, category, size, condition, price of at least the floor and at least `MIN_PRICE_CENTS`; stop before List | medium: posting is normal, the volume is paced (6 a minute) |
| revise | page `/edit-listing/<id>`; one step per changed field; stop before Update | medium |
| end | edit page, Delete Listing; stop before the confirm | medium |
| relist | delete plus repost, only when the person asked; stop before List | **high**: the Seller Policy and the Community Guidelines both name it |
| send_message | a public comment on the listing, or an order message at `/order/sales/<id>`; stop before Post or Send | medium |
| answer_offer | the offer, Accept, Decline or Counter; refused after 24 h; stop before the confirm. Accepting is binding (Seller Policy). | medium; binding |
| make_offer | Offer to Likers, checked by `likersOffer` (at least 10% under the price and the lowest price, a shipping discount, not promised elsewhere); stop before Submit | medium |
| save | the listing heart (like); stop before the tap | **high**: liking is named in the Community Guidelines |
| share | `share(...)`, Share, To My Followers; stop before the tap. Not a kernel verb yet, so it is exported beside the adapters behind the same dry gate | **high**: sharing is named in the Community Guidelines. Poshmark states no cap. |

- Every write is dry by default. It returns `{dry, url, steps, request}`, and the last step is "stop before" the submit.
- A price under `floor_cents`, or with no floor, is refused before any step.
- A real write (`dry:false`) has two outcomes:
  - with no session, it returns auth_expired;
  - with a session, it returns no_route with a handoff, until a submit is observed with a linked account.
- The signed-in manifests are version 0.1.0 so that a recorded route can replace them.

## Recon with a linked account still has to settle

- the real signed-in paths, which replace `PATHS` and the synthetic fixtures;
- each submit, which turns no_route into a route;
- the minimum price on the listing form;
- whether Offer to Likers requires a shipping discount;
- views and watchers on your own listings.
