# What is the strategy for getting one used item found by the buyer who will pay for it?
Researched 2026-11-15 by Ben (Claude Code, following Ben's strategize-deeply skill). Feature: list.

Ben asked: "use strategize deeply to figure out how to optimize for seo. my harness skill" ([words](../../../product/words.md#2026-11-15-strategize-deeply-on-listing-seo)). The rules that came before this are in [listing-seo.md](listing-seo.md). This note is the strategy brief the skill asks for: objective, mechanism, decision rule, the evidence that decides it, what would flip it, and the next test. Everything here is *agent proposal* unless marked.

## The strategy

**Text is a threshold, and price and the first photo are the dials.** One unit needs one buyer. A listing either can or cannot be found by each search that buyer might run, so the job of the words is to get the listing into every search worth being in, on the first post. Past that point more words buy nothing we can measure, and where the listing shows among the results is set mostly by things that are not text.

So the lister does three things, in this order:

1. **Reach.** Collect the searches buyers run for this item on this site. Count the share of that demand the draft can be found by. Add a word only if it completes a search the draft would miss.
2. **Be right at the first post.** Saved-search alerts and any new-listing lift fire once. Post complete, with the filter fields buyers use filled, and never post a stub to fix later.
3. **Win the click.** A new listing has no history, so a ranker has to guess from its attributes, price against similar listings and first photo, then watches what buyers do. After reach, effort goes to the cover and the price, which other specs own ([studio](../../../spec/features/studio.md), [price](../../../spec/features/price.md)).

## The decision it changes

One item, one site, at draft time. Known: the item's confirmed facts, that site's live and sold comparable listings, its search suggestions. Actions: choose title words, tags, fields, description, cover, price. Outcome we can see: on eBay, search impressions and click-through per listing; elsewhere likes and sometimes views.

| If | Then | Flip it when |
|---|---|---|
| The item has a searchable name (brand plus model, style code or set number) | Lead with brand, model, type, size, color. The searches are narrow, so being found is nearly the same as being seen. Stop there | The narrow search returns hundreds of live results. Then treat it as the next row |
| The item is generic (a black leather jacket, a wood dresser) | Words cannot win a crowded search. Fill the filters buyers use, put it on the sites where people browse (Facebook, Depop, Poshmark feeds), and spend on cover and price | Our own listings in a category get most of their views from search, per the eBay traffic report |
| Buyers call it several things (couch, sofa; chore coat, Detroit jacket) | The extra names go where the site searches them: description and tags. On eBay, which searches only the title and item specifics, they go in the title if they fit | A site says, or a test shows, that it searches the description less than the title |
| A field is not a buyer filter, or we cannot back the value | Leave it blank | A site makes it required |
| eBay shows few search impressions after 3 days | The words or fields are wrong: check coverage, category and filters | |
| Impressions but few clicks | Cover or price | |
| Clicks but no offer or sale | Price, then description | |
| Any fix | Edit in place. Never delete and relist for rank | A site states relisting is neutral |

## How it works: the same problem without marketplace words

Three older problems sit inside "SEO", and each has a field that worked on it.

| Sub-problem | Field that worked on it | What transfers | What breaks |
|---|---|---|---|
| A document's author and its searcher pick different words | Information retrieval: the vocabulary problem, document expansion | Add the searcher's likely queries to the document. In doc2query, appending predicted queries raised keyword retrieval about 15%, and both new words and repeated words helped *observed* | Those documents were long passages; a title has 80 characters, and marketplaces punish unrelated words |
| A fixed budget of characters, many candidate words, overlapping value | Operations research: budgeted maximum coverage | Pick by marginal coverage, heaviest uncovered search first. A word that only repeats what is already matched is worth zero | Search weights are guesses until a site gives query counts |
| A new item with no history must be ranked | Marketplace ranking: cold start | Airbnb's ranker placed new listings worse because it leaned on engagement history; predicting a new listing's engagement from similar listings raised their bookings 14%, while a plain boost raised impressions 8.5% and bookings not at all *observed*. Etsy gives a new listing "a small, temporary boost ... so that Etsy search can learn more about how buyers interact with it" *observed*. eBay patents score a listing at listing time from attributes and price against comparables, then shift to observed sales per impression *observed by Nate* | Different sites, different rankers. The shared point is only that early clicks and a fair price are what a ranker learns from |

## What the evidence says

| Claim | Evidence | Mark |
|---|---|---|
| A blank filter field removes the listing from filtered results | eBay Seller Center; Depop help | *observed* |
| Different people name the same thing differently about 80% of the time | Furnas et al. 1987, via Wikipedia's summary | *observed* (secondary) |
| Longer eBay titles do not sell better | 33,638 single-unit eBay listings from 242 sellers, May to September 2026, compared within seller: 76 to 80 characters against under 70 was +0.8 points of 30-day sell-through, interval -1.2 to +2.2 | *observed* ([FlowLister](https://flowlister.com/ebay-listing-data-study/), a tool vendor's own data; correlation) |
| More item specifics do not sell better | Same study: 16 or more against 10 or fewer was -2.6 points, interval -4.6 to -0.9. Probably confounded by category, but nothing supports filling for its own sake | *observed*, same caveats |
| More photos probably help | Same study: 7 or more against 1 to 6 was +2.5 points, interval -0.4 to +4.6 | *observed*, same caveats |
| Position matters a great deal in a long result list | eBay's own paper: click propensity falls with rank and drops sharply near rank 25 on mobile; Thumbtack: "position 1 receiving far more contacts than position 2" | *observed* (no per-rank numbers in the text) |
| A new matching listing is emailed to buyers who saved that search | eBay help: "We'll send you email alerts when new items matching your search are listed." All seven sites have saved searches | *observed* (eBay); *asserted* for when the others fire |
| Chasing the new-listing lift by relisting does not work | Etsy: "isn't an effective search optimization strategy". Mercari and Depop favor edits | *observed* |
| eBay gives us the instrument | Sell Analytics `getTrafficReport` per listing: search impressions, click-through rate, views by source, sales conversion | *observed* |
| Which words go with higher eBay prices | Birmingham City University, 68,000 listings: "gents" watches averaged more than "men's". Averages only, unpublished | *asserted*; not used |

## What changes in our plan

1. **[D4](../../../spec/determinations/listing-and-marketing.md#d4-title-per-site) scores a word by how many winning listings use it.** That copies sellers, and it rewards the words every listing already has. Proposal for Nate: score a word by the buyer demand it adds that the draft does not already reach. Search suggestions and sold listings' titles supply the searches; winners' share becomes a tie-break.
2. **Stop filling titles to the limit.** D4 step 4 and my own rule B8 did this on eBay's advice. The one data set we have shows no gain. B8 is rewritten and the builder no longer pads.
3. **Stop filling every field.** [D6](../../../spec/determinations/listing-and-marketing.md#d6-attributes-per-site) fills every backed field. Keep required fields and buyer filters; leave the rest unless a search needs the word.
4. **Coverage is now a number.** `node scripts/listing-lint.mjs coverage <site> draft.json facts.json searches.json` prints the share of demand reached and the searches missed. It knows eBay searches title and specifics while Mercari and Poshmark also search the description, so the same draft scores differently per site.

The first decision run through it, a Carhartt Detroit jacket with five buyer searches:

| Site | Title the builder writes | Demand reached by title and fields | Left for the description |
|---|---|---|---|
| eBay | `Carhartt Detroit Jacket Men's L Brown J97 Vintage Large Blanket Lined Chore Coat` | 100% | none |
| Poshmark | `Carhartt Detroit Jacket Brown Size L` | 47% | J97, vintage, large, blanket lined, chore coat |
| Mercari | `Carhartt Detroit Jacket Size L Brown` | 47% | the same five |
| Depop (line 1) | `Vintage Carhartt Detroit Jacket Brown Size L` | 47% | J97, large, blanket lined, chore coat |

The searches and weights in that run are made up for the test. Real ones come from each site's suggestions and comps.

## Confidence, and what would overturn it

- Fit of the method (threshold, then click): fairly confident. An independent reviewer given only the evidence, not this conclusion, reached the same structure and the same three changes.
- Size of the gain: unknown. Nothing here shows our listings will sell faster.
- The reviewer's main objection: the evidence says nothing on price, and price against comparables probably outweighs every text choice. Agreed; that is why step 3 hands off to the price spec.
- Weakest input: the search weights. Suggestions are not counts.

**Next test.** On eBay only, where we can see impressions: alternate our own listings between the lean title and the title filled to 80 characters, same item kinds, and compare search impressions per day and click-through from the traffic report. If the filled titles get about a quarter more search impressions with no worse click-through, go back to filling. This fits the experiment design already in [score.md](../../../spec/features/score.md).

**Revisit when** a site publishes query counts, eBay changes what its search reads, or the test above reports.

## Limits

- Pages were read through a summarizer, and the two position-bias papers and the Airbnb paper were partly cut off; the numbers quoted are the ones seen in the text.
- The FlowLister sample is volume resellers of used apparel on eBay. It may not hold for electronics or for other sites.
- Not researched: how much of each site's buying starts from search against feeds and browse. The site-by-site weights in the decision table are *inferred*.

## References

| Source | Job | What we take |
|---|---|---|
| [FlowLister eBay listing data study, 2026](https://flowlister.com/ebay-listing-data-study/) | vendor's observational study | title length, specifics, photos against sell-through |
| [Improving Deep Learning for Airbnb Search](https://arxiv.org/abs/2002.05515) | engineering paper | cold start for new listings |
| [How Etsy Search Works, 2025-08-26](https://www.etsy.com/seller-handbook/article/375461474487) | site statement | two phases; the new-listing lift and why |
| [Position Bias Estimation for Unbiased Learning-to-Rank in eCommerce Search](https://arxiv.org/abs/1812.09338) | eBay paper | position bias, mobile drop near rank 25 |
| [Measurement and applications of position bias in a marketplace search engine](https://arxiv.org/abs/2206.11720) | Thumbtack paper | steep fall from position 1 |
| [Document Expansion by Query Prediction](https://ar5iv.labs.arxiv.org/html/1904.08375) | retrieval paper | adding predicted queries to a document |
| [Vocabulary mismatch](https://en.wikipedia.org/wiki/Vocabulary_mismatch) | secondary | Furnas 1987 |
| [eBay traffic report](https://www.developer.ebay.com/api-docs/sell/static/performance/traffic-report.html), [eBay saved searches](https://www.ebay.com/help/buying/search-tips/saved-searches?id=4051) | site docs | the instrument; alerts on new listings |
| [What researchers found in 15 million words of eBay listings](https://qz.com/678103/what-researchers-found-after-analyzing-15-million-words-in-ebay-listings) | news report | word and price averages, not used |
