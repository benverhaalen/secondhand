# What each marketplace lets us read today, per verb and field
Researched 2026-11-15 by Nate (Claude Code adaptation lead; retriever Sonnet 5.5 read the adapters). Feature: list.

Read from the harness adapters, their READMEs, run notes and fixtures in this repo; no web page was fetched. The labels below say sourced (read in a repo file: observed), inferred, or not-found. Used by [spec/engines/adaptation.md](../../../spec/engines/adaptation.md#1-the-data-we-can-actually-read).


Retrieval only; no recommendations. Labels: sourced (read in a file this run), inferred, not-found.
Paths are relative to `C:\dev\secondhand`. `S/` = `app/src/edge/harness/sites/`. Run notes = `research/cross-cutting/nate/runs/`.

## How to read the table

- Proof column: LIVE = run note dated 2026-11-15 on a real site. FIXTURE-REAL = parsed from a page/reply recorded live (path given). FIXTURE-SYNTH = synthetic fixture and guessed path or op name, not proved. PLANNED = declared in manifest or README, no parser extracts it.
- "Extracted" is judged from the parser code. `classifyRead` (`app/src/edge/harness/protocol.ts`) fails `page_changed` only on a missing required field and keeps extra keys a parser sets, so a manifest line alone does not prove extraction.
- Freshness: the code stores no age stamp per read. "real-time" = fetched at call time (inferred); "cached" only where a source says so; "lagged" where stated (Insights 90 days, Analytics 7-day window).
- Terms column keys (full quotes in the per-site sections below):
  - E-API = eBay API License Agreement (applies to API-lane rows). E-PAGE = eBay User Agreement / robots (page-lane rows).
  - P-TOS = Poshmark ToS v4.6 s4 + Community Guidelines. M-TOS = Mercari prohibited-conduct page + person's-request ruling. D-TOS = Depop terms (README cites `research/list/ben/platforms/depop.md`). DUPE-L = Dupe terms s13/s14.
  - "unstated" = I found no line on display/store/model for that field.
- Citation line numbers are the ones I recorded from grep; where I only hold a file, the cell says "file" (line not recorded).

## Table 1. Fields by site, verb and field

| site | verb | field | public / sign-in | proof | freshness | terms (display / store / model) | citation |
|---|---|---|---|---|---|---|---|
| eBay | search (API Browse) | external_id, item_id, title, url | public (app token) | FIXTURE-REAL `S/ebay/fixtures/search.json`; no keyset, not live | real-time (inferred); 5,000/day | E-API: display <=6 h old; store/model barred (see eBay section) | `S/ebay/adapter.ts:156-160` |
| eBay | search (API) | state, price_cents, currency | public | FIXTURE-REAL, not live | real-time | E-API 8.2 six-hour display age; item 5 bars price modelling | `S/ebay/adapter.ts:159` |
| eBay | search (API) | seller_ref_hash | public | FIXTURE-REAL, not live | real-time | unstated (hashed by `refHash`) | `S/ebay/adapter.ts:160` |
| eBay | search (API) | watchers (`watchCount`) | public | FIXTURE-REAL, not live | real-time | unstated | `S/ebay/adapter.ts:160` |
| eBay | search (API) | listed_at (`itemCreationDate`) | public | FIXTURE-REAL, not live | real-time | unstated | `S/ebay/adapter.ts:160` |
| eBay | search (API) | sold_at (`lastSoldDate`) | public | FIXTURE-REAL, not live | real-time | unstated | `S/ebay/adapter.ts:160` |
| eBay | search (page) | external_id, item_id, title, url, state, price_cents, currency, converted, host | public | LIVE 2026-11-15, 60 rows, about 4.5 s | real-time | E-PAGE: robots `Disallow: /sch/`; automated access barred without permission; Nate ruled "read ebay pages anyway" | `S/ebay/adapter.ts:253-280`; `ad-ebay-page.md` |
| eBay | search (page) | watchers, listed date, seller, rank, shipping | n/a | not extracted (page parser does not set them) | n/a | n/a | `S/ebay/adapter.ts:253`; `ad-ebay-page.md` |
| eBay | search (page, fallback host ebay.co.uk) | price in GBP with `converted: true`; USD price absent | public | LIVE 2026-11-15 | real-time | E-PAGE | `ad-ebay-page.md` |
| eBay | sold search (API, Marketplace Insights `item_sales/search`) | sold price (`lastSoldPrice`), sold_at, state=sold, title, url | needs Limited Release scope `buy.marketplace.insights` (only when `Client.insights` true; else returns handoff) | FIXTURE-REAL `S/ebay/fixtures/insights-sales.json`; not live | lagged: 90-day window (`research/price/nate/sold-price-sources-for-valuation.md:56`) | E-API item 5 "suggest or model prices"; 8.4 pricing tools only with written consent | `S/ebay/adapter.ts:159`; `sold-price-sources-for-valuation.md:56` |
| eBay | sold search (page) | any | needs sign-in on every host; returns `auth_expired`, `do: relink` | parser untested | n/a | E-PAGE | `S/ebay/fixtures/page-sold-signin.html`; `ad-ebay-page.md` |
| eBay | read one listing (API `get_item_by_legacy_id`) | title, price_cents, currency, state, watchers, seller_ref_hash, listed_at | public | FIXTURE-REAL `S/ebay/fixtures/item.json`; not live | real-time | E-API | `S/ebay/adapter.ts:156-160` |
| eBay | read one listing (page JSON-LD, `readItemPage`) | title, price_cents, currency, state, watchers | public | LIVE 2026-11-15, about 4.3 s; `OutOfStock`/`SoldOut`/`Discontinued` mapping unobserved | real-time | E-PAGE | `S/ebay/adapter.ts:293-305`; `ad-ebay-page.md` |
| eBay | still-up (page) | live / sold / ended / gone | public | LIVE 2026-11-15, about 3.5 s | real-time | E-PAGE | `S/ebay/adapter.ts:307` |
| eBay | storefront (API) | rating (`feedbackPercentage`), review_count, active_count (`total`) | public | FIXTURE-REAL; not live | real-time | E-API | `S/ebay/adapter.ts:193-201` |
| eBay | storefront (API) | sold_count, gross_cents | needs sign-in | PLANNED: declared in manifest, no parser extracts; README says "designed, not built" | n/a | n/a | `S/ebay/adapter.ts:190,531-533`; `S/ebay/README.md` |
| eBay | storefront (page `/usr/<name>`) | rating, review_count, sold_count, followers, joined_at | public | LIVE 2026-11-15, about 3.3 s | real-time | E-PAGE | `S/ebay/adapter.ts:314-326`, `:568-570` |
| eBay | own listings (Inventory) | external_id, sku, offer_id, title, state, price_cents, quantity | sign-in | FIXTURE-REAL `inventory-items.json`, `offers.json`; first 100 only; not live | real-time | E-API (own data) | `S/ebay/adapter.ts` (read_listings, line not recorded) |
| eBay | own sales/orders (Fulfillment) | external_order_id, listing_external_id, state, price_cents, item_cents, created_at, buyer_ref_hash | sign-in | FIXTURE-REAL `orders.json`; first line item, first 50 orders; not live | real-time | E-API; personal-info deletion duty | `S/ebay/adapter.ts:389` |
| eBay | offers (Trading `GetBestOffers`) | external_id, listing_external_id, amount_cents, state, buyer_ref_hash, expires_at | sign-in | FIXTURE-REAL `best-offers.xml`; not live | real-time | E-API | `S/ebay/adapter.ts:356-361` |
| eBay | offers eligible (Negotiation) | listing ids | sign-in | FIXTURE-REAL `eligible.json`; not live | real-time | E-API | `S/ebay/adapter.ts` (read_eligible) |
| eBay | messages (Message API) | external_id, thread_ref, listing_external_id, at, from (text never kept) | sign-in | FIXTURE-REAL `conversations.json`; not live | real-time | E-API; deletion duty | `S/ebay/adapter.ts:409,544` |
| eBay | stats (Analytics `traffic_report`, 7 days) | external_id, views (`LISTING_VIEWS_TOTAL`), impressions, transactions | sign-in | FIXTURE-REAL `traffic.json`; not live | lagged: 7-day window, Pacific YYYYMMDD | E-API; 8.3 site-wide stats need written permission | `S/ebay/adapter.ts:412-425,546-547` |
| Poshmark | search (`$_search.gridData`) | external_id, url, state, price_cents, currency, condition, size, title, brand, likes, comments, shares, listed_at, seller_ref_hash | public | LIVE 2026-11-15, 48 rows, about 2.0-2.5 s | real-time | P-TOS: scraping barred; Nate ruling keeps share/like/repost as suggestions only | `S/poshmark/adapter.ts:105`; `ad-poshmark.md` |
| Poshmark | search sorts | relevance_v2, best_match, added_desc, price_desc, price_asc, price_drop, like_count (sort options, not fields) | public | LIVE | n/a | P-TOS | `S/poshmark/README.md` |
| Poshmark | sold search (`availability=sold_out`) | same row fields with state=sold; no sold price or sale date field beyond price_cents | public | LIVE 2026-11-15, 48 rows | real-time | P-TOS | `ad-poshmark.md`; `S/poshmark/adapter.ts:105` |
| Poshmark | read one listing (`$_listing_details.listingDetails`) | same listingRow fields plus seller_ref_hash | public | LIVE 2026-11-15, about 1.4-1.7 s | real-time | P-TOS | `S/poshmark/adapter.ts:105` |
| Poshmark | still-up (`inventory.status`) | live / sold / ended / gone | public | LIVE 2026-11-15 | real-time | P-TOS | `S/poshmark/adapter.ts` (stillUp) |
| Poshmark | comments | text count 0-3, author hashed | public | LIVE 2026-11-15 | real-time | P-TOS | `S/poshmark/adapter.ts:156-190` |
| Poshmark | reviews | none: `no_route`, love notes not public | n/a | LIVE (the refusal) | n/a | n/a | `S/poshmark/adapter.ts:190` |
| Poshmark | storefront | followers, following, review_count (5-star count), sold_count (`seller_orders_shipped`), active_count, sold_display, vacation, last_active_at | public | LIVE 2026-11-15 | real-time | P-TOS | `S/poshmark/adapter.ts:142-152` |
| Poshmark | own listings (closet active+sold, first page, 46 rows) | listingRow fields | public closet of linked user | LIVE 2026-11-15 | real-time | P-TOS | `S/poshmark/adapter.ts:127-140` |
| Poshmark | own listings | views, watchers | needs sign-in | PLANNED: declared `needs_session` at `:346`; no parser extracts (`:380` merges them only if a row already carries them) | n/a | n/a | `S/poshmark/adapter.ts:346,380` |
| Poshmark | storefront | views, saves, gross_cents | needs sign-in | PLANNED: declared `:350`; no parser extracts | n/a | n/a | `S/poshmark/adapter.ts:347-350` |
| Poshmark | inbox | external_id, thread_ref, listing_external_id, at, from, kind | sign-in | FIXTURE-SYNTH, guessed `PATHS.inbox` | real-time (inferred) | P-TOS | `S/poshmark/adapter.ts:24,197-199` |
| Poshmark | offers | external_id, listing_external_id, amount_cents, state, buyer_ref_hash, created_at, expires_at (24 h) | sign-in | FIXTURE-SYNTH, guessed path | real-time | P-TOS | `S/poshmark/adapter.ts:201-206` |
| Poshmark | orders | external_order_id, listing_external_id, state, price_cents, at | sign-in | FIXTURE-SYNTH, guessed path | real-time | P-TOS | `S/poshmark/adapter.ts:207` |
| Poshmark | stats | external_id, views, likes, shares | sign-in | FIXTURE-SYNTH, guessed path | real-time | P-TOS | `S/poshmark/adapter.ts:209,358-359` |
| Mercari | search (`searchFacetQuery`, 100 rows, about 5.1 s) | external_id, url, state, price_cents, currency (USD always), title, condition, size, brand, likes (`numLikes`), listed_at (`created`), seller_ref_hash | public | LIVE 2026-11-15, query "carhartt hoodie" | real-time | M-TOS: read only on the person's request | `S/mercari/adapter.ts:105-125`; `ad-mercari.md` |
| Mercari | sold search (`itemStatuses` 1 or 2) | same fields with state sold; no sold price/date beyond price_cents and listed_at | public | LIVE 2026-11-15 | real-time | M-TOS | `S/mercari/adapter.ts:53,105` |
| Mercari | read one listing (`ItemDetail` in `__NEXT_DATA__`) | itemRow fields plus offerable (`isOfferable`), seller_ref_hash, seller_sales, seller_rating | public | LIVE 2026-11-15 | real-time | M-TOS | `S/mercari/adapter.ts:165-170` |
| Mercari | still-up | live / sold / ended / gone (deleted item unobserved) | public | LIVE 2026-11-15 | real-time | M-TOS | `S/mercari/adapter.ts:175` |
| Mercari | reviews (`initReviewsQuery`, 50 rows) | at, rating (good/normal/poor), subject, tags, author_ref_hash | public | LIVE 2026-11-15 (earlier run `page_changed`, then fixed) | real-time | M-TOS | `S/mercari/adapter.ts` (readReviews); `ad-mercari.md` |
| Mercari | storefront | followers, following, rating, review_count, sold_count (`numSales`), active_count, user_id | public | LIVE 2026-11-15 | real-time | M-TOS | `S/mercari/adapter.ts:144` |
| Mercari | own listings (`publicProfileSearchQuery`, first page, about 30) | itemRow fields | public profile | LIVE 2026-11-15 | real-time | M-TOS | `S/mercari/adapter.ts:125-143` |
| Mercari | own listings / storefront | impressions, gross_cents | needs sign-in | PLANNED: declared `needs_session`; no parser extracts | n/a | n/a | `S/mercari/README.md`; `S/mercari/adapter.ts` manifest |
| Mercari | inbox (`conversationsQuery`) | external_id, thread_ref, listing_external_id, at, from | sign-in | FIXTURE-SYNTH, guessed op name | real-time | M-TOS; `linked.ts:10` refuses without a linked account | `S/mercari/adapter.ts:~205-212`; `S/mercari/linked.ts:10` |
| Mercari | offers (`offersQuery`) | external_id, listing_external_id, amount_cents, state, buyer_ref_hash, created_at, expires_at | sign-in | FIXTURE-SYNTH, guessed op name | real-time | M-TOS | `S/mercari/adapter.ts:~205-212` |
| Mercari | orders (`sellerOrdersQuery`) | external_order_id, listing_external_id, state, price_cents, at | sign-in | FIXTURE-SYNTH, guessed op name | real-time | M-TOS | `S/mercari/adapter.ts:~205-212` |
| Mercari | stats (`sellerItemsQuery`) | external_id, impressions (`numViews`), likes | sign-in | FIXTURE-SYNTH, guessed op name; "impressions" naming asserted, unconfirmed | real-time | M-TOS | `S/mercari/adapter.ts:212` |
| Depop | search | external_id, slug, url, state, price_cents, currency, brand (`brand_name`), likes (`like_count`), sku (unobserved), seller_ref_hash (slug prefix); no title (slug stands in) | public | LIVE 2026-11-15 | real-time | D-TOS | `S/depop/adapter.ts:118-121`; `ad-depop.md` |
| Depop | sold search | none: `no_route` with handoff | n/a | n/a | n/a | n/a | `S/depop/adapter.ts:108` |
| Depop | read one listing (`by-slug` + `/extended/`) | shipping_cents, quantity (`listed_quantity`), likes, seller_ref_hash (`seller.username`), listed_at | public | LIVE 2026-11-15 | real-time | D-TOS | `S/depop/adapter.ts:130-134,176-181` |
| Depop | still-up / sold status | `STATUS_ONSALE` vs `STATUS_MARKED_AS_SOLD` per listing and shop | public | LIVE 2026-11-15 | real-time | D-TOS | `S/depop/adapter.ts:68` |
| Depop | storefront | followers, following, rating (`reviews_rating`), review_count, sold_count (`items_sold`), active_count, shop_id | public | LIVE 2026-11-15 | real-time | D-TOS | `S/depop/adapter.ts:168-169` |
| Depop | reviews | at, rating, author_ref_hash | public | LIVE 2026-11-15 | real-time | D-TOS | `S/depop/adapter.ts:197` |
| Depop | own listings | listingRow fields incl. listed_at (`created_at`) | public | LIVE 2026-11-15 | real-time | D-TOS | `S/depop/adapter.ts:130-138` |
| Depop | own listings / storefront | views, watchers; views, saves, gross_cents | needs sign-in | PLANNED: declared at `:339-342`; no parser extracts | n/a | n/a | `S/depop/adapter.ts:339-342` |
| Depop | inbox | external_id, thread_ref, listing_external_id, at, from | sign-in | FIXTURE-SYNTH `inbox.json`, guessed path | real-time | D-TOS | `S/depop/adapter.ts:~215-220` |
| Depop | offers | amount, state, buyer hash, expiry (336 h per `spec/sites.mjs`; ranking note says 14 days) | sign-in | FIXTURE-SYNTH `offers.json`, guessed path | real-time | D-TOS | `S/depop/adapter.ts:~215-220`; `spec/sites.mjs` |
| Depop | orders | price_cents (`total.amount`), state, at | sign-in | FIXTURE-SYNTH `orders.json`, guessed path | real-time | D-TOS | `S/depop/adapter.ts:~215-220` |
| Depop | stats | external_id (`product_id`), views, likes, saves (`bag_adds`) | sign-in | FIXTURE-SYNTH `stats.json`, guessed path | real-time | D-TOS | `S/depop/adapter.ts:219` |
| Dupe | search (MCP `https://mcp.dupe.com/mcp`, keyless) | id, title, price_cents (`price.extracted_value`), currency, url, image_url (optional), source_site, secondhand (bool), commercial_link=true, attribution "Dupe.com", keep_until | public | LIVE 2026-11-15: 7 searches x 40 rows = 280 rows, 120 secondhand, no 429; one search at a time, >=3000 ms apart | "prices refresh on the order of hours" (agent.txt, per README) | DUPE-L s13: display to end users; store: no period published, `keep_until` = request time; model: unstated | `S/dupe/adapter.ts:94-103`; `S/dupe/README.md` |
| Dupe | search | condition, size, brand, seller, listed date, sold flag | n/a | not extracted by `toRow` | n/a | n/a | `S/dupe/adapter.ts:94-103` |
| Dupe | every other verb | none: `no_route` | n/a | n/a | n/a | n/a | `S/dupe/README.md` |
| Dupe | not built | URL/image search, `get_product_details` | n/a | PLANNED | n/a | n/a | `S/dupe/README.md` |

Row counts (table rows above): eBay 23, Poshmark 18, Mercari 14, Depop 14, Dupe 4 (sourced: count of rows by site in Table 1; sort-option row for Poshmark counts as one).

## Fields on your list with no row (no parser extracts them anywhere)

Sourced from the parser lines above; grep of the five adapters was done for the named fields.
- Photo count: not extracted on any site (Dupe has an optional single `image_url`).
- Category: not extracted on any site.
- Number of results: not extracted as a field on any site (row count only).
- Rank/position: not extracted on any site.
- Promoted/sponsored mark: not extracted on any site.
- Buyer location: not extracted on any site.
- Price-drop / last-updated history: not extracted on any site. Poshmark exposes a `price_drop` sort only.
- Seller rating/sold count: eBay (page), Poshmark (sold_count only), Mercari, Depop yes; Dupe no.
- Shipping price: Depop `read one listing` only. eBay page search and Poshmark and Mercari do not extract it.

## README claims with no parser extracting them (precise)

- eBay `read_storefront` (API): `sold_count`, `gross_cents` declared `needs_session` (`S/ebay/adapter.ts:531-533`); comment at `:190` and README say "designed, not built". The page lane does extract `sold_count`.
- Poshmark: `read_listings` `views`, `watchers` (`:346`); `read_storefront` `views`, `saves`, `gross_cents` (`:350`).
- Mercari: `read_listings` `impressions`; `read_storefront` `impressions`, `gross_cents`.
- Depop: `read_listings` `views`, `watchers`; storefront `views`, `saves`, `gross_cents` (`:339-342`).
- All signed-in reads (Poshmark, Mercari, Depop inbox/offers/orders/stats) rest on guessed paths or op names and synthetic fixtures. eBay signed-in reads use official API calls on fixtures, not live.

## Per-site: NOT readable, and terms quoted

### eBay
- Not readable (sourced): sold search without Limited Release access; page sold search without sign-in; seller sold_count/gross via API; watchers/listed date/seller/rank/shipping on page search; no open eBay sold API (`research/price/nate/sold-price-sources-for-valuation.md`). Terapeak has no API (3 years own sales, completed listings 90 days, line 42); sold-items filter needs sign-in (line 43); own-sales CSV carries Sold For and Sale Date (line 45).
- Terms (sourced, observed from the developer.ebay.com copy; the current licence page returned 403):
  - Section 9: "you may not use or access (nor facilitate or enable others to use or access) eBay Services, including the Developer Tools, in any way which may, directly or indirectly, undermine eBay's business interests without eBay's prior written consent." (`sold-price-sources-for-valuation.md:24-29`)
  - Item 5: "Use eBay Content, either alone or in combination with third-party information, to suggest or model prices for items listed on eBay Site." (`:27`)
  - Also barred there: sell/store/copy/modify eBay Content (item 7); train algorithms or AI (item 10); Buyer Demand Data only for constructing or editing a listing (item 18).
  - 8.1 "may not be co-mingled or combined with non-eBay Content"; 8.2 "Displayed item listing information may not be more than six (6) hours older than information displayed on the eBay Site, and other eBay Content must be no more than twenty-four (24) hours older"; 8.3 express written permission for "Any site-wide statistics across eBay Sites"; 8.4 pricing tools "only upon receiving eBay's express prior written consent" (`research/data/nate/data-services-on-marketplace-apis.md:30-37`, footer Sept 3, 2025).
  - Deletion: "You will delete Personal Information when requested by eBay"; "When the eBay Content is no longer publicly available, you must delete it from your Application" (README, API License Agreement 2018-10-26 PDF).
  - `research/cross-cutting/nate/claims-validated-specs.md`: the "kept 6 hours at most" claim is false as worded; 6 h is a display-age limit, not a storage cap.
  - Page lane: robots `v30.2_COM_August_2026` has `Disallow: /sch/`; header "The use of robots or other automated means to access the eBay site without the express permission of eBay is strictly prohibited"; User Agreement (effective 2026-06-28) bars automated means "except with the prior express permission of eBay" (`ebay-when-it-serves.md`, `S/ebay/README.md`). Nate ruling: `product/words.md` ("read ebay pages anyway").

### Poshmark
- Not readable (sourced): reviews (`no_route`, love notes not public); views/watchers/saves/gross (no parser); all signed-in reads unproved live; sold price and sale date as separate fields.
- Terms (sourced): ToS v4.6 s4 forbids to "copy, scrape, harvest, crawl or use any technology, software or automated systems to collect any information or data for the Service". Community Guidelines: "we don't allow Poshers to use unauthorized programs or other forms of automation to participate on Poshmark. This includes, but is not limited to, deleting and reposting content, liking, sharing, following, and unfollowing." Seller Policy v3.9: "Sellers are prohibited from excessive listing removal and reposting of the same or similar listings."
- Share/like only suggested: `spec/engines/protocol-and-adapters.md:242`: "On Poshmark, `share`, `save` (a like) and `relist` are never submitted by the system... The marketing engine still works out when one is worth doing and says so as a suggestion with its reason; the adapter answers `no_route` with `handoff {url}`... so the person taps the button themself". Ruling: `product/words.md#2026-11-15-nate-poshmark-share-like-and-repost-are-suggested-and-the-person-taps`. README lines 104-105 mark save/share high risk; no cap stated. `MIN_PRICE_CENTS` $3 asserted, unverified.

### Mercari
- Not readable (sourced): impressions/gross (no parser); direct API calls return 401, plain request 403 (`protocol-and-adapters.md:256`); deleted-item state unobserved; own-listing reads are first page only; signed-in reads synthetic.
- Terms (sourced): `spec/engines/protocol-and-adapters.md:243`: "Mercari is read knowingly and under the person's approval: their own linked account, and a search or a listing they asked for. Mercari's prohibited-conduct page bars automated access (...ad-mercari.md), so nothing sweeps Mercari in bulk or on a timer for people who did not ask". `:244`: the broad search goes to Mercari itself only lightly. Prohibited-conduct page: "use any robot, spambot, spider, crawler, scraper or other automated means or interface not provided by us to access the Service or to extract data" (`research/connect/nate/platform-access.md:134`). ToS `/tos/` has no automation line; the full Terms URL returned 403. `S/mercari/linked.ts:10`: `fail('policy_refused', 'Mercari requires the asking person linked account', { do: 'raise_decision', kind: 'link_account' })`. Write limits: MIN_CENTS 100, MAX_CENTS 200000, PROMOTE_PCT 5.

### Depop
- Not readable (sourced): sold search (`no_route`, handoff); views/watchers/saves/gross (no parser); title on search (slug only); signed-in reads on guessed paths.
- Terms: README cites `research/list/ben/platforms/depop.md`, "API partners are barred from browser automation"; `research/connect/nate/platform-access.md` is the ToS source. I did not re-open the Depop terms text this run: display/store/model = unstated. Depop offers a CSV download and a partner API pricing-inspiration route (`sold-price-sources-for-valuation.md:46`).

### Dupe
- Not readable (sourced): every verb except search; condition, size, brand, seller, listed date, sold flag. "Ebay" rows come back `secondhand: false`; no Mercari rows appeared.
- Terms (sourced): `dupe.com/legal/terms` s13 "we grant you a limited, revocable, non-exclusive, non-transferable license to call our developer interfaces to search our catalog and display results to your end users."; s14 bars scraping. agent.txt: "cache what you retrieve; prices refresh on the order of hours"; README says the terms win.

## Seller levers per site (`research/list/nate/ranking-levers-per-site.md`, all fetched 2026-11-15)

The note records mechanism and rules only. It states no measured effect for any lever (sourced). "Ranking beliefs" are in `ranking-algorithms.md`.

### eBay (lines 44-54)
| lever | rule | source id/URL cited | measured effect |
|---|---|---|---|
| Best Match default sort | default | ids 4166, 4006 (observed) | none stated; the free lever that moves a listing most is "not stated by eBay" (line 118) |
| Promoted Listings General | ad rate 2% to 100%, charged on a sale within 30 days of a click | id=4164 | none stated |
| Promoted Listings Priority | cost per click, second-price auction | id=5295 | none stated |
| Best Offer | 24 h seller response, counteroffers 96 h, buyers up to 3 offers | id=4144 | none stated |
| Offers to interested buyers | at least 5% below Buy It Now, 30 most recent, valid 96 h, batches every 48 h | id=4144 | none stated |
| Relist | 250 free a month then $0.35 | id=4147 | none stated |
| Fees | 13.6% up to $7,500, then 2.35%; $0.30 or $0.40 per order | id=4822 | n/a |
Not found: automatic price reduction, edit limits, the full sort list.

### Poshmark (lines 62-69)
| lever | rule | source | measured effect |
|---|---|---|---|
| Share | free, asserted | none primary | "Moves the listing in the sharing feed per sellers' accounts"; about 10,000 shares per 24 h claimed by CLOSO via fluf.io only (asserted, line 63) |
| Offer to Likers | at least 10% below buyer's lowest offer in last 90 days, 24 h; shipping discount stated both "optional" and "included" | https://support.poshmark.com/s/article/831745541 | none stated |
| Price drop | likers notified at 10% or more; final price at least $10; at least 10% below lowest historical price | https://poshmark.com/price_drop_policy | none stated |
| Closet Clear Out | blogs 2020-01-20, 2021-11-08 | blog posts | none stated |
| Promoted Closet | cost per click from weekly budget, auction, 7-day cycle | https://poshmark.com/promoted-closet/terms | none stated |
| Fee | $2.95 under $15; 20% at $15+ | n/a | n/a |
Not found: default sort and sort list at a primary source (third parties conflict); relist and edit limits; a share limit.

### Mercari (lines 91-99)
| lever | rule | source | measured effect |
|---|---|---|---|
| Promote | price drop of 5% or more, once per item per 24 h | help 347 | none stated |
| Offer to Likers | 10% or more, at most 50 likers, 24 h, once per item per 72 h | Mercari help (id not recorded) | none stated |
| Time-limited Sale | 72 h, at least 10% below historic low | Mercari help | none stated |
| Smart Pricing | price and floor; schedule unpublished | Mercari help | none stated |
| Buyer offers | | help 330 | none stated |
| Relist | favours genuine updates over delete-and-relist; no numeric limit | help 2514 | none stated |
| Fee | 10% flat | help 2518 | n/a |
No paid placement seen. Not found: default sort, numeric relist limits.

### Depop (lines 77-83)
| lever | rule | source | measured effect |
|---|---|---|---|
| Ranking | "sort by relevance"; only Boosted Listings buy ranking | Depop ranking page | none stated |
| Boosted Listings | 12% UK and US (from 23 March 2026), 8% Australia, on a sale within 28 days | Depop help | none stated |
| Send Offer | 14 days, one offer per buyer, same country only | Depop help | none stated |
| Partner API auto-offer | 1 hour after like or bag, at least 5% below | partner docs | none stated |
| Buyer Make Offer | seller has 14 days | Depop help | none stated |
| Fee | no selling fee UK/US/AU; US 3.3% + $0.45 payment processing | n/a | n/a |
Not found: refresh and relist limits, a markdown tool, the sort list.

Dupe: no seller levers (read-only search). Facebook Marketplace is in the note but is not one of the five sites.

## Not found

- Per-line line numbers for some adapter.ts cells (marked `~` or "line not recorded"): eBay read_listings/read_eligible, Mercari signed-in block, Depop signed-in block. Only the file and the neighbourhood are given.
- Any measured effect of any seller lever in `ranking-levers-per-site.md`: none stated (sourced).
- Primary-source default sort for Poshmark, Mercari, and the full sort list for eBay and Depop.
- Depop terms text on display/store/model: not re-read this run; marked unstated.
- Dupe published retention period: not found (README says none published).
- eBay current licence page: returned 403; text taken from the developer.ebay.com copy.
- Live proof for any signed-in read on any site: not found (all fixture).
- `ad-dupe.md` was not opened directly; Dupe facts come from `S/dupe/README.md` and `adapter.ts`.
- Other run notes (bp-1, bu-agent-runs, cr-1, fr-1, hp-7, hp-9, in-3, in-4, m1, msg-1, sd-1, si-1) not grepped for site fields.
- Row counts by site are my tally of Table 1, not a count of distinct parser fields.

## Sources fetched

Files read on disk (not web):
- `app/src/edge/harness/protocol.ts`
- `app/src/edge/harness/sites/{ebay,poshmark,mercari,depop,dupe}/README.md`
- `app/src/edge/harness/sites/{ebay,poshmark,mercari,depop,dupe}/adapter.ts`; `mercari/linked.ts`; fixture directory listings for all five
- `spec/sites.mjs`; `spec/engines/protocol-and-adapters.md` (lines 242-244, 256); `product/words.md` (ruling anchors)
- `research/list/nate/ranking-levers-per-site.md`
- `research/price/nate/sold-price-sources-for-valuation.md`
- `research/data/nate/data-services-on-marketplace-apis.md`
- `research/connect/nate/platform-access.md`
- `research/cross-cutting/nate/{claims-validated-specs.md,privacy-and-data.md}`
- Run notes: `research/cross-cutting/nate/runs/{ad-ebay.md,ad-ebay-page.md,ebay-when-it-serves.md,ad-poshmark.md,ad-mercari.md,ad-depop.md (partly)}`
No web pages were fetched in this run; every URL above is quoted from the repo notes, not re-opened.
