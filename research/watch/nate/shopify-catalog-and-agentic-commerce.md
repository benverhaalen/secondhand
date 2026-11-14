# As of November 2026, what do Shopify's catalog and the other agent-facing and cross-merchant product catalogs hold, how are used and new offers told apart, which can a third-party app read, and what would a used-goods app that also covers new retail take from them?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: watch.

Evidence marks. *observed* = I opened the page or fetched its text on 2026-11-14 and it says so (URL and the page's date where it shows one). *asserted* = a vendor or third party says so, not verified, or a search snippet only. *inferred* = my reasoning. "Unopened" = a link I did not open. I report facts and options and do not choose the design.

Existing notes referred to: [buy-side-products-and-search-experience.md](buy-side-products-and-search-experience.md), [buyer-intent-and-official-alternatives.md](buyer-intent-and-official-alternatives.md), [identification-technologies.md](../../identify/nate/identification-technologies.md), [market-intelligence.md](../../data/nate/market-intelligence.md), [market-insight.md](../../../spec/determinations/market-insight.md), [product.md](../../../spec/product.md), [buy.md](../../../spec/features/buy.md), [market.md](../../../spec/features/market.md), [identify.md](../../../spec/features/identify.md).

## 0. What the earlier notes already say, and where this one confirms, extends or contradicts

- Confirms [identification-technologies.md line 91](../../identify/nate/identification-technologies.md): Shopify Global Catalog clusters products by Universal Product ID, takes text and image queries, has a secondhand flag, needs no key for the agent profile, and forbids aggregating, rehosting, redistributing, reselling and bulk export. I re-read the terms on 2026-11-14 and the same limits stand (section 1.4).
- Extends [market-intelligence.md line 108](../../data/nate/market-intelligence.md), which says none of its catalogue rows says whether they carry a first-party new price. Shopify's Global Catalog does carry a current price per variant and seller (section 1.2); external (non-Shopify) offers carry only an indicative price that may be absent.
- Extends [buy-side-products-and-search-experience.md lines 61-62](buy-side-products-and-search-experience.md) (Google AI Mode, ACP, UCP, "all assume a merchant of record and a catalogue", *inferred* there). I opened the ACP repository, the UCP repository and Google's and OpenAI's feed pages. ACP and UCP are checkout and interaction protocols; only UCP has a catalog capability, and only Shopify and Klarna expose a catalog a third party can query (section 8).
- Extends [buyer-intent-and-official-alternatives.md lines 37 and 84](buyer-intent-and-official-alternatives.md), which list Merchant Center `condition` values as "only secondary mentions". I opened Google's Merchant Center condition page (section 3). Also extends line 13 (no published purpose schema from Rufus, Klarna or Perplexity): I found no purpose or intent field in Klarna's or Shopify's documented models either (section 5.1, 1.2).
- Extends [market-insight.md lines 30-31 and 63-64](../../../spec/determinations/market-insight.md): the identity ladder puts a GTIN first and lists Shopify Global Catalog as a rank-2 catalogue; the retail-price ranks list retailer pages and Keepa-type trackers. Shopify Catalog and Klarna offers are a further kind of source for the new-price side, but see the terms limits (1.4, 5.4) before treating either as a store.
- Contradicts nothing in the repo that I found. One point to flag: [market-insight.md line 80](../../../spec/determinations/market-insight.md) plans a daily `retail` row per product refreshed from sources; Shopify's terms allow caching price and availability for 10 minutes and metadata for 24 hours and bar a standing database (1.4). Whether that conflicts depends on which source writes that row. That is the lead's call.

## 1. Shopify

### 1.1 What it is (observed)
- Shopify Catalog: "Search billions of products from millions of brands in one call, with current price, inventory and checkout links"; "Over 1 billion products from millions of merchants on Shopify. In beta, Catalog also includes pro[ducts from brands not on Shopify]". Three calls: Search, Get product, Look up. A CLI exists: `npm i -g @shopify/shop && shop search 'lounge chair' --ships-to US`. Source: https://www.shopify.com/catalog (fetched 2026-11-14, page undated).
- Two surfaces share one capability: the Global Catalog (all of Shopify, plus external) and a Storefront Catalog (one store). Both implement the UCP Catalog capability with tools `search_catalog`, `lookup_catalog`, `get_product`. Endpoints: `https://catalog.shopify.com/api/ucp/mcp` (global) and `https://{storeDomain}/api/ucp/mcp` (storefront). Source: https://shopify.dev/docs/agents/catalog and the Global Catalog MCP page (fetched 2026-11-14, undated).
- UCP itself is Apache-2.0, repository Universal-Commerce-Protocol/ucp, created 2025-12-31 (*observed*, GitHub API, 2026-11-14). The catalog launch date: not found.
- Winter '26 Edition (https://www.shopify.com/editions/winter2026, fetched 2026-11-14): Agentic Storefronts syndicate a merchant's products to ChatGPT, Copilot and Perplexity; Catalog for all; a direct catalog feed for select partners "soon"; Checkout Kit for web (*observed*, page wording, no per-feature docs opened for Agentic Storefronts or Checkout Kit; those are *unopened*).
- Changelog items (*observed*, https://shopify.dev/changelog, 2026): compare-at price returned as `list_price` (10.09); the Global Catalog REST API stops on 2026-11-02 so MCP only; brands not on Shopify in beta (10.27); location search (10.22); Promoted Placements in beta (10.27).

### 1.2 Data model (observed, Global Catalog docs and the UCP variant schema)
- Product cluster: offers for the same product are grouped by a Universal Product ID, `gid://shopify/p/{upid}`. Variants are `gid://shopify/ProductVariant/{id}`; external variants `gid://catalog/ExternalVariant/...`; external sellers `gid://catalog/ExternalMerchant/...`.
- Product-level fields in the sample response: title, description (plain), rating {value, count}, price_range {min, max}, variants[]. Variant fields: seller {name}, price {amount in minor units, currency}, availability {available}, plus in the UCP variant schema: `barcodes` array (UPC, EAN, ISBN, GTIN, JAN), sku, list_price, unit_price, options, seller, metadata (*observed*, UCP repository schema files).
- No gtin field appears in Shopify's own Global Catalog docs that I read, only in the UCP schema (*observed*; whether the live Global Catalog fills `barcodes` is *not-found*).
- No field for buyer purpose, use case or "same job" appears (*observed* absence in the docs I read, not proof).

### 1.3 Query to results (observed)
- `search_catalog`: keyword, an image (base64) or a product GID through `catalog.like`. Filters: available, ships_to, ships_from, shops (up to 1000), categories (taxonomy GID), attributes, rating, price_tier, media, price, condition. Sources via `catalog.sources` (beta): "shopify" and "external".
- `limit` at most 50, up to 1,000 results deep. `lookup_catalog` takes up to 50 IDs on global and 10 on storefront. `get_product` returns one product in full.

### 1.4 New versus used, access, cost, limits (observed unless marked)
- Condition filter values are "new" and "secondhand" (observed, Global Catalog docs). Whether a refurbished state maps to either is *not-found*.
- External offers: US shoppers only, display and link only, no checkout; price indicative and may be absent; `availability.available` does not reflect stock.
- Access: keyless works at the lowest rate limits; a Dev Dashboard key gives higher limits; the token expires after 60 minutes. A third-party app can read it.
- Terms (https://shopify.dev/docs/agents/catalog, fetched 2026-11-14): price and availability may be cached 10 minutes, metadata 24 hours; no standing database, no training, no redistribution or bulk export; commission never cached. For external offers: no feeds or indexes for others, no editing images.
- Cost: no price on the pages I read. Free is *inferred* from keyless access and no fee text, not stated.
- Cross-check with the repo: this is the same terms text [identification-technologies.md line 91](../../identify/nate/identification-technologies.md) records.

### 1.5 Not read
- Shop app search (shopify.com/shop or help pages): *unopened*. Agentic Storefronts and Checkout Kit docs: *unopened*. A Shopify merchant being enabled for Google native checkout by default was seen as a search snippet from Search Engine Land, *asserted*, unopened.

## 2. OpenAI: ChatGPT shopping, ACP, product feed

- Docs map: https://developers.openai.com/commerce.md (fetched 2026-11-14). Sections: Agent Access, Guides (accept payments, best practices, build a plugin, claim your business, browser access, Sign in with ChatGPT, Partner Playbook, submit product feeds), Specs (file upload, product feed onboarding, product feed schema).
- How a query becomes results (*observed*, submit-product-feeds guide): "ChatGPT can use product feeds and other available retail and public web sources for product discovery." The merchant uploads full snapshots by manual upload, hosted URL or SFTP through a merchant portal, with identity verification in Business Hub. "The feed does not update a cart or confirm a purchase. Your live website or plugin still checks the current offer."
- Feed fields (https://developers.openai.com/commerce/specs/file-upload/products.md, fetched 2026-11-14): required item_id, title, description, url, brand, seller_name, image_url, availability, price; required geo fields target_countries and store_country. availability values in_stock, out_of_stock, pre_order, backorder, unknown; price like "79.99 USD". Optional or conditional: group_id, listing_has_variations, variant_dict, offer_id, gtin, mpn, sale price and `condition` (new, refurbished or used).
- Third-party read access: none found. The feed is push only; I found no search, lookup or read API in the commerce docs (*observed* absence in the docs I fetched, ~79 KB of text). Cost of feed submission: not stated on the pages read.
- ACP (https://github.com/agentic-commerce-protocol/agentic-commerce-protocol, README fetched 2026-11-14): Apache 2.0, maintained by OpenAI and Stripe, status beta; a checkout interaction model with RFCs (agentic_checkout, capability_negotiation, payment_handlers, extensions, discount). It is not a catalog read API.
- Shopping research and purpose: no schema published (see [buyer-intent-and-official-alternatives.md line 13](buyer-intent-and-official-alternatives.md)); not found again here.

## 3. Google: Merchant Center, Shopping Graph, AI Mode, UCP checkout

- `condition` attribute (https://support.google.com/merchants/answer/6324469, fetched 2026-11-14): values new, refurbished, used; optional for new, required for used and refurbished. It maps to schema.org: new to NewCondition, refurbished to RefurbishedCondition, used to UsedCondition or DamagedCondition. "Used and refurbished products aren't displayed on YouTube organic and Discover surfaces"; they can serve as ads on YouTube, Display and Gmail. Google says it is "used to refine search results".
- GTIN (https://support.google.com/merchants/answer/6324461, fetched 2026-11-14): recommended for any product with a manufacturer GTIN; "Accurate matching to products can't be assured when GTIN is missing"; accepts UPC (GTIN-12), EAN (GTIN-13) and others.
- Product data spec (https://support.google.com/merchants/answer/7052112, fetched 2026-11-14): `id` ("use the same ID for the same product across countries or languages"), title (150 characters), `item_group_id` (max 50, required for variants in the US), `identifier_exists`, `product_type` (up to 750 characters, up to 5 values).
- UCP checkout on Google (https://support.google.com/merchants/answer/16837055, fetched 2026-11-14): US, Canada, Australia, select merchants; surfaces AI Mode in Search and Gemini; the merchant stays seller of record; only listings with the `native_commerce` attribute get a Buy button; an active Merchant Center account is needed; compatible with A2A, AP2 and MCP. https://developers.google.com/universal-commerce-protocol (fetched 2026-11-14): UCP reuses Merchant Center feeds for reach; functions are identity linking, cart building, checkout, order management, discounts and loyalty; a waitlist.
- Third-party read access to the Shopping Graph or AI Mode results: not found. The Merchant API manages a merchant's own data (guide overview page fetched, not parsed). Cost of listing: not read. The Shopping Graph pages were not opened.
- Price tracking, typical-price insights and the Universal Cart are already in [market-intelligence.md line 48](../../data/nate/market-intelligence.md) and [buy-side note line 3 table, group 3](buy-side-products-and-search-experience.md).

## 4. Amazon: Rufus (renamed), Buy for Me

- https://www.aboutamazon.com/news/retail/amazon-agentic-ai-gen-ai-shopping (page dated 2025-11-18; fetched 2026-11-14, the page's navigation also shows later items): Buy for Me products "increased from 65K at launch to over half a million"; more than 250 million customers used Rufus that year; Rufus users convert 60%+ more; Lens Live. The same page's navigation shows "On May 13, 2026, Rufus was renamed Alexa for Shopping" and a 2026-11-13 item "Meet Alexa for Shopping, your personalized, agentic AI" (*observed*, item text only; the item itself *unopened*).
- Auto Buy checking prices every 30 minutes with 24 hours to cancel, and Buy for Me being in beta for a subset of US users: search snippets, *asserted*, unopened.
- Third-party read access: no developer read API for Rufus, Alexa for Shopping, Buy for Me or the Amazon catalog was found in this pass (not checked directly beyond searches). Amazon's Creators API as a first-party price source is already in [market-insight.md line 63](../../../spec/determinations/market-insight.md).
- Used versus new: Amazon Warehouse and Renewed are not re-researched; see [buyer-intent-and-official-alternatives.md lines 44 and 51](buyer-intent-and-official-alternatives.md).

## 5. Klarna: Agentic Product Protocol and Search and Compare

### 5.1 Data model (observed, https://docs.klarna.com/acquirer/klarna/other-products/klarna-search/klarna-agentic-product-protocol/, fetched 2026-11-14)
- Product: `productIdentifier` (for example krn:kpdc:product:3431242055), name, klarnaProductPageUrl, imageUrl, brand {name, logoUrl}, categoryName. Product listings add description, rating, GTINs and rank in category.
- Offer: offerName, merchant {merchantName, merchantLogoUrl, merchantProductSku, international}, offerUrl (Klarna-affiliated), price {value, currency}, shippingCost, stockStatus (IN_STOCK, OUT_OF_STOCK, PREORDER, SPECIAL_ORDER, BACKORDER, COLLECT_IN_STORE, UNKNOWN), deliveryTime {minDays, maxDays}, paymentMethods, gtin14 (nullable), attributes.
- No condition field was in the offer fields I read; the merchant product file does have Condition (5.3). Whether the API hides or omits used offers: not confirmed.

### 5.2 Query to results and access
- Search v2 `/agentic/v2/product/search/{market}?q=&offset=&size=` is semantic (q up to 100 characters, size 1 to 100, default 10). Product listings `/agentic/v1/product/offers/{market}`. Search v1 is deprecated and had sortOrders POPULARITY, NAME, RATING, TREND, HOT. Markets AT, DE, DK, ES, FI, FR, IE, IT, NL, NO, SE, UK, US. Errors 400, 403, 429, 500 with exponential backoff.
- Access: "available for approved Partners and developers", requested by email to Klarna; a `tokenId` header. Klarna says it is "production-ready in the US and EU" on a normalized catalog and unified taxonomy (vendor claim, *asserted*). Swagger: https://api.pricerunner.com/docs/ (EU) and https://api-us.pricerunner.com/docs/ (US), *observed* as links on the docs page, Swagger pages themselves unopened.

### 5.3 Merchant product file (observed, https://docs.klarna.com/acquirer/klarna/other-products/klarna-search/integrate-klarna-search/product-file/)
SKU/ID, Name, Price, Shipping costs, Stock status, Delivery time, Manufacturer, EAN/GTIN, Condition, Manufacturer SKU/MPN, URL, Image URL, Category, Description; detailed: AdultContent, AgeGroup, Bundled, Color, EnergyEfficiencyClass, Gender, GroupId, Material, Multipack, Pattern, Size, SizeSystem.

### 5.4 Cost and used offers (observed, https://docs.klarna.com/klarna-search/price-list/, applicable from 2025-04-26)
- That price list is what a merchant pays Klarna per click (excluding VAT), so it is the merchant's cost, not a fee to a reader of the API. Category tiers run from $0.45 (default) to $1.80. Stores selling used or refurbished products pay an extra per click: +$0.38 (laptops, robotic lawn mowers, robot vacuums), +$0.28 (monitors, mobile phones, digital cameras), +$0.19 (irons and steamers, game consoles, soundbars, speakers, TVs, camera lenses, routers, espresso machines), +$0.10 (all other used and refurbished).
- Matching: "The majority of product prices ... are added using the unique product ID. These are normally the EAN (13-digit barcode) or ISBN."
- Cost to a partner reading the Agentic Product API: not stated on the pages read (not found).
- Claims that Search and Compare is powered by PriceRunner and "100M products and 400M prices across 12 markets" are from search results, *asserted*, unopened.

## 6. Perplexity

- Search snippets only, *asserted*, unopened: a merchant program since November 2024; PayPal "Instant Buy" launched November 2025 with the merchant remaining merchant of record; Shopify syncs data to it (see 1.1).
- No official Perplexity product-feed spec found. A third-party guide (alhena.ai) says its checklist is not official. Third-party read access: not found.

## 7. Open standards

- schema.org (https://schema.org, V30.1, 2026-09-16, fetched 2026-11-14): `itemCondition` on Offer, Product, Demand and MerchantReturnPolicy takes a value of OfferItemCondition: NewCondition, RefurbishedCondition, UsedCondition, DamagedCondition. `gtin` is used on Demand, Offer and Product, with sub-properties gtin8, gtin12, gtin13, gtin14. `productGroupID` on ProductGroup and `inProductGroupWithID` on Product (variants share a group id), `isVariantOf` on Product and ProductModel. Offer carries `availability` (ItemAvailability) and `priceValidUntil` (date after which the price is no longer available), `seller`, `itemCondition`.
- Mapping across the vendors above (*inferred* from the fetched pages): Google's `condition` has the schema.org values by design; OpenAI's feed `condition` has new, refurbished, used; Shopify's filter has new and secondhand; Klarna's product file has a Condition field.
- GS1 Digital Link and GTIN: https://www.gs1.org/standards/gs1-digital-link returned "Service unavailable, the request is blocked" on 2026-11-14. Not read. The GTIN facts above come from Google's and Klarna's pages and from schema.org, not GS1.

## 8. Which of these a third-party app can read as the official new-retail side (summary of sections 1 to 7)

| Catalog | Third-party read | Access terms (observed) | Used or new flag | GTIN present |
|---|---|---|---|---|
| Shopify Global Catalog | yes, MCP | keyless or Dev Dashboard key; cache 10 min price, 24 h metadata; no standing database, no bulk export | `condition` new or secondhand | `barcodes` in UCP schema, not confirmed live |
| Klarna Agentic Product API | yes, approved partners, token | request by email; cost not stated | not seen in API offer fields | `gtin14`, nullable |
| OpenAI product feed | no (push only) | merchant portal | `condition` new, refurbished, used | `gtin` optional |
| Google Merchant Center, Shopping Graph, UCP | no read found | merchant account | `condition` new, refurbished, used | `gtin` recommended |
| Amazon (Rufus, Buy for Me) | none found | none found | not read | not read |
| Perplexity | none found | none found | not read | not read |

## 9. Feature table

Columns: feature | who has it (link) | what it would be in a used-goods app that also covers new retail | what data it needs | already in our spec (file) or new. "Partly" means an entity or line exists but not the feature.

| Feature | Who has it | In our app | Data it needs | In spec or new |
|---|---|---|---|---|
| One product id grouping many offers | Shopify UPID ([catalog docs](https://shopify.dev/docs/agents/catalog)); Klarna `productIdentifier` ([docs](https://docs.klarna.com/acquirer/klarna/other-products/klarna-search/klarna-agentic-product-protocol/)); Google `item_group_id` ([spec](https://support.google.com/merchants/answer/7052112)) | A `product` page holding official new offers and used listings from the five sites side by side | product id, variant id, GTIN or MPN, offers with seller and condition | Partly: `product` and `comp` in [product.md lines 56 and 61](../../../spec/product.md); identity ladder in [market-insight.md line 30](../../../spec/determinations/market-insight.md) |
| Condition as a first-class filter and label (new, refurbished, used) | Google ([condition](https://support.google.com/merchants/answer/6324469)); OpenAI ([feed schema](https://developers.openai.com/commerce/specs/file-upload/products.md)); Shopify (new, secondhand); schema.org ([OfferItemCondition](https://schema.org/OfferItemCondition)) | One filter that spans official new, maker-refurbished and marketplace used | condition per offer, with a mapping from each marketplace's own grade | Partly: `comp.condition` in [product.md line 61](../../../spec/product.md); official refurbished tier is "new" in [buyer-intent note line 71](buyer-intent-and-official-alternatives.md) |
| Look up an offer set from an existing id or an image | Shopify `catalog.like` (GID or base64 image); `lookup_catalog` up to 50 ids | Paste a link, a photo or a barcode and get the same product's other offers | image, id, GTIN | Partly: code lookup in [identify.md line 41](../../../spec/features/identify.md), paste a link in [buy.md line 84](../../../spec/features/buy.md); catalog image-like search is new |
| Semantic query for a product | Klarna Search v2 (q up to 100 characters) | Query by description, tied to the intent clarification | query text, taxonomy | Partly: search in [buy.md](../../../spec/features/buy.md); purpose clarification is in [clarifying-inputs.md](../../identify/nate/clarifying-inputs.md) |
| Ships-to and ships-from, location search | Shopify filters and the 10.22 location search; Klarna `international` | Filter official offers and used listings by where they ship from | seller location, destination | New |
| Total price (price plus shipping) and delivery window per offer | Klarna `shippingCost` and `deliveryTime {minDays, maxDays}` | Show landed price and arrival for new and used alike, so "cheaper" is real | shipping cost, delivery estimate per offer | Partly: "shipping and fees are worked out by hand" is the hassle in [buy.md line 4](../../../spec/features/buy.md); no field named |
| Offer-level stock and availability enum | Klarna (7 values); OpenAI (5 values); Shopify `available` (not stock) | Mark an official offer in stock, preorder, backorder, collect in store | availability enum, timestamp | New |
| List price against current price | Shopify `list_price` and compare-at; Klarna price; Google sale price | The `retail` comp and an on_sale flag | price, list price, date | Yes: M2 in [market-insight.md lines 54-82](../../../spec/determinations/market-insight.md); `comp.price_type retail` in [product.md line 61](../../../spec/product.md) |
| Rating and review count per product | Shopify `rating {value, count}`; Klarna rating and rank in category | Show official rating next to used price | rating, count, source | New (not in the entities I read) |
| Filter by attribute, price tier, rating, media | Shopify filters | Faceted refinement from the same attributes identify uses | attribute table per category | Partly: aspect refinements in [clarifying-inputs.md line 18](../../identify/nate/clarifying-inputs.md) |
| Price tracking and back-in-stock | Google Universal Cart and Chrome tracking (see [market-intelligence.md line 48](../../data/nate/market-intelligence.md)) | Alert on the official price, the used price or both | price history per offer | Yes: `follow` and `market_refresh` in [product.md lines 93 and 221](../../../spec/product.md) |
| Merchant-published feed into assistants | OpenAI feed; Google Merchant Center; Shopify Agentic Storefronts | Publish a user's used listings (condition used) so assistants can find them | item_id, title, price, brand, seller_name, image, availability, condition, geo | New (the spec lists posting to the five marketplaces, not to assistant feeds) |
| An agent-readable endpoint of our own | Shopify `search_catalog`, `lookup_catalog`, `get_product` over MCP; UCP | Expose the unified catalog to outside assistants | catalog, auth, rate limits | New (the spec has `GET /v1/products/:id` at [product.md line 517](../../../spec/product.md), not a tool surface) |
| Checkout handoff with merchant of record | UCP and ACP; Google native commerce | Send the buyer to checkout at the official seller | seller, cart, payment handler | New; buy-for-me on marketplaces is barred ([buy.md line 137](../../../spec/features/buy.md)); official-retailer checkout not researched |
| Sponsored or promoted placement | Shopify Promoted Placements (beta, 10.27); Klarna per-click | Not a user feature; a revenue option | impressions, clicks | New; see affiliate in [buyer-side-actions-and-affiliate.md](buyer-side-actions-and-affiliate.md) |
| "Same job, different brand" alternatives | None of these catalogs expose it as a field | Official option offered beside a used listing | purpose, constraints, product family | In research: [buyer-intent note](buyer-intent-and-official-alternatives.md); [product.md line 603](../../../spec/product.md) says no entities yet |

## Not found
- Shopify Catalog launch date, a price or fee for reading it, Shop app search behaviour, Agentic Storefronts and Checkout Kit details, how "secondhand" is assigned to external offers.
- Klarna: cost to a partner of reading the Agentic Product API; whether used offers appear in it and how they are marked.
- Any third-party read API for OpenAI shopping, Google's Shopping Graph or AI Mode, Amazon's Alexa for Shopping, Buy for Me or catalog, Perplexity.
- A purpose or intent field in any catalog's data model.
- GS1 Digital Link content (site blocked the request).

## Searched / could not reach
- Opened (2026-11-14): shopify.com/catalog, shopify.dev agents and catalog pages, the Global Catalog MCP page, the Shopify changelog, the Winter '26 Edition page, the UCP site and repository, OpenAI commerce docs and the feed schema, the ACP README, four Google Merchant Center help pages, the Google UCP help and developer pages, Klarna's Agentic Product Protocol, product-file and US price-list pages, the Amazon news page, schema.org Offer, OfferItemCondition, itemCondition, gtin, productGroupID, inProductGroupWithID, isVariantOf.
- Search snippets only (*asserted*, unopened): Perplexity merchant program and Instant Buy, Amazon Auto Buy and Buy for Me beta, Search Engine Land on Shopify and Google checkout, TechCrunch on UCP, the PriceRunner link and Klarna scale figures.
- Could not reach: https://www.gs1.org/standards/gs1-digital-link (blocked). Two guessed URLs (an OpenAI get-started guide and a Klarna agentic-product-protocol path) returned 404 and I used the links from the pages instead.
- Not searched: Walmart, eBay's own catalog and Browse API (covered in [clarifying-inputs.md line 18](../../identify/nate/clarifying-inputs.md)), Bing Shopping, Meta catalog, Pinterest, Apple.

## Sources fetched
https://www.shopify.com/catalog; https://shopify.dev/docs/agents/catalog; https://shopify.dev/changelog; https://www.shopify.com/editions/winter2026; the UCP site and repository; https://developers.openai.com/commerce.md; https://developers.openai.com/commerce/specs/file-upload/products.md; https://github.com/agentic-commerce-protocol/agentic-commerce-protocol; https://support.google.com/merchants/answer/6324469, 6324461, 7052112, 16837055; https://developers.google.com/universal-commerce-protocol; https://docs.klarna.com/acquirer/klarna/other-products/klarna-search/klarna-agentic-product-protocol/; https://docs.klarna.com/acquirer/klarna/other-products/klarna-search/integrate-klarna-search/product-file/; https://docs.klarna.com/klarna-search/price-list/; https://www.aboutamazon.com/news/retail/amazon-agentic-ai-gen-ai-shopping; https://schema.org/Offer, /OfferItemCondition, /itemCondition, /gtin, /productGroupID, /inProductGroupWithID, /isVariantOf.
