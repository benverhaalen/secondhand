# Depop harness

This is the operating design for each kernel verb on Depop (spec/product.md#the-harness-protocol). The plan calls this file OPERATING.md. The task brief names it README.md, and the brief wins. Evidence comes from anonymous Browser Use Cloud recon and the live runs on 2026-11-15 (research/cross-cutting/nate/runs/ad-depop.md).

The code is in `adapter.ts`, which defines the verbs, manifests, parsers and watch snapshot. `live.ts` proves the public reads on one cloud browser. `recon.ts` records the page and its client calls. `fixtures/` holds the reduced recordings: seller handles are hashed as `h` plus 8 hex characters, and no names, bios, pictures or descriptions are kept.

## How Depop answers (observed 2026-11-15)

- Plain server fetch is refused. Node fetch got 403 on both www.depop.com and webapi.depop.com. Every route therefore runs inside a cloud browser page on www.depop.com.
- The site is a Next.js app, and its data rides in `self.__next_f.push([1,"..."])` parts. The harness joins those parts and cuts out the object after a marker with a string-aware bracket count.
- From a www page, `fetch('https://webapi.depop.com/presentation/api/v1/...', {credentials:'omit'})` takes 120 to 180 ms. `credentials:'include'` fails CORS.
- The older `/api/v3/search/products/` answers 410 with code 9001. The harness maps a 410 to page_changed.
- Status mapping:

| status | result |
|---|---|
| 401 | auth_expired |
| 404 | not_found (stillUp returns gone instead) |
| 410 | page_changed |
| 429 | rate_limited |
| any other status of 400 or more | blocked |
| challenge text | blocked |
| missing marker or field | page_changed |

- research/list/ben/platforms/depop.md notes that API partners are barred from browser automation. This harness has no partner API and acts only for a linked account, from that account's stored sign-in.

## Public reads (built, proved live 2026-11-15)

| verb | fastest route | public | breaks when |
|---|---|---|---|
| search (active) | page `/search/?q=`; flight object after `{"meta":{"total_count"`; 24 rows, about 1.5 s | yes; rows have no title, so the slug stands in | the marker moves, or the flight format changes |
| search (sold) | none: returns no_route with a handoff to the search page | **no**: no sold filter answers anonymously | - |
| read one listing (`readListing`) | `by-slug/<slug>/` plus `by-slug/<slug>/extended/`; price is `pricing.current_price.price_breakdown.price.amount` | yes; like_count and pricing are only in extended | the presentation API version moves (410) |
| still up (`stillUp`) | `by-slug/<slug>/` status; 404 means gone | yes, about 150 ms | that a deleted listing answers 404 is not yet observed |
| read_storefront | shop page `/<username>/`, first `{"seller":{` that has followers; plus `shops/<id>/aggregates/` total for active_count | followers, following, rating, review_count, sold_count, active_count; views, saves and gross need a session | seller keys renamed (key order already differs between pages) |
| read_listings | `shops/<id>/products/` and `shops/<id>/products/by-status/sold/` | yes, including sold; views and watchers need a session | only the first 24 per status are read |
| reviews (`readReviews`) | `users/<id>/feedback/?role=seller` | yes; author handles are hashed | - |

Sold status is public per listing (by-slug status `STATUS_MARKED_AS_SOLD`) and per shop (the sold endpoint). It is not public through search.

## Signed-in verbs (built on fixtures; cannot be proved live now because no account is linked)

| verb | design | needs to prove |
|---|---|---|
| read_inbox | endpoint, path `PATHS.inbox` (a guess) | not proved live: no account is linked. Recon with one replaces the guessed path and the fixture. |
| read_offers | endpoint `PATHS.offers` (a guess); expires_at = created_at + `offer.buyer.expires_h` (24 h, spec/sites.mjs) | not proved live: no account is linked. |
| read_orders | endpoint `PATHS.orders` (a guess) | not proved live: no account is linked. |
| read_stats | endpoint `PATHS.stats` (a guess); bag adds count as saves | not proved live: no account is linked. |
| post | page `/products/create/`; checks the depop.md listing fields (1 to 8 photos, department, condition, price of at least 1.00, one kind of shipping) | not proved live: no account is linked. |
| revise | page `/products/edit/<slug>/`; auto-respond is the one line "Always accept $X or more", sent as `auto_negotiate_offer_price` | not proved live: no account is linked. |
| end | edit page, Delete listing | not proved live: no account is linked. |
| relist | sold listing, Restock | not proved live: no account is linked. |
| send_message | thread page, message box | not proved live: no account is linked. |
| answer_offer | offer, Accept, Decline or Counter; refused once the 24 h have passed | not proved live: no account is linked. |
| make_offer | selling hub, Send offer; checked by `sellerOffer` (at least 5% off, spec/sites.mjs) | not proved live: no account is linked. |
| save | listing heart (like) | not proved live: no account is linked. |

- Every write is dry by default. It returns `{dry, url, steps, request}` and the last step is "stop before" the submit.
- A real write (`dry:false`) has two outcomes:
  - with no session, it returns auth_expired;
  - with a session, it returns no_route with a handoff, until a submit is observed with a linked account.
- The signed-in manifests are version 0.1.0 so that a recorded route can replace them.

## Depop rules, read from spec/sites.mjs

- **Offers last 24 h.** read_offers and answer_offer both read the 24 h from spec/sites.mjs.
- **Auto-respond is always-accept only, never the floor** (product/decisions.md):
  - `autoRespond` refuses a line below the floor;
  - it also refuses a line less than `offer.seller.min_off_pct` under the price.
  - depop.md says "auto-negotiate at the user's floor". That conflicts with the decision; the decision is followed.
