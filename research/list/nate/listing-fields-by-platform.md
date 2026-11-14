# As of November 2026, exactly what information does each of eBay, Facebook Marketplace, Depop, Poshmark and Mercari need or accept to create a listing, per kind of item, so that one item record can be designed to fill every site's form?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: list.

How to read this. The rawest sources reached: eBay's OpenAPI specs (Taxonomy 1.1.1, Metadata, Inventory 1.18.5, Catalog v1_beta.5.3) and its condition-id page; Depop's partner Seller API OpenAPI spec 1.0.0; Mercari's two help pages (copyright 2026); Poshmark's 2026 blog; Meta's Marketplace partner Item API page. Those are API or help text, not the consumer form on screen. Where a site has no API (Poshmark, Mercari, Facebook consumer form) the form fields come from help text plus Ben's notes, and are marked accordingly. "Req" means required to publish by the source; "opt" optional. Every row has a mark and a URL, or "not found".

Existing notes this extends: [eBay](../ben/platforms/ebay.md), [Poshmark](../ben/platforms/poshmark.md), [Mercari](../ben/platforms/mercari.md), [Facebook](../ben/platforms/facebook-marketplace.md), [crosspost](../ben/crosspost-and-delist.md), [platform access](../../connect/nate/platform-access.md), [item card](../../../spec/features/item-card.md).

## 1. eBay

Sources: Inventory API spec https://developer.ebay.com/api-docs/sell/inventory/ (OpenAPI 1.18.5, fetched 2026-11-14); Taxonomy spec (v1.1.1); Metadata spec; Catalog spec (v1_beta.5.3); condition ids https://developer.ebay.com/api-docs/sell/static/metadata/condition-id-values.html. All *observed* 2026-11-14 as the OpenAPI JSON from developer.ebay.com/api-docs. The consumer listing form is not reached (help pages returned a bot check).

| Field | Req | Type and limit | Allowed values | Mark and source |
|---|---|---|---|---|
| Title | req before publish | string. Spec gives no length | length 80 is Ben's figure | *observed* field, limit *asserted* ([ebay.md](../ben/platforms/ebay.md) section 5), Inventory spec |
| Subtitle | opt | string | | *observed*, Inventory spec |
| Description | req before publish (`listingDescription` on the offer) | HTML string. Mobile short description limited to 800 chars | | *observed*, Inventory spec |
| Category | req before publish (`categoryId`); `secondaryCategoryId` opt | id from a category tree (marketplace's default tree id) | leaf categories from Taxonomy API | *observed*, Inventory and Taxonomy specs. Depth varies by category: not found as a number |
| Condition | per category, `itemConditionRequired` | enum (below) | per-category subset from `getItemConditionPolicies` | *observed*, Metadata spec |
| Condition description | opt, max 1000 | string. Ignored with a warning for NEW, LIKE_NEW, NEW_OTHER, NEW_WITH_DEFECTS | | *observed*, Inventory spec |
| Condition descriptors | req for graded and ungraded cards, coins | id plus value ids, or free text for Certification Number (additionalInfo max 30 chars) | per category from the condition policy | *observed*, Metadata and Inventory specs |
| Item specifics (aspects) | per category | name to values list. Up to 30 values when multi-value | per category from `getItemAspectsForCategory` | *observed*, Taxonomy and Inventory specs |
| Brand | conditionally (required if the category requires MPN) | string | usually an aspect | *observed*, Inventory spec |
| MPN, ePID, UPC, EAN, ISBN | opt (some categories require) | string | | *observed*, Inventory spec |
| Size, colour, material, style | as item specifics | aspect, free text or selection | per category | *observed* mechanism, Taxonomy spec |
| Package weight and size | opt, but needed for calculated or weight-based shipping | dimensions (length, width, height, unit, all together), weight (value, unit), packageType, shippingIrregular | | *observed*, Inventory spec |
| Shipping | req through policy | `fulfillmentPolicyId`, `shippingCostOverrides` | | *observed*, Inventory spec |
| Payment and return policy | req | `paymentPolicyId`, `returnPolicyId` | | *observed*, Inventory spec |
| Price | req | `pricingSummary.price`, also auctionStartPrice, auctionReservePrice, originalRetailPrice (strikethrough), minimumAdvertisedPrice | | *observed*, Inventory spec |
| Format | req | | FIXED_PRICE, AUCTION | *observed*, Inventory spec |
| Duration | opt | | GTC for fixed price | *observed*, Inventory spec |
| Offers | opt | `bestOfferTerms`: bestOfferEnabled, autoAcceptPrice, autoDeclinePrice. Not available on multi-variation listings | | *observed*, Inventory spec |
| Quantity | req | `availability.shipToLocationAvailability.quantity`; `lotSize`; `quantityLimitPerBuyer` | | *observed*, Inventory spec |
| Photos | req, at least 1 | HTTPS URLs, up to 24 in almost any category at no cost, at most 12 per variation | | *observed*, Inventory spec. Pixel size, ratio, first-photo rule: not found (Ben's 1500 px figure stays *asserted*) |
| Video | opt | one per listing, through the Media API (`videoIds`) | | *observed*, Inventory spec |
| Keywords or hashtags | none | no tag field. Search reads title, specifics | | *observed* absence in spec |
| Location | req (`merchantLocationKey`) | a saved inventory location. Pickup via `pickupAtLocationAvailability` | | *observed*, Inventory spec |
| Regulatory | per category and region | `regulatory`, compliance and take-back policy ids. Charger aspects required in the EU and Northern Ireland for some rechargeable devices from 2024-12-28 | | *observed*, Inventory spec |

### eBay condition ids (US)
*Observed* 2026-11-14, https://developer.ebay.com/api-docs/sell/static/metadata/condition-id-values.html. The Inventory enum is in capitals.

| Id | Enum | Meaning from the page |
|---|---|---|
| 1000 | NEW | new, unused, unopened, unworn, undamaged. Display: New, Brand New, New with box/tags, New/Factory Sealed, Digital Good |
| 1500 | NEW_OTHER | new, no wear, packaging missing or opened, may be a factory second |
| 1750 | NEW_WITH_DEFECTS | new with defects |
| 2000, 2010, 2020, 2030 | CERTIFIED_, EXCELLENT_, VERY_GOOD_, GOOD_REFURBISHED | restricted: seller must apply and be approved, and use a seller user token |
| 2500 | SELLER_REFURBISHED | replaced by 2010 to 2030 in some marketplaces |
| 2750 | LIKE_NEW | for trading cards and coins it means Graded |
| 2990 | PRE_OWNED_EXCELLENT | apparel categories only |
| 3000 | USED_EXCELLENT | display Used, Pre-owned, Open Box. In many apparel categories "Pre-owned - Good" (gently used, light wear). Trading cards: used. Salvage: graded, eligible members only |
| 3010 | PRE_OWNED_FAIR | apparel only, significant flaws |
| 4000 | USED_VERY_GOOD | for trading cards and coins it means Ungraded |
| 5000 | USED_GOOD | |
| 6000 | USED_ACCEPTABLE | |
| 7000 | FOR_PARTS_OR_NOT_WORKING | |

The allowed subset and the label vary per category; `getItemConditionPolicies` returns them (fields: categoryId, categoryTreeId, itemConditionRequired, itemConditions[] each with conditionId, conditionDescription, conditionHelpText, usage, conditionDescriptors) *observed*, Metadata spec. The consumer help page on apparel conditions: not reached.

### eBay `getItemAspectsForCategory` (Taxonomy v1.1.1) *observed*
Per aspect, `aspectConstraint` holds: aspectRequired (bool); aspectUsage (RECOMMENDED or OPTIONAL; a required aspect still shows RECOMMENDED); aspectMode (free text or selection); aspectDataType; aspectFormat (DATE as YYYY, YYYYMM or YYYYMMDD; NUMBER as int32 or double); aspectMaxLength; aspectApplicableTo (product or instance); aspectEnabledForVariations; itemToAspectCardinality (single or multi); expectedRequiredByDate; aspectAdvancedDataType (NUMERIC_RANGE). Also aspectValues[] (localizedValue, valueConstraints) and localizedAspectName. `relevanceIndicator` (buyer-demand ranking) is restricted and needs an App Check ticket. This means a required-field list per item is computed per category at listing time, not fixed.

### eBay catalog and identifiers *observed*
- Catalog API v1_beta.5.3 paths `/product/{epid}` and `/product_summary/search`. Product holds epid, title, brand, mpn[], gtin[] (UPC, EAN, ISBN), description, image, additionalImages, aspects, primaryCategoryId, otherApplicableCategoryIds, productWebUrl.
- Inventory spec: if an ePID or GTIN matches the catalog, title, description, aspects and a stock image fill in automatically (`includeCatalogProductDetails` on the offer).

## 2. Facebook Marketplace

No consumer help page was reached (facebook.com/help returned SOURCE_NOT_AVAILABLE). Two sources: Meta's partner Item API page https://developers.facebook.com/docs/marketplace/partnerships/itemAPI/ (via Exa search 2026-11-14, text not date-stamped; this is the partner feed for approved partners, not the individual seller form) and Ben's note. Consumer form values come from third-party blogs, all *asserted*.

| Field | Req | Type and limit | Allowed values | Mark and source |
|---|---|---|---|---|
| Title | req | partner feed: 200 chars. Consumer form: 99, 100 or 150 reported, sources disagree | | partner limit *observed* (Item API page); consumer *asserted* ([facebook-marketplace.md](../ben/platforms/facebook-marketplace.md) line 89) |
| Description | opt on the form, req on the feed | feed: 9999 chars, only the first 256 shown on the listing | | *observed* (Item API page) |
| Category | req | the consumer form has a category tree; feed has `fb_product_category` | not found as a list | *asserted* (blogs). Depth not found |
| Condition | req | consumer: New, Used - Like New, Used - Good, Used - Fair | feed `condition`: new, refurbished, used, used_like_new, used_good, used_fair, cpo, open_box_new. Feed `partner_product_condition` adds finer values (for_parts_or_not_working, graded, ungraded, new_with_tags, damaged and others) | feed *observed* (Item API page); consumer values *asserted* (search snippet of listing-forge.com 2026-02-10, whop.com 2024-09-11) |
| Brand | feed req ("N/A" if none). Consumer form optional, by category | string | | feed *observed*; consumer *asserted* ([facebook-marketplace.md](../ben/platforms/facebook-marketplace.md) line 95) |
| Price | req | feed: number plus ISO 4217 code. Consumer: whole currency units, 0 for free | | feed *observed*; consumer *asserted* (blogs) |
| Sale price | opt (feed) | with effective dates | | *observed* (Item API page) |
| Size, colour, material, and ~80 more | opt | feed `partner_attribute_data` keys include size, us_shoe_size, waist_size, inseam, material, fabric_type, color, department, dress_length, sleeve_length, sport, platform, storage_capacity, screen_size, ring_size, year, mpn, model, voltage and others | | *observed* (Item API page), key list truncated in my copy |
| Photos | req, at least 1 | consumer: up to 10 (*asserted*). Feed: main image JPEG or PNG, at least 500 x 500 px, up to 8 MB, plus up to 20 additional | | feed *observed*; consumer count *asserted* ([facebook-marketplace.md](../ben/platforms/facebook-marketplace.md) line 23) |
| Video | not found | | | not found |
| Tags | opt, up to 20 | | | *asserted* ([facebook-marketplace.md](../ben/platforms/facebook-marketplace.md) line 96). Not found on an official page |
| Location | req for local sale | consumer: auto-filled from profile, editable. Feed: lat and long required if `in_person` | | consumer *asserted* (whop.com blog); feed *observed* |
| Delivery method | req | local pickup, shipping, or both. Feed `partner_delivery_method`: shipping, in_person | | *asserted* (consumer, blogs); feed *observed* |
| Shipping | for shipped | prepaid USPS label by weight or seller's own label. Feed: `partner_shipping_type` free, fixed, dynamic; cost; speed "min:max" days | | consumer *asserted* (blogs 2026-09-23); feed *observed* |
| Package weight and size | for prepaid label | not found on an official page | | not found |
| Offers | opt | consumer "or best offer" toggle *asserted* | | *asserted* |
| Quantity | opt | "a stock if you have more than one unit" | | *asserted* (whop.com 2024-09-11) |
| Listing type | req | item, vehicle, housing; feed adds auction, rental, real_estate | | *observed* (Item API page) |
| Meta AI fill | | Meta AI can fill fields from photos | | *asserted* (thepennyhoarder.com 2026-09-23); Ben cites Meta's 2026-03 post ([facebook-marketplace.md](../ben/platforms/facebook-marketplace.md) line 27) |

## 3. Depop

Source: https://partnerapi.depop.com/api-docs/openapi.yaml, `ProductCreateRequest`, spec version 1.0.0, fetched 2026-11-14 *observed*. This is the partner Seller API, which sits behind approval; the app form is the same data model *inferred*. Consumer help: https://depophelp.zendesk.com/hc/en-gb/articles/360032716413-How-to-list-an-item and .../360020435158-Tips-for-describing-your-item (*observed* through Exa text, no page date). Depop has no title field: the first line of the description serves *observed* (help page "start with a title" inside the description; Depop spec has no title key).

| Field | Req | Type and limit | Allowed values | Mark and source |
|---|---|---|---|---|
| Title | none | | | *observed* absence (spec) |
| Description | req | max 1000 chars; no email addresses; up to 5 hashtags | | *observed* (spec). Hashtag cap also on the help page |
| Category | req | `department` plus `product_type` (a hidden "group" level between) | department: womenswear, menswear, kidswear, everything-else | *observed* (spec). `product_type` list: not found (the attributes endpoint returned 403) |
| Brand | req | `brand_name` string | | *observed* (spec) |
| Size | req when the product type has a size set | `size_set_id`, `size_id` | not found (403) | *observed* rule; values not found |
| Colour | opt | max 2 | | *observed* (spec; help page also says up to two) |
| Condition | req | | brand_new, used_like_new, used_excellent, used_good, used_fair | *observed* (spec). Depop's wording for each grade: not found |
| Style, age, source | opt | arrays of ids | not found (403) | *observed* fields |
| Attributes | per product type | `attributes{id: [values]}` | not found (403) | *observed* field |
| Measurements | none as fields | in the description. Help: "add the exact measurements" | | *observed* (help page) |
| Material | none as a field | | | *observed* absence (spec) |
| Hashtags | opt | up to 5, in the description | | *observed* |
| Price | req | `price_amount` string, at least 1.00, 2 decimals; `price_currency`; `discount_price` opt | | *observed* (spec) |
| Offers | opt | `auto_send_offer_price` (at least 5% off, 1 hour delay, goes to likers and baggers); `auto_negotiate_offer_price` (at least 5% off) | | *observed* (spec) |
| Quantity | req | integer, at least 1 | | *observed* (spec) |
| Photos | req, 1 to 8 | URLs, JPG, WebP or PNG, non-square allowed, first is the main image. App lists up to 4 photos plus 1 video; web up to 8 | | spec *observed*; help page 4 or 8 and video *observed*. Pixel size: not found |
| Shipping | req one of two | `national_shipping_cost` (0 is free) and `international_shipping_cost`, or `depop_shipping` {address_id, shipping_provider_id, parcel_size_id, payer buyer or seller}; not both | | *observed* (spec) |
| Package weight and size | via `parcel_size_id` | a Depop parcel size, not a weight | | *observed* (spec) |
| Location | req | `address` {country_code req, state opt} | | *observed* (spec) |
| SKU | opt | max 50, unique, never reusable | | *observed* (spec) |
| Boost | opt | `is_boosted` | | *observed* (spec) |
| Hashtag or keyword generation | | Depop generates tags and keywords for a listing | | *observed* (help page "Tips for describing") |

## 4. Poshmark

No API. Sources: https://blog.poshmark.com/2024/03/25/posh-tip-how-to-list-on-poshmark/ (2024-03-25), https://blog.poshmark.com/2015/09/21/how-to-create-a-listing-on-poshmark/ (2015-09-21, old), https://blog.poshmark.com/2026/01/01/learn-to-sell-on-poshmark/ (2026-01-01), https://blog.poshmark.com/2026/03/25/your-guide-to-portrait-photos/ (2026-03-25), https://blog.poshmark.com/new-listing-features-to-make-sales/ (2026-03-25), https://poshmark.com/posh_guide/how_to_list_item (undated); all *observed* 2026-11-14. The support centre was not reached.

| Field | Req | Type and limit | Allowed values | Mark and source |
|---|---|---|---|---|
| Photos | req, at least 1 | up to 16 plus 1 video. Cover is shown in 3:4 portrait since 2026-03-25; square photos still accepted and cropped in search and feed | | *observed* (2024 and 2026-03-25 posts). Pixel size: not found |
| Title | req | "Brand + Product Type + Key Attributes". Limit 80 is Ben's figure | | format *observed* (2026-01-01 post); limit *asserted* ([poshmark.md](../ben/platforms/poshmark.md) line 80) |
| Description | req | no limit on the posts. 1500 appears in a vendor guide | | limit *asserted* (fluf.io, unverified) |
| Category | req | department, category, subcategory (the posts say "add a subcategory") | | *observed* (2024 post). Three levels *asserted* ([poshmark.md](../ben/platforms/poshmark.md) line 86) |
| Size | req | pre-defined sizes preferred; custom sizes do not appear in the My Size filter; one listing per size unless Quantity is on (then size and quantity pairs) | | *observed* (2015 post, 2024 post) |
| Brand | opt, with an incentive | pick from a list, or custom. Changeable up to 3 times per listing. Leave blank if unbranded. Using another brand to advertise is prohibited | | *observed* (2015 post, so the "3 times" figure is old); 2024 post says brand adds exposure |
| Colour | opt | up to two (2024 post); four (2015 post) | | *observed*, the two posts disagree; 2024 is newer |
| Condition | req since Nov 2025 per Ben | NWT toggle ("New with Tags"); Boutique tag needs seller certification. Like new, good, fair reported by sellers | exact definitions: not found | NWT *observed* (2024 post); Boutique *observed* (https://poshmark-business-se.instantdocsbase.com/help/what-is-a-boutique-listing, updated 2025-10-21); like new, good, fair *asserted* ([poshmark.md](../ben/platforms/poshmark.md) line 90) |
| Style tags | opt | pre-populated list or custom; silhouette, material, aesthetic. Count: not found. Ben says 3 | | *observed* (2026-03-25 post); count *asserted* ([poshmark.md](../ben/platforms/poshmark.md) line 91) |
| Original price | req | | | *observed* (2024 post lists it among the six main fields) |
| Listing price | req | shows earnings after fees | | *observed* (2024 post) |
| Quantity | opt | | | *observed* (2024 post) |
| SKU, cost price, other info | opt, private | seller-only; show in sales and inventory reports | | *observed* (2024 post) |
| Material, measurements | none as fields | in the description | | *observed* (2024 post) |
| Hashtags | none | | | not found; Ben: no Poshmark statement ([poshmark.md](../ben/platforms/poshmark.md) line 129) |
| Shipping | fixed | prepaid label. Default weight up to 5 lb per Ben | | *asserted* here; Ben cites a 2026 Poshmark blog ([poshmark.md](../ben/platforms/poshmark.md) line 190) |
| Package weight and size | none | | | *observed* by absence from the posts |
| Offers | opt | Smart Sell sends offers and answers counteroffers in a set range | | *observed* (2026-01-01 post) |
| Location | none | | | *observed* by absence |

## 5. Mercari

Sources, *observed* 2026-11-14: the Creating a Listing help page and the Item conditions help page on help.mercari.com (copyright 2026; exact URLs are in my scratch captures, the page URLs are the help.mercari.com article titles "Creating a listing" and "Item conditions"). Ben's [mercari.md](../ben/platforms/mercari.md) cites the same help centre.

| Field | Req | Type and limit | Allowed values | Mark and source |
|---|---|---|---|---|
| Photos | req | up to 12; first photo is first seen; reorderable later | | *observed* (help, Creating a listing) |
| Title | req | 80 chars | | limit *asserted* ([mercari.md](../ben/platforms/mercari.md) line 92); not on the help page |
| Description | req | 1000 chars | | limit *asserted* ([mercari.md](../ben/platforms/mercari.md) line 93) |
| Category | req | three levels | | *asserted* ([mercari.md](../ben/platforms/mercari.md) line 98); help says category improves searchability *observed* |
| Brand | opt, improves visibility | pick from a list | | *observed* (help) |
| Condition | req | New, Like New, Good, Fair, Poor | see below | *observed* (help, Item conditions) |
| Size, colour | opt | | | *asserted* ([mercari.md](../ben/platforms/mercari.md) line 101) |
| Price | req | 1 to 2000 USD; up to 5000 for authentication-eligible designer shoes, handbags, wallets; 2000 to 5000 needs extra identity verification | | *observed* (help) |
| Smart Pricing | opt | price plus floor price | | *observed* (help) |
| Hashtags | opt | help gives no count, only "don't add brand names or hashtags that don't relate". Ben says 3 | | count *asserted* ([mercari.md](../ben/platforms/mercari.md) line 97); not confirmed on the page |
| Shipping | req | seller gives weight first, then sees carrier options by weight class, then may be asked for package size (dimensional weight). Seller or buyer pays | | *observed* (help) |
| Shipping limits | | over 50 lb, insurance over 200 USD, or a package over the 34 inch size limit: ship on your own. Media Mail only for eligible books, music, movies. First-Class Envelopes only for trading cards. Prepaid label includes up to 200 USD Shipping Protection | | *observed* (help) |
| Offers | opt | offers on by default per Ben; Promote and Offer to Likers need a 5% drop per Ben | | *asserted* ([mercari.md](../ben/platforms/mercari.md) line 23) |
| Quantity | not found | | | not found |
| Location | none | ships from the seller's address | | *observed* by absence |
| Draft | opt | save draft | | *observed* (help) |
| Prefill | | Mercari may recognise the item and prefill details | | *observed* (help) |

### Mercari condition definitions *observed* 2026-11-14 (Item conditions page)
- New: unused, original tags, sealed, or original manufacturer condition.
- Like New: used very lightly or not at all, no tags (NWOT).
- Good: gently used, minor flaws.
- Fair: multiple visible signs of wear.
- Poor: heavily worn, major flaws, or parts only, sold as is.
- Clothing: New is unworn with tags (may have been tried on); fit and measurement guidance. Shoes: New is original box, unworn; Like New is unworn, may lack the box. Electronics: battery health 98% or higher for New and Like New, 80% or higher for Good, 50 to 79% for Fair, under 50% for Poor. Furniture: New is unused, unbuilt or in the original box. Collectibles: shelf wear is tolerated.

## 6. Differences by kind of item

Mark: eBay rows *observed* from the specs unless stated. Other sites *observed* where the page says so, else *inferred* from the field tables above.

| Kind | eBay | Facebook | Depop | Poshmark | Mercari |
|---|---|---|---|---|---|
| Clothing | size, brand, colour, style, material as aspects; conditions 2990 and 3010 exist for apparel only | size and brand optional, by category | department, size set mandatory, brand req, measurements in text | size req, brand opt, NWT toggle, style tags | size opt, New means unworn with tags (even if tried on) |
| Shoes | aspects (size, width, brand); box rule is a category matter, not in the specs I read | feed key us_shoe_size | size set mandatory when the type has one | size by category chart | New means original box, unworn |
| Bags | brand, material, colour as aspects | optional | brand req | brand, colour | authentication-eligible designer bags may list to 5000 USD |
| Furniture | package weight and size, large item shipping; local pickup via location | strongest fit: local pickup, no fee per Ben ([facebook-marketplace.md](../ben/platforms/facebook-marketplace.md) line 10) | department "everything-else" | outside the category list per Ben ([poshmark.md](../ben/platforms/poshmark.md) line 16) | mostly over label limits; returns over 50 lb need a seller-paid label; New means unused, unbuilt or boxed |
| Electronics | MPN, UPC, model, storage as aspects; refurbished grades 2000 to 3030 need seller approval; EU charger aspects from 2024-12-28 | feed keys storage_capacity, screen_size, voltage, platform | attributes by product type, ids not found | small electronics only per Ben | battery health thresholds per grade |
| Trading cards, collectibles | condition 2750 means Graded, 4000 means Ungraded; condition descriptors required (e.g. 40001 Card Condition; Grade and Grader together; Certification Number free text max 30) | feed partner_product_condition has graded, ungraded | "everything-else" | not named in Ben's category list | First-Class Envelopes only for trading cards; shelf wear tolerated for collectibles |
| Books and media | ISBN, UPC in product fields; Catalog API match fills title, description, aspects, image | feed key isbn not in my truncated copy: not found | not found | media: "avoid" per Ben ([poshmark.md](../ben/platforms/poshmark.md) line 253) | Media Mail only for eligible books, music, movies |

## 7. What each site says drives search placement

| Site | Statement | Mark and source |
|---|---|---|
| eBay | Aspects feed filters; `relevanceIndicator` ("Buyer Demand Data") exists in the Taxonomy API but is restricted. A site statement on Best Match weights: not found | *observed* (Taxonomy spec) |
| Facebook | none from Meta found. "Distance is a ranking input" is Ben's | *asserted* ([facebook-marketplace.md](../ben/platforms/facebook-marketplace.md) line 15) |
| Depop | "The more complete your listing is, the better we can match it to buyer searches"; category, subcategory, brand, colour (up to two), style, quantity listed; "Giving as much info as possible ... will make them easier to find"; Depop auto-generates tags and keywords; "only include relevant words, hashtags, brands, and tags" | *observed* (Depop help, Tips for describing your item) |
| Poshmark | brand "will give your listing more exposure"; "the more descriptive you are, the more likely a shopper will see your listing"; NWT is a shopper filter; Style Tags make listings discoverable and may show in trend emails; lead the title with the brand "to improve visibility"; non-custom sizes only appear in the My Size filter | *observed* (blog posts 2015, 2024, 2026-01-01, 2026-03-25) |
| Mercari | the more accurate a listing, the higher it appears; brand, category and condition improve search-ability; no brand or hashtag stuffing | *observed* (help, Creating a listing) |

## 8. Where this confirms, extends or contradicts existing notes

- Confirms [poshmark.md](../ben/platforms/poshmark.md) lines 8 and 136: the 3:4 cover since 2026-03-25 is on Poshmark's own post, which I opened.
- Extends [poshmark.md](../ben/platforms/poshmark.md) line 91: Poshmark's own posts do not give a style tag count; the "up to 3" is still unconfirmed.
- Contradicts nothing in [poshmark.md](../ben/platforms/poshmark.md) on colour, but the Poshmark posts disagree with each other (four colours in 2015, two in 2024); the item record should hold two.
- Confirms [mercari.md](../ben/platforms/mercari.md) lines 97 and 98: the help page gives no hashtag count; the page's own text still says "improves searchability" for category.
- Extends [mercari.md](../ben/platforms/mercari.md): the five Mercari condition definitions and per-kind condition rules, with battery thresholds.
- Confirms [ebay.md](../ben/platforms/ebay.md) section 5 on the field set (Inventory spec has title, description, aspects, condition, package, policies, best offer). Extends it with the full aspect constraint list, condition descriptors, and the restricted refurbished grades. The 80-character title limit stays *asserted*; the spec text I read gives no number.
- Extends [facebook-marketplace.md](../ben/platforms/facebook-marketplace.md) line 89: the partner feed limit for title is 200 and for description 9999 (first 256 displayed), but that is the partner feed and not the seller form, so the consumer title limit stays unresolved.
- Item-card table, rows below against [item-card.md](../../../spec/features/item-card.md) lines 28 to 43: see section 9, column "vs item-card".
- [platform-access.md](../../connect/nate/platform-access.md) was not re-read for this table; I found nothing that contradicts it.

## 9. Merged table (*inferred*: my union of sections 1 to 5, and the capture-supply column is my reasoning)

Capture-supply codes: **label** (read from a tag or label), **measured** (a tape or the measure feature), **seen** (visible in the image), **lookup** (from the identified product, GTIN or catalog), **owner** (only the owner knows).

| Field | eBay | Facebook | Depop | Poshmark | Mercari | Capture supplies | vs item-card lines 31 to 41 |
|---|---|---|---|---|---|---|---|
| Photos, count | 1 to 24 | 1 to 10 | 1 to 8 | 1 to 16 | up to 12 | seen | confirms "at least 1". Counts differ by site |
| Video | 1 | not found | app 1 | 1 | not found | seen | not in item-card |
| Title | req | req | none (first line of description) | req | req | seen, label, lookup | confirms (Depop "from description") |
| Description | req | opt | req, 1000 chars, 5 hashtags | req | req | seen, label, owner (flaws) | not in item-card |
| Category | req, per tree, sets aspects | req | department plus product type | dept, category, sub | 3 levels | seen, lookup | confirms |
| Brand | aspect, conditionally req | opt (feed req) | req | opt but boosts | opt but boosts | label, lookup | contradicts: Depop brand is required, not "asked"; Poshmark brand is optional per the 2024 post, item-card says "yes" |
| Model, MPN | aspect, some categories | feed key | none | none | none | label, lookup | not in item-card |
| GTIN, ISBN, ePID | catalog match | feed has isbn | none | none | none | label (barcode), lookup | not in item-card |
| Size | aspect | opt | req when the type has a size set | req | opt | label, measured | contradicts: Poshmark and Depop make it required; item-card says "clothes" for both. Facebook size is optional, not "no" |
| Measurements | aspect, optional | in text | in text | in text | in text | measured | not in item-card |
| Colour | aspect | opt | up to 2 | up to 2 | opt | seen | not in item-card |
| Material | aspect | opt | none | in text | none | label, seen | not in item-card |
| Style, tags | aspect | up to 20 *asserted* | style ids, 5 hashtags | style tags | hashtags | seen, lookup | not in item-card |
| Condition grade | ids, per category | 4 values | 5 values | NWT plus 3 values | 5 values | seen (partly), owner | confirms "yes"; the scales differ per site |
| Condition detail | max 1000 text; descriptors for cards | description | description | description | description | seen (flaws), owner | not in item-card |
| Item specifics | per category | by category | by product type | none | none | label, seen, lookup | extends |
| Price | req | req | req, min 1.00 | req, plus original price | req, 1 to 2000 | owner, lookup (comps) | confirms |
| Original retail price | opt | opt sale price | discount price | req | none | lookup, owner | not in item-card |
| Offers | best offer, auto accept and decline | toggle | auto offers at least 5% off | Smart Sell | on, 5% promote | owner | not in item-card |
| Quantity | req | opt | req | opt | not found | owner | not in item-card |
| Package weight | for calculated | label | parcel size id | fixed 5 lb default | req (weight first) | measured (scale) | confirms in spirit |
| Package size | for calculated | not found | parcel size id | none | when dimensional | measured | confirms |
| Shipping choice | policy | pickup, ship, both | national cost or Depop label | fixed label | seller or buyer pays | owner | confirms |
| Location | saved location, req | req for local | address (country) | none | none (ship-from) | owner | contradicts: Depop needs an address with country; item-card says "no". eBay location is a saved inventory location, not item data |
| SKU | opt | feed id | opt, 50 | private field | not found | owner | fits item-card's seller SKU |
| Regulatory | by category and region | not found | not found | not found | not found | lookup | not in item-card |

## Not found
- Depop attribute, size, colour, style, age and source value lists (the attributes endpoint returned 403), and Depop's own wording for its five conditions.
- Facebook Marketplace: any official consumer help page; the consumer title limit; category list and depth; video; package-weight rule; whether tags exist (20 is Ben's memory).
- Poshmark: official support-centre text, the exact condition wording, style-tag count, title and description limits, pixel size.
- Mercari: title and description limits, the hashtag count, size and brand field rules, quantity, category depth.
- eBay: the consumer condition help (apparel), photo pixel size and ratio rules, the title limit in official text, any statement of Best Match ranking weights, a category depth figure.
- Per-kind: Depop and Poshmark rules for books, media, cards; Facebook condition grades by kind.

## Searched / could not reach
- eBay `getItemConditionPolicies` doc page and the consumer condition help: 403 and a bot check. Used the OpenAPI JSON specs instead.
- eBay developer doc pages are JS shells; used the specs.
- `https://api.depop.com/api/v3/attributes/`: 403.
- https://www.facebook.com/help/1889067784738765: SOURCE_NOT_AVAILABLE. Meta's partner Item API page reached through search only (not opened by direct fetch).
- The eBay "listing photos" help URL I tried returned an unrelated page (ending a listing).
- Third-party posts (listing-forge, whop, thepennyhoarder, fluf, sellura) are *asserted*, search snippets only, and used only where labelled.

## Sources fetched
- https://partnerapi.depop.com/api-docs/openapi.yaml (spec 1.0.0)
- https://developer.ebay.com/api-docs/commerce/taxonomy/openapi/3/commerce_taxonomy_v1_oas3.json, .../sell/inventory/openapi/3/sell_inventory_v1_oas3.json, .../sell/metadata/openapi/3/sell_metadata_v1_oas3.json, .../commerce/catalog/openapi/3/commerce_catalog_v1_beta_oas3.json
- https://developer.ebay.com/api-docs/sell/static/metadata/condition-id-values.html
- Mercari help pages "Creating a listing" and "Item conditions" (help.mercari.com, copyright 2026)
- https://blog.poshmark.com/2026/03/25/your-guide-to-portrait-photos/ (2026-03-25)
- https://blog.poshmark.com/new-listing-features-to-make-sales/ (2026-03-25)
- https://blog.poshmark.com/2026/01/01/learn-to-sell-on-poshmark/ (2026-01-01)
- https://blog.poshmark.com/2024/03/25/posh-tip-how-to-list-on-poshmark/ (2024-03-25)
- https://blog.poshmark.com/2015/09/21/how-to-create-a-listing-on-poshmark/ (2015-09-21)
- https://poshmark.com/posh_guide/how_to_list_item
- https://poshmark-business-se.instantdocsbase.com/help/what-is-a-boutique-listing (updated 2025-10-21)
- https://depophelp.zendesk.com/hc/en-gb/articles/360032716413-How-to-list-an-item and .../360020435158-Tips-for-describing-your-item (undated)
- https://developers.facebook.com/docs/marketplace/partnerships/itemAPI/ (search text, undated)
- Opened only as search snippets (asserted): fluf.io, listing-forge.com, whop.com, thepennyhoarder.com, sellura.io
