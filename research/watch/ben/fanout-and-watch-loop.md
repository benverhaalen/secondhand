# How do cross-market search and watch alerts actually run, site by site?
Researched 2026-11-14 by Ben (Claude Code agent, thread "Plan the build for pricing, search and watch"). Feature: watch.

Builds on [one-search-box.md](one-search-box.md) (feed vs fan-out, hybrid proposal), [exa-alerts.md](exa-alerts.md) (Exa monitors) and the Cross-market search table in [existing-tools.md](../../appraise/ben/existing-tools.md). Decisions it serves: the Buy tab search box with camera and pasted link, the New matches and Watching shelves, and the "within the hour" alert promise ([decisions.md](../../../product/decisions.md#2026-11-14-the-buy-tab-mirrors-sell-with-shelves)). Platforms are the decided list ([decisions.md](../../../product/decisions.md#2026-11-14-the-platform-list-is-set)). Exa is being tested in a separate session, so this note only says where Exa could replace or complement a route.

Method: Ben's looped seeded research. Each loop inspected one or two seeds with a stated quality cue and ended with a frontier. The log is at the end. I could not run code against any site (the shell has no internet), so every latency figure below is either a number a source printed or my estimate, marked as such.

## Draft answer before searching, and whether it changed

Draft (from memory): eBay through its official API, everything else through each site's internal JSON endpoints, merged in parallel, deduped by image hash, ranked by price against fair value, and watched by polling every few minutes.

Changed in four ways. (1) Only eBay, Facebook (GraphQL), OfferUp (GraphQL) and Grailed (Algolia) can be called as plain HTTP. Depop, Mercari and Poshmark now need a real browser session, because their JSON endpoints refuse server-side calls. (2) Price filters sent in the URL are unreliable on Depop and Poshmark, so the price check has to live in our code. (3) Search results on most sites carry no creation date, so "new since last check" has to be a set of seen IDs, not a timestamp. (4) Stock and catalogue photos break naive image dedupe; the Airbnb cross-listing patent solves exactly that.

## References and their jobs

| Reference | Quality cue | Job | Keep | Change | Check |
|---|---|---|---|---|---|
| secondhand-mcp source ([repo](https://github.com/jlsookiki/secondhand-mcp)) | Inspectable, working code per site, MIT | Implementation mechanism | Per-site adapter shape (`search`, `getListingDetails`, `healthCheck`), retry with block detection, 90 s result cache, logged-out Facebook fallback | Its 8 retries of 20 s each is far too slow for an interactive box; it filters price after parsing but returns no dates or shipping | Whether `SEARCH_DOC_ID` still works on demo day |
| eBay Browse API docs ([search](https://developer.ebay.com/api-docs/buy/browse/resources/item_summary/methods/search), [discovery guide](https://developer.ebay.com/develop/guides-v2/inventory-discovery-and-refresh-guide)) | Primary docs | The one official route, and the model for every other adapter | `sort=newlyListed`, price filter, shipping cost, seller, `itemCreationDate` | Nothing | Call limit on our keyset; whether `search_by_image` is enabled for it |
| browse.sh skill pages for [Depop](https://browse.sh/skills/depop.com/search-listings-p8xawn) and [Mercari](https://browse.sh/skills/mercari.com/search-listings-4ixl7y) | Practitioner traces with exact params and failure notes | Implementation mechanism for the two hardest sites | Param names, response field paths, "run the XHR from inside the page" | Some response shapes are partly inferred by the author | Re-run once in a real browser |
| Apify actors (Grailed, OfferUp, Mercari, Depop) | Many independent maintainers converge on the same routes | Fallback route and evidence of what is reachable | Use as paid fallback when our adapter breaks (cost does not matter) | Per-run start latency is unknown | One run per site |
| SerpApi Google Lens ([docs](https://serpapi.com/google-lens-api)) | Primary docs with sample timing | Photo search and visual identity | `visual_matches` with `price` and `source` gives both identity and live listings | `type=products` is gone | Share of Lens hits that land on our seven sites |
| Skyscanner Live Prices create and poll ([docs](https://preview-developers-shiny-magpies.pages.dev/docs/getting-started/create-and-poll), [support](https://skyscannerpartnersupport.zendesk.com/hc/en-us/articles/4687147291933-Why-does-it-take-up-to-two-minutes-to-get-all-results)) | Structurally distant: same fan-out shape, solved at scale | Interaction and transport for partial results | Session id, poll for more, show partial results, say when complete | They wait up to 2 minutes; we cannot | Nothing |
| camelcamelcamel ([price checking post](https://camelcamelcamel.com/blog/how-our-price-checking-system-works)) | Operator describing its own scheduler | Poll scheduling for price watches | Items with a watch get checked more often | Their cadence is per retailer; ours is per site and per watch | Nothing |
| Swoopa and Flipify ([7-minute delay](https://getswoopa.com/facebook-7-minute-delay), [speed tiers](https://getswoopa.com/what-do-the-different-numbers-1-min-3-mins-5-mins-9-mins-mean/), [Flipify intervals](https://flipifyapp.com/blog/is-the-10-minute-interval-search-enough-for-serious-flippers)) | Competitors stating their own cadence | Evidence for cadence and the alert promise | 1 to 10 minute tiers; "find time" as the metric | They are tuned for flippers on Facebook | Our measured find time |
| Poshmark price drop policy ([policy](https://poshmark.com/price_drop_policy)) | A platform's own threshold rule | Alert threshold design | "At least 10% lower than the lowest historical price", items of $10 or more | Make the user's own cap the main trigger | Nothing |
| Airbnb cross-listed property matching patent ([US11869106B1](https://patents.google.com/patent/US11869106)) | Structurally distant, dense method with conditions | Dedupe of cross-posted listings | Block candidates first, image keypoint match, down-weight images that many listings share, combine with text, one threshold | Rooms vs views becomes item photo vs stock photo | Calibrate threshold on 50 labelled pairs |
| Perceptual hashing guide ([mixpeek](https://mixpeek.com/guides/perceptual-image-hashing-near-duplicate-detection)) | Concrete thresholds | Dedupe first pass | Hamming bands | Add an embedding for crops | Our own pairs |

## Per-platform search routes

"Block risk" is my judgement from the sources (inferred) unless marked. ToS risk is stated, not a reason to drop a route: only eBay's route is permitted by terms.

| Site | Route | Query and filters | Sort by newest | Fields we get from search | Latency | Auth | Block and ToS risk |
|---|---|---|---|---|---|---|---|
| eBay | Official Browse API `GET https://api.ebay.com/buy/browse/v1/item_summary/search` (observed in secondhand-mcp code and eBay docs) | `q`, `limit` up to 200, `offset` up to 9,999 and a multiple of limit, `filter=price:[10..50],priceCurrency:USD`, `conditions:{NEW}`, `buyingOptions`, `maxDeliveryCost:0`, `deliveryPostalCode`, `aspect_filter` with `category_ids` (observed, eBay docs). A price filter without a currency is "silently" dropped (observed, comment in secondhand-mcp `filters.ts`) | `sort=newlyListed` (observed). Price sort uses price plus shipping (observed) | `itemId`, `legacyItemId`, `price`, `shippingOptions.shippingCost`, `image`, `additionalImages`, `seller.username`, `seller.feedbackScore`, `itemCreationDate`, `epid`, `itemGroupHref` (observed); `itemOriginDate` added April 2025 (observed, [release notes](https://developer.ebay.com/develop/api/browse-api/release-notes)) | Not published. About 0.3 to 1 s (asserted, from memory) | OAuth client credentials, application token, header `X-EBAY-C-MARKETPLACE-ID: EBAY_US` (observed) | Low. Default 5,000 calls a day (asserted, cited second hand by [apiserpent](https://apiserpent.com/blog/free-ebay-api), Oct 2026; eBay's own limits page failed to load). Browse returns active listings only (asserted, same source) |
| Facebook Marketplace | Internal GraphQL `POST https://www.facebook.com/api/graphql/` with form body `doc_id=27517490627932547` and `variables` (observed, secondhand-mcp `queries.ts`, `transport.ts`). Fallback: logged-out page `https://www.facebook.com/marketplace/{cityPageId}/search?query=...&minPrice=&maxPrice=&radius=` parsed from HTML (observed) | `params.bqf.query`, `filter_price_lower_bound`, `filter_price_upper_bound`, `filter_radius_km`, `filter_location_latitude/longitude`, `commerce_search_and_rp_ctime_days`, `commerce_search_and_rp_condition`, `commerce_enable_shipping`, `count` (24 a page), `cursor` (observed, variable names) | No sort variable in that code. `ctime_days` limits to recent days (observed name; behaviour inferred) | `id`, `marketplace_listing_title`, `listing_price.formatted_amount`, `primary_listing_photo.image.uri`, `location.reverse_geocode`, `marketplace_listing_seller.name`, `is_sold`, `is_pending`, `is_live` (observed, `parse.ts`). No creation time or shipping price is read | Not measured. About 1 to 2 s (asserted) | None. Needs a lat and long, which the code geocodes from a city name (observed) | High. Facebook "serves non-browser callers a gated version of its search API from time to time" (observed, README). The doc_id breaks when the frontend changes (observed, README). ToS forbids automated extraction (asserted, [mrscraper](https://mrscraper.com/blog/facebook-marketplace-api-guide), Feb 2026). New listings appear in search about 7 minutes late (asserted, [Swoopa](https://getswoopa.com/facebook-7-minute-delay)) |
| Depop | Page `https://www.depop.com/search/?q=...` renders the first batch server side; more pages come from `https://webapi.depop.com/api/v2/search/products/?what=...&cursor=...&country=us&currency=USD` (observed, [browse.sh](https://browse.sh/skills/depop.com/search-listings-p8xawn)) | `q`, `priceMin`, `priceMax`, `sizes` like `US-M`, `conditions` (`brand_new`, `used_like_new`, ...), `brands` as numeric IDs, `isDiscounted` (observed, browse.sh). secondhand-mcp sends only `q` and filters price after parsing because the page is not "price-filtered/sortable via URL reliably" (observed, `depop.ts`) | `sort=newest` (observed, browse.sh) | `id`, `slug`, `status` (`ONSALE`, `SOLD`, `RESERVED`), price amount, `currency_name`, `is_reduced`, shipping amount, `sizes`, `brand_name`, `pictures[]` by size, `like_count`. Seller from slug prefix. Creation date only on the detail page (observed, browse.sh) | "~5s per search" (observed claim, secondhand-mcp README). Navigation timeout 20 s, selector wait 8 s (observed, code) | None, but the JSON call must run inside a real page so it carries `__cf_bm` and Turnstile state; plain curl gets 403 (observed, browse.sh; also secondhand-mcp comment that the API "now returns 403 to server-side requests") | High. Needs a headless browser plus residential proxy, throttle 1 request a second (observed, browse.sh). `RESERVED` lasts about 10 minutes then may return (observed, browse.sh) |
| Poshmark | Server-rendered HTML `https://poshmark.com/search?query=...&type=listings&src=dir` (observed, `poshmark.ts`) | `sort_by`, `condition` (`nwt`, `nwot`, `good`, `fair`), `size[]`, `brand[]`, `category_v2`, `department`, `color[]` (observed). Price in URL "is unreliable", so price is filtered after parsing (observed) | `sort_by=added_desc` (observed) | From cards: id (24 hex suffix), title from image alt, price by regex, one image. Seller, size, brand, date and original price are not mapped by that code (observed). Detail page has JSON-LD `Product` (observed) | Not stated. 3 to 6 s through a browser (inferred, same machinery as Depop) | None | Medium to high. Same block detection as Depop ("Just a moment", "Forbidden") (observed, code) |
| Mercari | Search XHR `GET https://www.mercari.com/v1/api/search` (observed, [browse.sh](https://browse.sh/skills/mercari.com/search-listings-4ixl7y)) | `keyword`, `priceMin`, `priceMax`, `itemConditions` 1 to 5, `sizeId`, `brandId` (build-versioned IDs), `status=on_sale`, `shippingPayerId`, `pageSize` 120, `offset` (observed, browse.sh) | `sortBy=created_time` (observed, browse.sh) | `id`, `title`, `price`, `condition`, `brand`, `size`, images, `shipping`, `seller`, `status`, timestamps (asserted by browse.sh as partly inferred) | Not stated. Wait about 3 s after load for the first XHR (observed advice) | Session-bound headers minted by the page, "likely a DPoP-style header + cf-bm cookie"; a cookieless call returns 401 (observed, browse.sh) | High. Residential proxy called "mandatory", `cf-bm` lives about 30 minutes, so re-issue the session about every 25 minutes (observed, browse.sh) |
| OfferUp (search only) | Internal GraphQL with an anonymous session, plain HTTP, no browser (asserted, [crowdpull actor](https://apify.com/crowdpull/offerup-scraper.md)) | Query, location or lat/long, radius, price min and max, condition, delivery (observed, actor inputs) | `sortBy` with example `-posted` (observed; meaning inferred) | `listingId`, `title`, `price`, `condition`, `locationName`, one image. Post date, seller and shipping only with a detail call (observed) | Up to about 50 listings a request (observed); time not stated | Anonymous session, cookie-based geolocation (observed) | Medium. "OfferUp rate limits apply; residential proxies recommended" (observed) |
| Grailed (search only) | Algolia search API used by grailed.com, key taken from the homepage and refreshed on 403 (observed, [bovi actor](https://apify.com/bovi/grailed-listings.md); [grailed_api](https://pypi.org/project/grailed_api/0.1.0) needs `X_ALGOLIA_API_KEY` and app id) | Query, `price_from`, `price_to`, `sizes`, `designers`, `conditions`, `sold` (observed, grailed_api). 48 hits a page (observed, bovi) | By-date index exists (asserted, from memory; not confirmed) | `listing_id`, `price`, `price_drops`, `size`, `designers`, `created_at`, `seller_username`, `cover_photo`, `sold` (observed, bovi output) | Algolia is typically under 100 ms (asserted) | Public search-only key | Low to medium. Fastest and cleanest of the scraped routes (inferred) |

**Read (inferred).** Two tiers fall out. Plain HTTP adapters (eBay, Facebook GraphQL, OfferUp, Grailed) can answer inside about 2 s. Browser adapters (Depop, Poshmark, Mercari) take 3 to 6 s when healthy and fail by timing out, not by erroring. For the demo, run the browser tier in a warm pool (one logged-out page per site already open on the right origin, so the JSON call reuses its cookies), and keep an Apify actor per site as the fallback when our adapter breaks. Cost does not matter, so the fallback can be always on for watches, where a minute of latency is fine.

**Where Exa fits (inferred, untested here).** Exa could replace the browser tier for watches if the other session finds it indexes Depop, Poshmark and Mercari listing pages with prices; its hourly floor matches the "within the hour" promise. It cannot replace the interactive tier, which needs answers in seconds. It complements everything as the long-tail route (small shops, forums) and as a paste-a-link reader for sites we have no adapter for.

## Paste a link

Every site exposes a stable ID in the URL. Resolve it, fetch the listing through the same adapter, then run the Valuation card.

| Site | URL shape | ID to keep | Fetch |
|---|---|---|---|
| eBay | `ebay.com/itm/<digits>` or `/itm/<slug>/<digits>` (asserted) | Legacy ID; the API ID is `v1\|<digits>\|0` (observed, secondhand-mcp `ebay/index.ts`) | Browse `GET /item/{id}` (observed) |
| Facebook | `facebook.com/marketplace/item/<digits>/` (asserted) | Digits | secondhand-mcp `details.js` (exists, not opened) or page JSON |
| Depop | `depop.com/products/<slug>/`, slug starts with the seller name (observed, `depop.ts` regex) | Slug | Detail page JSON-LD and `date_created` (observed, browse.sh) |
| Poshmark | `poshmark.com/listing/<title>-<24 hex>` (observed, `poshmark.ts`) | 24 hex | Detail page JSON-LD `Product`, seller from `a[href^="/closet/"]` (observed) |
| Mercari | `mercari.com/us/item/m<digits>/` (asserted) | `m<digits>` | Page in the browser tier |
| OfferUp | `offerup.com/item/detail/<id>` (asserted) | id | GraphQL detail (asserted) |
| Grailed | `grailed.com/listings/<digits>-<slug>` (asserted) | Digits | Algolia by `objectID` or page (asserted) |

Share links (`ebay.us/...`, `posh.mk/...`, Depop app links) are redirects (asserted); follow them with a HEAD request first (inferred). An unknown domain goes to a generic reader: JSON-LD `Product` and `Offer` if present, else Exa contents or an LLM read of the page (inferred).

## Photo search

1. **Google Lens through SerpApi** is the first call (inferred). It takes a public `url` or an `image_id` from an upload, `type` = `all`, `exact_matches` or `visual_matches`, optional `q` to refine, and `country` (observed, [SerpApi](https://serpapi.com/google-lens-api)). `visual_matches` rows carry `title`, `link`, `source`, `thumbnail` and sometimes `price` with `extracted_value` and `currency`, plus `in_stock` and `condition` (observed). The sample took 2.75 s (observed); `async=true` lets us submit and collect later (observed). `type=products` was discontinued (observed). The job is identity: titles across many matches give brand, model and colourway, which become the text query for the fan-out. Any Lens row whose `link` is on one of our seven sites is already a result.
2. **eBay `POST /item_summary/search_by_image`** with a base64 image (observed that it exists and takes base64, [Jentic](https://jentic.com/apis/ebay.com/main.md); field name and release status not confirmed). Runs in parallel with Lens and returns eBay listings directly.
3. **Our identify step** ([openai-decisions-api.md](../../identify/ben/openai-decisions-api.md)) turns the photo plus the Lens titles into the structured want. One tap question if two identities are close.

## Normalisation

One row per listing, written by every adapter (inferred schema):

`{site, site_id, url, title, brand, model, size_raw, size_norm, measurements?, condition_norm, price, shipping, shipping_known, currency, total_usd, local_pickup, distance_mi?, seller_id, seller_rating?, images[], phash[], embedding?, created_at?, first_seen_at, last_seen_at, last_price, price_history[], status}`

- **Total price.** `total = price + shipping`. eBay gives `shippingOptions.shippingCost` (observed). Depop gives a shipping amount, "0.00" means free (observed). Mercari has a shipping payer flag (observed). Poshmark ships at a flat label price (asserted, from memory; check the current figure). Facebook and OfferUp are mostly pickup: show distance instead of shipping and mark `shipping_known=false` (inferred). Rank on total, and show the shipping part on the card.
- **Currency.** Pin US storefronts (`EBAY_US`, Depop `/us/` or `currency=USD`), since Depop otherwise follows the request IP (observed). Convert anything else once with a daily rate (inferred).
- **Size.** Map site sizes to one scale per category (Depop `US-M`, Poshmark `size[]`, Grailed numbers), then prefer measurements from the description where present, per [measure](../../../features/measure/) (inferred).
- **Condition.** Map to five steps: new with tags, new, like new, good, fair. The site vocabularies above all fit (observed vocabularies; mapping inferred).
- **Dates.** `created_at` only where search gives it (eBay, Grailed, Facebook not read, Mercari timestamps). Everywhere, store `first_seen_at` ourselves (inferred).

## Dedupe of cross-listed items

Resellers crosslist the same photos to several sites (observed in [direct-references.md](../../cross-cutting/ben/direct-references.md)). Method, adapted from the Airbnb patent (observed method; transfer inferred):

1. **Block.** Only compare listings in the same identity cluster and price band (within about 40%). This is the patent's geographic tile step.
2. **Image pass.** 64-bit pHash on every image. Hamming 0 to 5 means the same image; 6 to 10 is a grey zone; above 12 is different (observed bands, [mixpeek](https://mixpeek.com/guides/perceptual-image-hashing-near-duplicate-detection)). pHash survives resizing and recompression but heavy crops break it (observed), and Depop and Poshmark crop to squares (asserted). So for the grey zone, compare an image embedding as well (observed advice in the same guide).
3. **Discount shared images.** The patent down-weights views and pools because different properties share them (observed). Our version: an image hash that appears under three or more different sellers is a stock or catalogue photo and does not count as evidence (inferred). Without this, every listing that uses the brand's product shot collapses into one card.
4. **Other signals.** Seller handle match across sites (resellers often reuse a handle; asserted), title similarity, same size.
5. **Score and threshold.** Weighted sum, one threshold, calibrated on about 50 hand-labelled pairs from the demo category (inferred). The card shows the cheapest total and "also on Poshmark, Depop".

## Ranking against fair value

Fair value per identity and condition comes from the price engine as p25, p50 and p75 per channel ([valuation-engine.md](../../price/ben/valuation-engine.md)). Proposal (inferred):

- `deal = (p50 - total) / (p75 - p25)`, the saving measured in units of the range's spread. Above 1 is a strong deal; around 0 is fair; below -1 is overpriced.
- `score = deal × match × trust × fresh`, where `match` (0 to 1) is identity and fit confidence from identify and measure, `trust` (0.6 to 1) comes from seller rating and listing completeness, and `fresh` decays from 1 over a few days since `first_seen_at`.
- Hard filters before scoring: the user's cap on total, size or measurement range, condition floor, `status` live.
- If there are fewer than about 5 comps for that identity, the range widens (as the engine already does) and `deal` shrinks, so thin data cannot produce a loud "deal".
- The card says "$32 · usually $45 to $60" and the site badges. Sort by score; a "Cheapest" chip re-sorts by total.

## Search request: fan-out with partial results

Borrowed from Skyscanner's create and poll: the first response carries "data we have at the time", the client polls, and partial results are shown "until all the supplier information was loaded" (observed). Their full set takes up to two minutes (observed); ours must not.

1. `POST /search` returns a `search_id` and the index hits for the query at once (the hybrid from [one-search-box.md](one-search-box.md)).
2. The server starts one task per site with a hard deadline: 2.5 s for the HTTP tier, 7 s for the browser tier (inferred). secondhand-mcp's own budget of up to 8 attempts of 20 s each (observed) is what this deadline replaces.
3. The client receives each site's batch as it lands (server-sent events or a poll every 500 ms), merges, dedupes and re-scores in place. Cards do not jump once shown; new ones slot in below the fold (inferred, to keep the list steady).
4. Each site gets a status chip: done with count, slow, or not reached. A site that misses its deadline keeps running in the background, and its results go to the index and into New matches if they qualify.
5. Each card shows "checked 2 min ago" from `last_seen_at`. Tapping "Buy" re-fetches that one listing first and shows sold or changed before the user leaves the app.

## Failure modes and what the user sees

| Failure | How we detect it | What happens |
|---|---|---|
| Cloudflare page or 403 | Title has "Just a moment" or "Forbidden", or status not 200 (observed, secondhand-mcp block test) | Rotate proxy once inside the deadline, then mark the site "not reached" and use the index rows for it |
| Facebook gated GraphQL | `errors` without `data`, or non-retryable status (observed, `transport.ts`) | Fall back to the logged-out search page (observed design), then to the index |
| Facebook `doc_id` stale | Response "unreadable" (observed) | Health check alert to us; site marked down |
| Mercari session expired | 401 (observed) | Re-open the page to mint a new session; refresh every 25 minutes proactively (observed advice) |
| Selector or markup change | Zero listings parsed on a query that had results yesterday (observed: secondhand-mcp adds a note when nothing parses) | Mark degraded; switch that site to the Apify actor |
| Price filter ignored | Results above cap | Always filter in our code (observed need on Depop and Poshmark) |
| eBay price filter dropped | Missing `priceCurrency` (observed) | Always send currency |
| eBay quota | 429 (asserted) | Cache 90 s like secondhand-mcp (observed); watches share one query per identity |

A health check per site runs every few minutes with a one-result query (observed pattern, `healthCheck()`), and You > Accounts shows site health (decided screen).

## The watch loop

**Promise.** "Within the hour" is decided. Competitors sell speed: Flipify checks every 10 minutes on Basic and every minute on Premium (observed, [Flipify](https://flipifyapp.com/blog/is-the-10-minute-interval-search-enough-for-serious-flippers)); Swoopa measures "average find time" in tiers of 1 to 9 minutes (observed); Facebook itself holds new listings about 7 minutes (asserted, Swoopa). For a buyer, not a flipper, "within the hour" is honest, and polling every 10 to 15 minutes keeps us well inside it at low block risk (inferred).

**Cadence per site (inferred).**

| Site | New listings | Known-item recheck |
|---|---|---|
| eBay | Every 10 min, `sort=newlyListed`, page 1 | Every 30 min with `GET /item/{id}` (the discovery guide says COMPACT checks availability or revision, observed) |
| Grailed | Every 10 min | Each poll; `price_drops` is in the search row (observed) |
| Facebook | Every 15 min, `ctime_days=1` | Hourly, via detail |
| OfferUp | Every 15 min | Hourly |
| Depop, Poshmark, Mercari | Every 15 min through the warm browser, or hourly through Apify or Exa | Hourly; Depop rows carry `is_reduced` (observed) |

camelcamelcamel checks watched items more often than unwatched ones (observed); we only poll what someone watches, and group identical wants so ten users watching "Arc'teryx Beta LT M" cost one query per site (inferred).

**New since last check.** Keep a seen set per watch: `(site, site_id)`. A listing is new when its key is not in the set, regardless of dates, because Depop, Poshmark and OfferUp search rows carry no creation date (observed). On eBay and Grailed also keep a `created_at` high-water mark and stop paging once past it (inferred). First run of a watch seeds the set silently and shows those as current matches, not as alerts (inferred, otherwise the first poll fires dozens).

**Price drop.** Two sources. (a) A known ID reappears in a search with a lower price. (b) The recheck of known items. Store `price_history`. Fire "dropped" when the new total is under the user's cap and was not before, or, with no cap, when it falls at least 10% below the lowest price we have seen and the item is $10 or more, which is Poshmark's own rule (observed, [policy](https://poshmark.com/price_drop_policy)). Sold or reserved items leave Watching quietly (Depop `RESERVED` can come back after about 10 minutes, observed, so wait one more poll before calling it gone).

**Threshold in our code.** The check is `total_usd <= cap AND match >= 0.8 AND size fits AND status live`, then the same `deal` score as search. Exa monitors have no price threshold either (observed in [exa-alerts.md](exa-alerts.md)), so this logic is shared whichever route found the listing.

**Alert dedupe.** One alert per (watch, identity cluster), not per listing, so a cross-listed jacket alerts once. Re-alert on the same cluster only for a new lower total. Collapse several hits in one poll into one notification ("3 new matches, best $32") (inferred).

**Human in the loop.** A hit with `match` between 0.6 and 0.8 does not notify. It becomes a Today card asking "Same item?" with both photos, and the answer trains the watch (inferred; matches the Decisions pattern in [exa-alerts.md](exa-alerts.md) and Ben's preference for human in the loop).

**Quiet hours.** Hold non-urgent alerts between the user's quiet hours and send one digest in the morning. An alert that beats the cap by more than the range spread (a rare steal) may break through if the user allows it (inferred).

**Freshness stamps.** Every match carries `first_seen_at` ("listed about 40 min ago" when `created_at` is known, else "found 12 min ago") and `last_checked_at`. The alert itself re-fetches the listing right before sending, so we never alert on something already sold (inferred).

## Limits

- I did not call any site. Every endpoint is from source code, docs or practitioner pages, and internal endpoints change without notice. Run each adapter once before building on it.
- secondhand-mcp's Facebook `details.ts`, `locations.ts` and eBay `parse.ts`, `auth.ts` were not opened. The GitHub tree page was blocked by robots and the API needs repo access.
- eBay's call limits page failed to load; the 5,000 a day figure is second hand. The `search_by_image` request field name and release status are unconfirmed.
- Grailed's Algolia app ID and index names, OfferUp's GraphQL operation name, and Mercari's exact response shape were not confirmed from a primary source.
- Latency for sites other than Depop and Lens is my estimate.
- Kayak and Google Flights were not opened; Skyscanner stood in for flight meta-search. Real estate dedupe beyond the Airbnb patent (for example MLS aggregators) was not inspected.

## Frontier log

**Loop 1. Seed: secondhand-mcp source** (cue: working code per site). Opened `index.ts`, `depop.ts`, `poshmark.ts`, `facebook/index.ts`, `queries.ts`, `transport.ts`, `parse.ts`, `ebay/index.ts`, `ebay/filters.ts`.
Changed: Depop's JSON API refuses server calls; price filters are done after parsing on Depop and Poshmark; search rows have no dates; Facebook has a GraphQL route plus a logged-out HTML fallback; worst-case retry budget is minutes.
Next lead: the eBay docs for sort, filters and image search. Contrary lead: practitioner pages that show Depop's JSON can still be reached from inside a page.

**Loop 2. Seeds: eBay Browse docs and browse.sh skill pages** (cue: primary docs; practitioner traces with params and failures).
Changed: eBay has `newlyListed`, shipping cost and `itemCreationDate`, so it is the clean watch source; Depop's `webapi` works only inside a page with Cloudflare state; Mercari needs a page-minted session with a 30-minute cookie.
Next lead: OfferUp and Grailed routes. Contrary lead: Apify actors claiming "no login, no browser" for the same sites.

**Loop 3. Seeds: Apify actors for OfferUp, Grailed, Mercari; grailed_api** (cue: independent maintainers converging).
Changed: OfferUp and Grailed are plain HTTP; Grailed rows include `price_drops` and `created_at`, so Grailed is cheap to watch. Apify becomes the fallback tier since cost does not matter.
Next lead: the photo route. Neglected lead: GrailSearch's write-up, which turned out to hold no mechanism.

**Loop 4. Seeds: SerpApi Lens, eBay search_by_image** (cue: primary docs with timing).
Changed: Lens gives identity and live listings in one call of about 3 s; `type=products` is gone, so use `visual_matches`.
Next lead: distant references for the loop and partial results. Contrary lead: whether Lens returns marketplace pages at all for used items (unresolved; needs a test).

**Loop 5. Seeds: Skyscanner create and poll, camelcamelcamel, Swoopa and Flipify, Poshmark price drop policy, Airbnb patent, pHash guide** (cue: structurally distant systems that solved the same shape).
Changed: partial results with a per-site deadline and status chips; poll only what is watched; a ready-made drop threshold; stock-photo discounting in dedupe; pHash plus embedding for crops.
Unresolved, next action: measure real latency and block rate per adapter from the demo host (bound: one query per site, ten repeats); label 50 cross-listed pairs to set the dedupe threshold; learn from the Exa session whether Exa covers the browser-tier sites, which would decide whether the warm browser pool is needed for watches at all.
