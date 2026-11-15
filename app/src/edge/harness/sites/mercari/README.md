# Mercari harness

Built 2026-11-15 from Mercari's own pages and the GraphQL calls they make (recon in `recon.ts`, live proof in `live.ts`, run note [ad-mercari](../../../../../../research/cross-cutting/nate/runs/ad-mercari.md)). Route ids are `mercari.<verb>.page`.

## How it reads

*Observed*: a direct anonymous call to `https://www.mercari.com/v1/api` answers 401, so no route calls the API itself. Every route opens the page in the browser and reads the answers the page's own client receives, by GraphQL `operationName`, or reads the `__NEXT_DATA__` state the server embedded. No private mobile-app API is used.

| verb | session | page | what it reads | evidence |
|---|---|---|---|---|
| search | public | `/search/?keyword=&itemStatuses=1` (active), `2` (sold), `&sortBy=` | `searchFacetQuery` `data.search.itemsList` | live, 100 rows per page |
| read_listing (inside the kernel's listing read) | public | `/us/item/<id>/` | `__NEXT_DATA__` `pageProps.serverState` `ItemDetail:<id>` and its seller `PublicUser:<id>` | live |
| still up | public | same | `ItemDetail.status`; 404 or `pageProps.statusCode` 404 is gone | live for up; gone is on a fixture (a deleted item was not observed) |
| read_storefront | public | `/u/<user id>/` | `publicProfileUserQuery` `data.user`, plus `publicProfileSearchQueryCount` | live, all 7 fields |
| read_listings | public | `/u/<user id>/` | `publicProfileSearchQuery` `data.search.itemsList` | live; first page only (shortcut in code) |
| reviews | public | `/u/<username>/reviews/` | `resolveUsername`, then `initReviewsQuery` `data.user.reviewsWithStats` | live |
| read_inbox, read_offers, read_orders, read_stats | signed_in | `/mypage/...` | op names `conversationsQuery`, `offersQuery`, `sellerOrdersQuery`, `sellerItemsQuery` | **unobserved**: synthetic fixtures; the urls and op names are guesses until a linked account loads them |
| post, revise, end, relist, send_message, answer_offer, make_offer, save | signed_in | `/sell/`, `/sell/edit/<id>/`, the item page | a dry plan: the page steps and the request, stopping before the final submit | **unobserved**: no submit seen; dry until Nate says go |

Per field, `needs_session` sits in each manifest in `adapter.ts` (`M`). Reviewer and seller ids are hashed (`refHash`) before they leave the adapter. The signed-in reads return `auth_expired` with a relink when the client is not signed in. A challenge page or status 400+ is `blocked`; 429 is `rate_limited`; a GraphQL 401 is `auth_expired`; a missing op or field is `page_changed`; no hits is `ok` with `[]`.

Never in any plan: payment, address, purchase and account-deletion controls (a test checks every write's steps against them).

## Mercari facts

| fact | value | source |
|---|---|---|
| Offer to Likers | at least 10% under the price, to at most 50 likers; lasts 24 h, binding; once per 72 h per item; never under $1 | [help 347](https://www.mercari.com/us/help_center/article/347/), `spec/sites.mjs` `sellerOffer('mercari')` |
| Promote | a price drop of at least 5% | [help 347](https://www.mercari.com/us/help_center/article/347/) |
| Offer expiry | 24 h; a counteroffer also lasts 24 h, and an accepted one is charged automatically | [help 330](https://www.mercari.com/us/help_center/article/330/), `spec/sites.mjs` |
| Relist | deleting and reposting the same item is penalised, so relist is a dry plan only | [help 2514](https://www.mercari.com/us/help_center/article/2514/) |
| Listing form | title 80 chars, description 1000, 1-12 photos, 3 hashtags, $1 to $2,000, conditions New, Like new, Good, Fair, Poor | the sell form (observed), `research/list/ben/platforms/mercari.md` |
| Views | the listing's views count is reported as `impressions`, not page visits | *asserted, unconfirmed*: needs a linked account's stats page |
| Sort | `sortBy` values 1, 2, 4, 3, 6 for Best match, Newest first, Highest price first, Lowest price first, Recently sold; default Best match | the search page's sort control (observed); the value-to-label pairing is in control order, unconfirmed per value |

## Terms

| page | url | read | what it says about automated access |
|---|---|---|---|
| Terms of Service (the footer link) | https://www.mercari.com/tos/ | 2026-11-15 | no line on robots, spiders, scraping, crawling or automated means (65,061 chars searched). `/us/tos/` answers 404. |
| Prohibited conduct | https://www.mercari.com/us/help_center/topics/account/policies/prohibited-conduct/ | 2026-11-15 | "use any robot, spambot, spider, crawler, scraper or other automated means or interface not provided by us to access the Service or to extract data" |

These are facts for Nate and Ben; they do not shape the build.

## Running it

- Tests: `node --test --test-concurrency=1 app/src/edge/harness/sites/mercari/adapter.test.ts`
- Live (one Browser Use Cloud browser, 2 min, never signs in): `node --no-warnings app/src/edge/harness/sites/mercari/live.ts [query]` with `BROWSER_USE_API_KEY` set for that command only.
- Fixtures in `fixtures/` are reduced from real pages, ids replaced and names dropped; the four signed-in ones are synthetic.
