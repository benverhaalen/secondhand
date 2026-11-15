# Do eBay's listing-help APIs improve how we list, and do other sites have the same?

Researched 2026-11-15 by Ben (Claude Code, thread "Cross-list Depop listings and price with quant"). Feature: list. Asked by Ben at 07:41 and 07:42 ([words](../../../product/words.md#2026-11-15-check-ebays-listing-help-apis-and-whether-other-sites-have-the-same)).

**Tags.** *Observed*: read at the source this session. *Asserted*: seen in a search result or a summary, not reopened. *Inferred*: our reasoning.

## Short answer

One of the three APIs is worth building on: the Taxonomy API's item aspects. It tells us, for each eBay category:
- which item specifics are required;
- which are recommended;
- which values are allowed;
- with approval, how often buyers search on each one.

That is the "fill every specific" rule we already had in [ebay.md](platforms/ebay.md), now driven by eBay's live list instead of our guesses. It is built: `aspectRows` and `aspectGaps` in [aspects.ts](../../../app/src/engines/listing/aspects.ts).

The Sell Recommendation API only suggests an ad rate for Promoted Listings, so at most it supplies the number on the "promote this?" question. The older Listing Recommendation API had title, item-specifics and price tips, but it is a 2014 to 2016 era service with no current page, so we don't build on it.

No other site has an equivalent we can reach. Etsy is the nearest. *Agent proposal* throughout.

## What each eBay API gives

| API | What it returns | Use here | Mark |
|---|---|---|---|
| Taxonomy `getItemAspectsForCategory` ([ref](https://developer.ebay.com/api-docs/commerce/taxonomy/resources/category_tree/methods/getItemAspectsForCategory)) | Each aspect for one leaf category: required or not, recommended or optional, free text or a fixed list, max length, allowed values. Application token (client credentials), no seller sign-in | Requirement rows for the eBay draft: a missing required aspect blocks posting; a missing recommended one becomes a question for the photo or the person; a value outside a fixed list is flagged | *observed* |
| Its `relevanceIndicator.searchCount` | How many searches used the aspect, "based on 30 days of data". Needs the `metadata.insights` scope through an "App Check" for "Buyer Demand Data" | Order the questions: ask first for what buyers filter on | *observed* |
| Taxonomy `fetchItemAspects` ([api](https://developer.ebay.com/develop/api/buy/taxonomy_api.md)) | Every aspect for every leaf category as one gzipped JSON, "over 100 MB, compressed" | Load the whole set nightly instead of calling once per item | *observed* |
| Taxonomy `getCategorySuggestions` | Leaf categories for a text query; "Suggestions should be treated as recommendations rather than authoritative classifications"; not in the Sandbox | Pick the category, and show the top two when close ([ebay.md](platforms/ebay.md) step 2) | *observed* |
| Sell Recommendation `findListingRecommendations` ([guide](https://www.developer.ebay.com/api-docs/sell/static/marketing/pl-reco-api.html)) | Only `recommendationTypes:{AD}`. Per listing: `promoteWithAd` (RECOMMENDED or UNDETERMINED) and a `bidPercentage` with basis TRENDING, "calculated by averaging the ad rates of the listings that recently sold" in the category. Up to 500 listings a call; US, UK, DE, AU; general (cost-per-sale) campaigns only | The rate shown on the promote question, which stays the person's tap and off by default ([ebay.md](platforms/ebay.md) §10) | *observed* |
| Legacy Listing Recommendation API ([guide](https://developer.ebay.com/devzone/listing-recommendation/Concepts/ListingRecommendationAPIGuide.html)) | Price and format, title keywords, item specifics, product ids, pictures. User token, no Sandbox | None. Copyright 2014 to 2016, not on the deprecation page, not in the current docs. Status unknown | *observed* (page); status *not found* |
| Compliance API, `ASPECTS_ADOPTION` | Used to report listings missing required or recommended aspects | None: the deprecation page lists that type as decommissioned on 2025-08-31. A second read of the same page reported the whole API decommissioned on 2026-03-30; the two reads disagree | *asserted* |

What eBay says about why aspects matter: the listing metadata guide says choosing the right category "will increase chances of interested buyers finding your item in searches". It does not say the same of aspects. Best Match does name "how complete the listing is" ([ebay.md](platforms/ebay.md) §9). Aspects also power the search filters, so an item missing one drops out of that filter (*inferred*).

Refresh: "Use categoryTreeVersion to monitor changes in the category tree" ([listing metadata guide](https://developer.ebay.com/develop/guides/listing-metadata-guide.md), *observed*). No time limit was found.

## eBay's terms

From the [API License Agreement](https://developer.ebay.com/join/api-license-agreement), read in full, *observed*. The clause numbers come from the list layout.

- **Using eBay content.** Allowed only "for the purpose of facilitating your own or Your Users' use of eBay Services".
  - Use for this item: aspect rows carry only an eBay site name and never fill another site's listing. The test checks this.
  - What can still be shared across sites: the photo-read facts (brand, size, colour). Those are ours.
- **Buyer Demand Data.** Banned "in any manner other than for the expressed purpose of constructing or editing of a listing". Ordering the questions for an eBay listing is exactly that purpose.
- **Prices.** Banned: using eBay content "to suggest or model prices for items listed on eBay Sites".
  - This applies to pricing, not to aspects.
  - It is already recorded, and set aside for the demo by Ben's rule ([price build plan](../../price/ben/build-plan.md)).
  - Production still has to resolve it.
- **Age of what we show.** Listing data shown may be at most 6 hours older than eBay; other eBay content at most 24 hours.
  - A nightly aspects load fits the 24-hour limit only if it actually runs every night (*inferred*).

## Other sites

| Site | Per-category attribute list | Listing-quality tips | Mark |
|---|---|---|---|
| Etsy (Open API v3) | `getPropertiesByBuyerTaxonomyId`: "product properties, with applicable scales and values" per category. The seller-side taxonomy calls were not in the current OpenAPI file. Etsy says attributes are "the only way for a listing to appear in filtered search results" ([handbook](https://www.etsy.com/seller-handbook/article/604203126614)) | none; `allow_suggested_title` on getListing returns "a suggested title" to the shop owner | *observed* |
| Facebook Marketplace | Partner Item API: required fields plus `partner_attribute_data` keys ([page](https://developers.facebook.com/docs/marketplace/partnerships/itemAPI/)). Only for approved partners | Commerce Manager issues, for partners only | *observed*; Commerce Manager *asserted* |
| Depop | a Partner API exists ([depop-import.ts](../../../app/src/edge/connect/depop-import.ts) maps its Product shape), but no attribute endpoint was reached this session | none found | *not found* |
| Poshmark, Mercari | no public API; help pages refused the fetch | none found | *not found* |

What this means (*inferred*):
- eBay is the only site where a live, per-category list is within reach.
- For Etsy, the same `aspectRows` shape could be fed from its buyer-taxonomy properties once Etsy is linked.
- Depop, Poshmark, Mercari and Facebook keep our own requirement rows ([listing-fields-by-platform.md](../nate/listing-fields-by-platform.md)).

## What changes in our method

1. **The site supplies the requirement list where it can.** On eBay the rows come from Taxonomy, not from our fixture. Elsewhere they come from our rows. The draft logic does not change, because `buildListing` reads the rows either way.
2. **Fill from evidence, ask for the rest, never guess.**
   - A required aspect missing: the draft is not ready.
   - A recommended aspect missing: it goes to the capture questions, to be read from the photo, the tag or a measurement.
   - A value outside eBay's fixed list: it is mapped to the nearest allowed value with the person's confirmation, or asked for.
   - Auto-filling every recommended aspect from the photo is right only for what the photo actually shows. Material and model numbers stay asked ([ebay.md](platforms/ebay.md), specifics rule).
3. **Ask required first, then recommended.** Ordering by what buyers search would need eBay to approve Buyer Demand Data. Ben said no applications yet ([words](../../../product/words.md#2026-11-15-no-applications-to-marketplaces-yet)), so `searchCount` is used only if a reply ever carries it.
4. **Ad rate as information.** eBay's trending rate is the number shown when the person decides whether to promote. It is never applied automatically.

## Not found

- The legacy Listing Recommendation API's status.
- Whether the whole Compliance API or only one of its types is gone.
- How long eBay takes to approve Buyer Demand Data, and what it asks for.
- Any attribute endpoint for Depop, Poshmark or Mercari.
