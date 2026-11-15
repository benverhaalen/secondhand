# What makes a used-item listing findable on each marketplace, and which rules hold on all of them?
Researched 2026-11-14 by Ben (Claude Code). Feature: list.

Ben asked for "adequate seo for this usecase, platform specific" and "a base rule set for everything, or plan it to happen once the brand is ratified" ([words](../../../product/words.md#2026-11-14-fresh-image-agents-how-references-are-used-and-a-reference-set)). This note is the rule set. The numbers are data in [platform-fit.json](platforms/platform-fit.json) (`title`, `tags`, `search`, `description` per site) and the check is [scripts/listing-lint.mjs](../../../scripts/listing-lint.mjs). How each site ranks is already in Nate's [ranking-algorithms.md](../nate/ranking-algorithms.md), and how a title's words are chosen is [D4 to D7](../../../spec/determinations/listing-and-marketing.md#d4-title-per-site); this note does not repeat either.

The strategy behind these rules, and what would overturn it, is in [listing-seo-strategy.md](listing-seo-strategy.md).

## Short answer

1. Search on these sites does three things in order: it finds listings that contain the buyer's words, it removes listings that fail the buyer's filters, and it ranks what is left. A seller controls the first two almost fully and the third barely. So the work is vocabulary and filled fields, and no clever wording is needed *inferred*.
2. Two mechanical facts carry most of the value. A word that is not in the searched text cannot match. A blank filter field removes the listing when a buyer uses that filter: eBay says an item "will only appear in those filtered search results if you've added the matching item specific" *observed*, and Depop says the same of its filters *observed* ([depop.md §7](platforms/depop.md#7-tags-categories-and-structured-data)).
3. No controlled test shows that any title wording changes rank on any of these sites ([ranking-algorithms.md](../nate/ranking-algorithms.md#cross-site-findings-observed)). Word order, front-loading and tag recipes are the sites' own advice or seller folklore. We follow the sites' advice because it is cheap, and we do not promise a lift.
4. The same facts make a different listing on each site. What changes is which field carries the words, how long the title may be, whether tags exist and whether they may repeat the title, and which fields are filters. The slot order changes little.
5. The rules do not wait for the brand. A listing is the seller's words on someone else's site, so our brand voice never appears in it. What waits is the wording of the one-line reasons we show in the app.
6. Every site punishes the old tricks in writing: other brands' names, repeated keywords, unrelated tags. The honest rule and the search rule are the same rule: only words a fact backs.

## The base rules (every site)

Each rule is checked by code where a script can find every instance. The rest is one line in the writer's brief. Ids are the ones `listing-lint.mjs` prints.

| # | Rule | Why | Checked by |
|---|---|---|---|
| B1 | Every word in a title or tag is backed by a confirmed fact about the item | Mercari: "Use clear and descriptive keywords that accurately portray your item", "Avoid irrelevant terms" *observed*. Depop: "Don't include irrelevant or repetitive keywords, hashtags, brands or tags" *observed*. It is also our claim check | K1, blocks |
| B2 | The brand and the item type sit in the first 40 characters | eBay: "Front-load your titles with relevant keywords" *observed*. Depop: "adding the most appropriate keywords at the start of the title" *observed*. Tiles cut titles short *asserted* | T3 |
| B3 | Each word once | Depop names "repetitive keywords" *observed*. A repeat spends characters that could match another search *inferred* | T4 |
| B4 | No capitals for emphasis, no "L@@K", no emoji, no price, no "free shipping" in a title | eBay: "Don't include promotional text like 'free shipping,' all capital letters, or gimmicky foreign characters" *observed* | T5 |
| B5 | No other brand as bait ("like", "similar to", "dupe for") | Depop: an unrelated brand "can hurt your listing's exposure" *observed*. Poshmark now weighs down "overly broad or misused keywords in listing descriptions" *observed* | K2, and K1 in titles and tags |
| B6 | Fill every filter field we can back. Ask the person for a blank one. Never guess | Point 2 above. A wrong value causes a return *inferred* | F1, asks |
| B7 | Stay inside the site's length, word and tag limits | The form rejects or cuts the rest | T1, T2, G1, D1 |
| B8 | A word is added to a title only when it completes a buyer search the listing would otherwise miss, and only on a site that searches nothing but the title and fields (eBay). Elsewhere the description carries it. Length alone earns nothing | eBay advises "use all 80 characters" *observed*, but in 33,638 eBay listings long titles sold no better ([strategy](listing-seo-strategy.md#what-the-evidence-says)) | `buildTitle` with searches, `coverage` |
| B9 | No contact details, links or other payment apps | Against every site's rules ([section 13 of each note](platforms/)) | C1, blocks |
| B10 | Deepest correct category | It sets the browse page and which fields exist. Mercari: "Many shoppers on Mercari like to browse product categories instead of typing in a specific search" *observed* | [D7](../../../spec/determinations/listing-and-marketing.md#d7-category-placement) |
| B11 | The description states size, measurements, condition and every flaw, in plain sentences | Poshmark: "the more descriptive you are, the more likely a shopper will see your listing" *observed by Nate*. It also answers the buyer's first question | writer's brief, [D5](../../../spec/determinations/listing-and-marketing.md#d5-description-and-the-facts-it-must-state) |
| B12 | Synonyms a buyer would type (couch and sofa) go where the site has room for them: tags first, then the description, then the title | Depop search rewrites queries by "adding or removing more words" *observed*; no site says it maps synonyms | `facts.keywords`, sourced below |

## What changes on each site

| Site | Search reads | Words go | Title | Tags | Filter fields that must be filled | Named penalty | Outside search |
|---|---|---|---|---|---|---|---|
| eBay | title and item specifics *observed*; description only if the buyer asks *asserted* | title, then item specifics | 80 max | none | category, condition, brand, size, color, plus the category's own aspects from the API | search manipulation *asserted* | Google Shopping, free. For clothing "Google won't display your listings, unless you provide the item specifics for Color, Size, Age Group & Gender" *observed* (eBay community post, undated) |
| Facebook | keyword match, category, condition, price, distance *observed by Nate* (Meta system card) | title, then up to 20 tags | 99 max *asserted*, aim under 60 | 8 to 12 words the title lacks | category, condition | integrity suppression *observed by Nate* | none found |
| Depop | description and listing fields *observed* | first line of the description, then fields | no title field. Line 1 is the headline: "Start with a headline that summarises your item" *observed*. Aim 30 to 65 | 0 to 5 hashtags, none repeating line 1 | category, brand, size, color, condition (style, age and source when known) | lower exposure for irrelevant brands and tags *observed* | none found |
| Poshmark | title, description and the photo ("enhanced keyword and image matching") *observed* | title, then brand and size fields | 80 max *asserted* | up to 3 style tags *asserted*; no hashtags | category, brand, size, color, condition | misused description keywords weigh less *observed* | none found |
| Mercari | keywords *observed*; which field, not stated | title, then 3 hashtags | 80 max *observed* (Mercari blog, 2022), brand first | 3 hashtags that "supplement rather than repeat what you've already written" *observed* | category, brand, condition | "Listing an excessive amount of search keywords" is banned *observed* | none found |
| OfferUp | title and description *inferred*; photos through multimodal search *observed by Nate* | title | 50 max *asserted* | none | category, condition | keywords "to manipulate search" are banned *observed* | none found |
| Grailed | title, designer, description, hashtags *asserted* | designer field, then title | 60 max *asserted*, 7 words or fewer *observed* | 3 to 6 hashtags | category, designer, size, condition, department | none stated | none found |

The same jacket, built by `node scripts/listing-lint.mjs title <site> facts.json` from one set of facts:

| Site | Title | Length |
|---|---|---|
| eBay | `Carhartt Detroit Jacket Men's L Brown` | 37 |
| Facebook | `Carhartt Detroit Jacket Men's L Brown` | 37 |
| Depop (line 1) | `Vintage 90s Carhartt Detroit Jacket Brown Size L` | 48 |
| Poshmark | `Carhartt Detroit Jacket Brown Size L` | 36 |
| Mercari | `Carhartt Detroit Jacket Size L Brown` | 36 |
| OfferUp | `Carhartt Detroit Jacket L Brown` | 31 |
| Grailed | `Carhartt Detroit Vintage 90s Brown L` | 36 |

## Where the words come from

In order of trust, and all of them enter as facts with a source, so B1 still holds:

1. The item's confirmed attributes: brand, line, model, type, size, color, material, era.
2. The site's own value for an attribute (eBay aspect values, Depop style names), so the word matches the filter's spelling.
3. Words the best listings for this product use on that site, and the site's search suggestions. This is [D4](../../../spec/determinations/listing-and-marketing.md#d4-title-per-site)'s scoring; it needs live comps.
4. Synonyms for the type, kept as a small table per product type (couch, sofa, sectional). *Agent proposal*: start the table from the 31 product types in the fit list and grow it from comps.

A word from 3 or 4 that no attribute backs is dropped. "Rare", "authentic" and "NWT" are claims, so each needs its own fact.

## The check, and what it costs

`node scripts/listing-lint.mjs <site> draft.json facts.json` takes the spec's draft (`title`, `body`) plus `tags[]`, and prints each problem as `block`, `ask` or `warn`. A `block` stops the post. An `ask` becomes one question to the person ("What size is it?"). It runs in under a millisecond with no model call.

*Agent proposal* for [D4](../../../spec/determinations/listing-and-marketing.md#d4-title-per-site) step 5: the spec has a small model check "length, banned words and that every content word maps to a chosen term". Those three are exact string checks, so plain code does them at no token cost and gives the same answer every time. Keep the model for joining words into a readable line and for the description. `buildTitle` is also the fallback D4 already names for when there are fewer than 10 winning listings: template and attributes only.

When does a rule become code? When a script can find every instance and the rule has a source. Everything else stays one line in the writer's brief, and a rule nobody can check or source is cut. That keeps the brief to rules B10 to B12.

State: *usable*. Proof: `node --test scripts/listing-lint.test.mjs` (17 tests), and it runs inside `node .agents/check.mjs`. Unfinished: eBay's per-category aspects are not read from the API yet, the facts file is hand-written until item-card settles attribute names, the synonym table does not exist, and nothing logs through `log/` because no adapter calls it yet.

## After it is live

Poshmark's own guide gives the order to look in, and it fits every site *inferred*: few impressions means the words or fields are wrong, so fix the title and filter fields; impressions without clicks means the cover photo or price; clicks without offers means the description or sizing ([poshmark.md §6](platforms/poshmark.md#6-title-and-description-conventions)). Which numbers each site gives us is in [list.md](../../../spec/features/list.md#what-the-person-does-and-sees), step 9. Testing whether a title change helped is [D22 and D23](../../../spec/determinations/listing-and-marketing.md#d22-test-design-for-a-change). On Mercari and Depop the fix is an edit in place, never a delete and relist ([mercari.md §12](platforms/mercari.md#12-the-algorithm)).

## What this changed in the platform notes

- Mercari: three hashtags is now *observed* (2022 blog), and they should add words the title lacks. The old example repeated the title.
- Depop: hashtags should not repeat line 1 either; Depop lists "repetitive" beside "irrelevant". Depop also says recency "will have a significantly lower effect on a listing's ranking than relevance has" *observed*, which weakens the case for relisting.
- eBay: the filter rule and the Google Shopping rule are now *observed*. Clothing needs Age Group and Gender as specifics to show on Google.
- Poshmark: the 2024-11-26 search post was read directly. It names image matching, so the cover photo is a search input as well as a click input.

## Limits

- The four source reads today went through a page summarizer, so *observed* means the summarizer returned the quote. Quotes were kept short.
- Mercari's blog post is from 2022-03-31. Depop's two blog pages carry no date (one mentions September 2022). eBay's pages are undated.
- Not found: which fields Mercari, Facebook, OfferUp and Grailed search; any statement that tags affect rank on any site; whether listings on sites other than eBay reach Google Shopping.
- The lint's word check uses a plain stem (a trailing s). A fact spelled differently from the draft ("grey" and "gray") fails until the fact carries both.

## References

| Source | Job | What we take |
|---|---|---|
| [eBay Seller Center, item specifics](https://www.ebay.com/sellercenter/listings/item-specifics) | site advice | filtered results need the matching specific; Google Shopping |
| [eBay Seller Center, listing best practices](https://www.ebay.com/sellercenter/listings/create-listings/best-practices) | site advice | use all 80 characters; product identifiers |
| [eBay community, How to show up in Google Shopping](https://community.ebay.com/t5/Announcements/Traffic-Month-How-to-show-up-in-Google-Shopping/ba-p/30999091) | site announcement | front-load titles; no promotional text; clothing specifics Google needs |
| [Depop, How search works](https://blog.depop.com/articles/depop-search-how-search-works-on-depop) | site advice | headline first; no irrelevant or repetitive words; recency is small |
| [Depop, Getting your description right](https://blog.depop.com/articles/getting-your-description-right) | site advice | size, category and brand as filters; short and specific |
| [Poshmark, Enhancing search and discovery, 2024-11-26](https://blog.poshmark.com/2024/11/26/enhancing-search-discovery/) | site announcement | keyword and image matching; misused description keywords |
| [Mercari, 6 ways to optimize your listings, 2022-03-31](https://blog.mercari.com/us/6-ways-to-optimize-your-listings-for-more-mercari-sales) | site advice | 80 characters; three hashtags that supplement; category browsing |
| [Mercari help 2514](https://www.mercari.com/us/help_center/article/2514) | site help | honest keywords; updates over relisting |
| [ranking-algorithms.md](../nate/ranking-algorithms.md), [listing-fields-by-platform.md](../nate/listing-fields-by-platform.md) | Nate's notes | ranking evidence and field lists, not repeated here |
