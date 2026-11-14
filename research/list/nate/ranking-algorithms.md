# As of November 2026, how do eBay, Facebook Marketplace, Depop, Poshmark, Mercari, OfferUp, Grailed, Vinted and Etsy decide which listings appear at the top of search and feeds, according to what each company, its engineers, its patents and independent measurement have disclosed?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: list.

## How to read this note

- Marks: *observed* = I opened the source and it says so (URL, source date). *observed (highlight)* = I saw the text only in a search-result highlight, page not fully opened, so it is a sample. *asserted* = source claims without showing. *inferred* = my reasoning. "unopened" = link seen, not opened.
- Type: RF = retrieval filter, RK = ranking feature, BR = business rule, PP = paid placement.
- Ben's notes are cited as `ebay.md:200-216` etc. Line ranges are the section ranges I read; they are approximate to the section, not the line. Files: [eBay](../ben/platforms/ebay.md), [Facebook Marketplace](../ben/platforms/facebook-marketplace.md), [Depop](../ben/platforms/depop.md), [Poshmark](../ben/platforms/poshmark.md), [Mercari](../ben/platforms/mercari.md), [OfferUp](../ben/platforms/offerup.md), [Grailed](../ben/platforms/grailed.md). [Analytics note](../../data/nate/analytics-and-recommendations.md) and [crosslister teardown](../../cross-cutting/nate/crosslister-teardown.md) only mention relist and share in passing (teardown matrix near line 85); nothing there to repeat. Ben has no Vinted or Etsy note, so those two are built from scratch here.
- Dates: Exa "Published" stamps of 2026-11-14 on Etsy seller-handbook pages are crawl dates, so those pages are effectively undated. Help pages for eBay, Mercari, Vinted are undated. Everything here can change monthly.

## Cross-site findings (observed)

1. Only Meta, Vinted and eBay publish a staged structure or ordered factor list. Meta: about 1,000 candidates, then signals, predictions, score; boosted listings and ads sit outside the AI (card updated 2026-09-30).
2. The seller-visible "recency boost" is real but small and temporary where measured: Etsy says so itself (small, temporary, renewals smaller, "not an effective search optimization strategy"). Mercari says it favours genuine updates over delete-and-relist.
3. eBay patents describe a ranking score = relevance + listing quality (predicted at listing time, shifting to observed conversion over time) + business rules. This is the only place a "new listing is scored from its attributes before it has data" mechanism is written down.
4. Independent controlled evidence is thin: no controlled experiment on sharing, photo count, item-specifics completeness or response time was found for any site. The experiments found are n=1 seller, or vendor A/B on cover images.

## eBay

### Official description (observed)
Best Match help page, https://www.ebay.com/help/Selling/-/Optimizing_your_listings_for_Best_Match?id=4166 (Exa fetch 2026-11-14, page undated). Lists seven factors, says "There's no secret to improving your position in the Best Match sort order", and advises: 80-character title, up to 24 free photos, item specifics, correct category, no text or borders on photos, no stock photo as main picture for non-new items; fixed-price listings run past 10 days; cancellations hurt track record. Ben's seven-factor list is at `ebay.md:200-216`; this confirms it. Ben marks Cassini, new-listing boost and free-shipping rank as asserted folklore (`ebay.md:200-216`); I found nothing official to upgrade them (see below).

### Signal table
| Signal | Direction | Who says | Mark | Type | URL |
|---|---|---|---|---|---|
| Title/keyword relevance to query | up | eBay help; eBay paper (title relevance score is a feature in the learned ranker) | observed (help); observed (abstract highlight, paper) | RF + RK | help URL above; https://dl.acm.org/doi/10.1145/3269206.3272033 (2018-10-17) |
| Item specifics completeness | up | eBay help | observed | RK (and RF when buyers filter by aspect) | help URL above |
| Listing quality score, predicted at listing time then observed conversion (sales per impression) | up with conversion | eBay patents US9672554 (granted 2017-06-06), US9412127 | observed (highlight) | RK | https://www.freepatentsonline.com/9672554.html ; https://patents.google.com/patent/US9412127 |
| Predicted score compares price and shipping cost with similar listings | lower than comparables up | patent claim 5 of US9672554 | observed (highlight) | RK | same |
| Business-rules score, promotion or demotion | either | patent US9672554 | observed (highlight) | BR | same |
| Seller conversion factor (sales per impression across multi-quantity listings) | demotes when over a threshold | patent application 20130179218 (filed 2013-03-04); granting and use today unknown | observed (highlight) | BR | https://www.freepatentsonline.com/y2013/0179218.html |
| Demand metric with half-life decay on bids/impressions, half-life configurable per category | recent demand up | patent US8370336 (2013-02-05) | observed (highlight) | RK | https://exa.ai/library/legal/patent/m1wh8k9p4k1 |
| Dwell time on view-item page | longer up | patent US10289736B2 (filed 2010) | observed (highlight) | RK | https://patents.google.com/patent/US10289736B2/en |
| Image quality score | higher up | patent US8977629 "Image-based popularity prediction" (2015-03-10) | observed (highlight) | RK | https://www.freepatentsonline.com/8977629.html |
| Seller standards (Below Standard) | down | eBay; Ben says Below Standard pays 6% more fees | observed (Ben) | BR | `ebay.md:200-216`; policy page https://www.ebay.com/help/policies/selling-policies/seller-standards-policy?id=4347 unopened |
| Promoted Listings (ad rate, CPC for Priority) | up for payer | eBay innovation blog 2020-07-16: unified ranker for promoted and organic, promoted ranked by relevance, past performance and ad rate | observed (highlight) | PP | https://innovation.ebayinc.com/stories/ebay-makes-promoted-listings-in-search-results-more-relevant-and-dynamic/ |
| Image information for queries | up for matches | eBay paper 2019-04-29, +11.89% AUROC, +3.1% AUPRC | observed (abstract highlight) | RK | https://doi.org/10.1145/3372124.3372126 |
| In-session co-click, title and price similarity (personalisation) | personalised | eBay paper | observed (highlight) | RK | https://arxiv.org/pdf/1905.00052v1.pdf |
| Sequential re-ranker over top results | n/a | eBay paper, about 10% reduction in purchase-impression gap for top 20 | observed (highlight) | RK | https://ar5iv.labs.arxiv.org/html/2010.14570 |
| Visual search aspect matching, larger reward for size, brand, price | n/a | eBay paper 2017-06-10 | observed (highlight) | RK (visual search, not Best Match) | https://arxiv.org/abs/1706.03154 |
| Cassini as the engine name; new-listing boost; free shipping up | up | secondary blogs (listing-forge 2026-01-31, zikanalytics 2026-06-18, quicksync 2026-11-03, ecomli 2026-06-22) | asserted, unopened | unknown | not found at an eBay source |

### Engineering, patents
Papers above are the engineering disclosure (all abstracts or highlights only). Patents describe the shape (relevance + quality + business rules), not current weights; patent dates are 2010 to 2017, so current use is *inferred*. eBay A/B post (2018-05-07) says tests randomise by leaf category: https://innovation.ebayinc.com/stories/the-design-of-a-b-tests-in-an-online-marketplace/ (observed highlight).

### Independent experiments
- One seller ended a GTC listing and relisted as a 30-day listing, with other changes at the same time: n=1 pair, uncontrolled, confounded. https://www.futuretomorrow.net/2018/11/14/variant-testing-with-ebays-gtc-and-30-day-listings/ (2018-11-14) observed (highlight).
- webinterpret (2023-12-08): promoted listings raise impressions 4 to 5 times, sales up 35% in Germany and 54% in the USA; no sample size shown, vendor, unopened.

### Company states vs sellers believe
Company states: seven factors, no secret, promoted ranked by relevance plus ad rate. Sellers believe: Cassini boosts, relisting refreshes, free shipping ranks higher (`ebay.md:200-216` asserted). No source in this note controls any of them.

## Facebook Marketplace

### Official description (observed)
Meta system card https://transparency.meta.com/features/explaining-ranking/fb-marketplace/ (marked "Updated Sep 30, 2026"; Exa fetch 2026-11-14): about 1,000 candidates gathered by recency and relevance; signals include location, category, condition, price; integrity processes and hidden-listing suppression; boosted listings and ads are not part of the AI ranking; predictions include seller-profile click, start conversation, photo swipe, repeat communication, click (product CTR upper confidence bound, PDP scroll count, price, keyword match) and save (distance, price). The prediction lists were seen in highlights.
**Contradicts Ben:** `facebook-marketplace.md:211` says the system card did not load; it does now and has content. Ben's likes-personalise (Meta 2025-11-13), funnel metrics (2026-07-24) and Cost per Sale boost (2026-10-12) at `facebook-marketplace.md:207-228` are not checked here.

### Signal table
| Signal | Direction | Who says | Mark | Type | URL |
|---|---|---|---|---|---|
| Recency and relevance for candidate set | up | Meta card | observed | RF | card URL |
| Location, distance | closer up | Meta card | observed | RF + RK | card URL |
| Category, condition, price | match up | Meta card; Que2Engage uses price, condition, seller rating, creation time as context | observed; observed (ar5iv, Feb 2023) | RK | https://ar5iv.labs.arxiv.org/html/2302.11052v1 |
| Predicted click, save, message, photo swipe | up | Meta card | observed | RK | card URL |
| Real-time event counters in ranking stage | recent engagement up | Meta AI blog (undated) | observed (highlight) | RK | https://ai.meta.com/blog/under-the-hood-facebook-marketplace-powered-by-artificial-intelligence/ |
| Multimodal embedding of title, description, image (ResNet-50, DeepText) | similarity up | Meta AI blog | observed (highlight) | RK | same |
| Integrity suppression | down | Meta card | observed | RF/BR | card URL |
| Boost | up | Meta card says outside AI | observed | PP | card URL |
| Renew, relist, "bump" folklore | up | Vendoo and sellers (`facebook-marketplace.md:207-228`) | asserted | unknown | not found at Meta |

### Engineering, patents, experiments
Blog: category autosuggest into 29 top categories, 7 to 9% seller abandonment before it (observed highlight). Patents: not searched for Meta specifically (see Not found). Independent controlled experiments: not found.

## Depop

Ben: seven published factors, Top Seller no effect, boost 12% from 2026-03-23, 25% lift has no method, 18% relist lift not found (`depop.md:195-211`). I did not re-open Depop's help page; I confirm only what third-party text restates.

| Signal | Direction | Who says | Mark | Type | URL |
|---|---|---|---|---|---|
| Search match, views and likes, location, shopper habits, listing age, seller's sales, boost status | up | Depop (via Ben) | observed by Ben | RK | `depop.md:195-211` |
| Filtered search shows only listings whose details match | filter | Depop (as quoted by arclist.ai, 2026-11-06) | observed (highlight, secondary) | RF | https://arclist.ai/blog/how-marketplace-algorithms-work |
| Policy breakers rank lower | down | Depop (same) | observed (highlight, secondary) | BR | same |
| Boost at 12% US and UK | up | same | observed (highlight, secondary) | PP | same |
| Cover image style (clean-contrast covers) | up | sizeai.co vendor, "seem to" | inferred by the vendor | RK | https://sizeai.co/blog/ghost-mannequin-vs-model-shots (2026-04-11) |

Engineering: Depop search and ranking team talk "Ranking search results and recommendations at Depop" (Data Science Festival, undated; abstract about experiment infrastructure only, no signals): https://datasciencefestival.com/session/optimising-search-and-discovery-at-depop/ (observed highlight). Patents: not found. Experiment: sizeai.co vendor A/B, "several thousand" listings (Depop 1,247, Poshmark 988, Shopify 1,896), cover image only, rotated for listing age; controlled for age but the author sells the product; the effect on Depop search is the vendor's inference.

## Poshmark

Ben: factors from the 2025-10-13 blog; sharing and share-jail folklore (`poshmark.md:197-211`).

| Signal | Direction | Who says | Mark | Type | URL |
|---|---|---|---|---|---|
| Relevance; active, responsive closets more likely higher | up | Poshmark (via Ben; arclist.ai restates) | observed (Ben); highlight secondary | RK | `poshmark.md:197-211` |
| Keyword and image matching, spell correction, down-weighting broad or misused keywords in descriptions | down for keyword stuffing | Poshmark blog 2024-11-26 | observed (highlight) | RF + RK | https://blog.poshmark.com/2024/11/26/enhancing-search-discovery/ |
| Buyer size filter applied automatically | filter | arclist.ai (2026-11-06) | observed (highlight, secondary) | RF | arclist URL above |
| Promoted Closet, per click, waitlist | up | arclist.ai | observed (highlight, secondary) | PP | same |
| Sharing | up | sellers | asserted (folklore) | unknown | `poshmark.md:197-211`; no Poshmark source found |

Engineering and patents: no Poshmark engineering post or patent found. Experiments: none controlled; only the sizeai cover-image A/B (988 Poshmark listings).

## Mercari

Ben: six signals from help 2514, undated (`mercari.md:206-217`). Confirmed here by a fresh fetch.

| Signal | Direction | Who says | Mark | Type | URL |
|---|---|---|---|---|---|
| Lifetime and recent (e.g. 90 days) sales | up | Mercari help 2514 | observed (Exa fetch, undated, truncated at "New Sellers") | RK | https://www.mercari.com/help_center/article/2514/ |
| Transaction success: completion, cancellations, returns | up | same | observed | RK/BR | same |
| Verifications, profile completeness | up | same | observed | RK | same |
| Genuine updates favoured over frequent delete and relist | up for update, down for relist | same | observed | RK/BR | same |
| Keywords | match up | same | observed | RF + RK | same |
| Active engagement (messages, shipping) | up | same | observed | RK | same |
| Item CTR and impression probability, refreshed daily from Redis feature store; recency; title embeddings | up | Mercari engineering 2023-01-01 | observed (highlight) | RK | https://engineering.mercari.com/en/blog/entry/20230101-the-journey-to-machine-learned-re-ranking/ |
| Recency-boosted BM25 in Elasticsearch | newer up | Mercari engineering 2023-06-26 | observed (highlight) | RK | https://engineering.mercari.com/en/blog/entry/20230626-mercaris-journey-integrating-ai-search-at-berlin-buzzwords-2023/ |
| Smart Pricing: floor price, automatic drops, listing promoted at each price update | price drop up | Mercari engineering 2020-12-23 | observed (highlight) | BR | https://engineering.mercari.com/en/blog/entry/pricing-guidance-system/ |

Engineering detail (observed highlight): learning-to-rank MLP, nDCG listwise loss, serves 100% of "best-match" traffic, labels graded by engagement journey with purchase as the final event. Quality monitoring (2025-12-09): LLM scoring on ESCI labels, about 1,000 keywords weekly, top 120 items: https://engineering.mercari.com/en/blog/entry/20251208-search-results-quality-monitoring-with-llms/. A CEUR paper (https://ceur-ws.org/Vol-4250/paper775.pdf, undated; company not shown, attribution unknown) says a pointwise tap objective may be negatively correlated with purchase intent. Patents: not found. Experiments: none.

## OfferUp

Ben: caps, duplicates removed, responsiveness enforcement, no formula (`offerup.md:194-208`).

| Signal | Direction | Who says | Mark | Type | URL |
|---|---|---|---|---|---|
| Keyword (BM25 in Elasticsearch 7.10) then multimodal search | match up | AWS blog 2025-02-05 | observed (highlight) | RF + RK | https://aws.amazon.com/blogs/machine-learning/offerup-improved-local-results-by-54-and-relevance-recall-by-27-with-multimodal-search-on-amazon-bedrock-and-amazon-opensearch-service/ |
| Local result share (fanout searches fell 54.2%) | closer up | same | observed (highlight) | RF | same |
| Duplicate listings removed; posting caps; personalisation | n/a | OfferUp (via Ben) | observed by Ben | BR | `offerup.md:194-208` |

The AWS post reports an A/B (control keyword, variant multimodal): relevance recall +27%, engagement +2.2%, EWSR +3.8%, search depth +6.5%, ad impressions +0.91%. Sample size not seen in the highlight. It is a vendor-partner post. Patents and seller-side signal experiments: not found.

## Grailed

Ben: bump and 10% drop at top of feed; each earlier sale cuts average time to sale by over 3 hours; peak times (`grailed.md:237-250`).

| Signal | Direction | Who says | Mark | Type | URL |
|---|---|---|---|---|---|
| Bump: every 7 days for first 30 days free; after that needs a 10% or larger price cut | up at top of feed | Grailed (via Ben; arclist.ai 2026-11-06 restates) | observed (Ben); highlight secondary | BR | `grailed.md:237-250` |
| Approval review delays visibility | n/a | Grailed (via arclist.ai) | observed (highlight, secondary) | BR | https://arclist.ai/blog/how-marketplace-algorithms-work |
| Seller sale history | faster sale | Grailed (via Ben) | observed by Ben | not a rank claim | `grailed.md:237-250` |
| Search ranking inputs | n/a | Grailed states none | observed (secondary, arclist) | n/a | same |

Engineering, patents, experiments: not found.

## Vinted

No Ben note. Sources are search highlights of Vinted help pages; I did not open the full pages.

| Signal | Direction | Who says | Mark | Type | URL |
|---|---|---|---|---|---|
| Fifteen parameters: time since upload, interactions, country, language, price, ontology (category, brand, size, colour, photos), condition, listing frequency, seller type, query and filters, description, illegal content, image resemblance, user history, following list | mixed | Vinted help 409 | observed (highlight, undated) | RF + RK | https://www.vinted.com/help/409-recommended-content-on-vinted |
| Key factors in order: filters, promoted content (new listings and paid promotion, frequency limits), attractiveness (recency, interactions, price, condition), personalisation | n/a | same | observed (highlight) | RF, BR, RK | same |
| Bump: 3 or 7 days or until sold; price can be lowered but not raised while bumped | up | Vinted help 340 | observed (highlight) | PP | https://www.vinted.com/help/340-what-is-item-bump |
| Home feed uses recommenders and re-rankers | n/a | help 409 | observed (highlight) | RK | same |
| Vespa three-stage recommender, two-tower retrieval, ranking depth up to 200,000 candidates | n/a | Vinted engineering 2023-10-09; vespa.ai 2024-12-02 | observed (highlight) | RK | https://vinted.engineering/2023/10/09/adopting-vespa-for-recommendation-retrieval/ ; https://vespa.ai/vinted/ |
| Autocomplete uses 7-day item search-to-purchase rate as a suggestion metric | n/a | Vinted engineering 2026-04-22 | observed (highlight) | RK (autocomplete) | https://vinted.engineering/2026/04/22/personalized-search-autocomplete/ |
| Relisting folklore | up | swiftlisted.ai 2026-08-13 | asserted, unopened | unknown | not found at Vinted |

Help 1252 (https://www.vinted.com/help/1252) is unopened. Patents and experiments: not found.

## Etsy

No Ben note.

| Signal | Direction | Who says | Mark | Type | URL |
|---|---|---|---|---|---|
| Tags, title, attributes, description, first photo, reviews: match | match up | Etsy seller handbook "How Etsy Search Works" | observed (highlight; crawl stamp 2026-11-14) | RF + RK | https://www.etsy.com/seller-handbook/article/375461474487 |
| Listing quality: multiple photos, return policy | up | same | observed (highlight) | RK | same |
| Listing conversion rate (views to purchases) | up | same | observed (highlight) | RK | same |
| New listing small temporary boost (hours to days); renewal smaller; "not an effective search optimization strategy" | up, small | same; policy page | observed (highlight) | RK/BR | same; https://www.etsy.com/legal/policy/search-advertisement-recommendation/899478564529 |
| US shipping under $6 prioritised from 2024-10-01 | lower up | Etsy seller handbook | observed (highlight) | RK | https://www.etsy.com/seller-handbook/article/1289139008351 |
| Review rating, 48-hour message response, case rate, 3-month window | up | Etsy seller handbook | observed (highlight) | RK/BR | https://www.etsy.com/seller-handbook/article/375461267511 |
| Context Specific Ranking (shopper personalisation) | personalised | Etsy handbook | observed (highlight) | RK | same as first row |
| Semantic relevance model filters retrieved listings, feeds ranking features, weights loss, boosts highly relevant; fully relevant share 58% to 62% Aug to Oct 2025 | up for relevant | Etsy Code as Craft 2026-01-16 | observed (highlight) | RF + RK | https://www.etsy.com/codeascraft/how-etsy-uses-llms-to-improve-search-relevance |
| Two passes: top 1,000 candidates by tags, titles, attributes; gradient boosted decision tree, pairwise; price and recency features; personalisation features | n/a | Etsy Code as Craft 2020-10-29 | observed (highlight) | RF + RK | https://www.etsy.com/codeascraft/bringing-personalized-search-to-etsy |
| Ads ranked in own process, auto-bidding decides shown and CPC | up for payer | Etsy Code as Craft 2026-03-20 | observed (highlight) | PP | https://www.etsy.com/codeascraft/making-ads-count-using-mmoe-and-auxiliary-tasks-to-better-connect-buyers--sellers |
| Visual features in learning to rank | n/a | Etsy paper 2015-11-20 | observed (abstract highlight) | RK | https://doi.org/10.48550/arxiv.1511.06746 |

Older Etsy search text (tag and title match as filter, quality score from clicks, favourites, purchases) is in a court exhibit: https://www.supremecourt.gov/opinions/URLs_Cited/OT2023/22-277/22-277-16.pdf (observed highlight, old). Patents: not searched for Etsy specifically. Experiment: a 2009 shop (pandacub) did 30 renewals in about 38 hours: +526 views, +15 hearts, 1 sale; n=1, uncontrolled, a forum announcement confounds it, 17 years old: http://pandacubcafe.blogspot.com/2009/07/pandacub-experiment-results-and-next.html (observed highlight).

## Closing lists (all *inferred*, ordered by strength of evidence, strongest first)

Strength here means how directly a company, paper or patent states it, not that an effect size is known.

- **eBay** (*inferred*): (1) title keywords via title field; (2) item specifics via aspects fields; (3) photos (count, clean main image) via photo field; (4) category choice; (5) price and shipping cost relative to comparables via price and shipping fields (patent claim); (6) handling time, returns, cancellations via seller-account and fulfilment actions (help page); (7) Promoted Listings ad rate (PP). Folklore: Cassini, relisting refresh, free-shipping rank, "30-day vs GTC".
- **Facebook Marketplace** (*inferred*): (1) category, condition, price, location fields; (2) title and description keyword match; (3) photos (swipe and click prediction); (4) message responsiveness (repeat communication prediction); (5) boost (PP). Folklore: renew and relist, group sharing.
- **Depop** (*inferred*): (1) complete listing details and accurate description (filtered-search match); (2) price; (3) policy compliance; (4) boost (PP). Folklore: relist 18% lift, 25% boost lift without method, refreshing.
- **Poshmark** (*inferred*): (1) size and brand fields so the auto size filter matches; (2) honest keywords, no keyword stuffing; (3) activity and responsiveness via messages and offers; (4) promoted closet (PP). Folklore: share counts, share jail, closet shares.
- **Mercari** (*inferred*): (1) genuine edits not delete-and-relist; (2) keywords in title; (3) profile completeness and verification; (4) completion, cancellations, returns; (5) messages and shipping speed; (6) price drops (Smart Pricing, floor price). Folklore: relist-for-top.
- **OfferUp** (*inferred*): (1) title keywords and photos (search is keyword plus multimodal); (2) location; (3) responsiveness; (4) avoid duplicates and exceeding caps. Folklore: reposting for top.
- **Grailed** (*inferred*): (1) bump timing (every 7 days for first 30) via bump action; (2) price drop of 10% or more after day 30; (3) listing approval completion; (4) seller history, which accrues from sales. Folklore: posting at peak times.
- **Vinted** (*inferred*): (1) filter fields (category, brand, size, colour, condition) set correctly so filtered search includes the item; (2) price; (3) photos; (4) description; (5) bump (PP); (6) listing frequency (named parameter; direction not stated). Folklore: relisting to reset age.
- **Etsy** (*inferred*): (1) all 13 tags, title, attributes, category; (2) multiple photos and a return policy; (3) US shipping under $6; (4) conversion rate via price and photo; (5) 48-hour message response and low case rate; (6) new listing (small boost); (7) Etsy Ads (PP). Folklore: frequent renewal (Etsy says ineffective).

## Not found

- Facebook Marketplace, Depop, Poshmark, Grailed, OfferUp, Vinted, Mercari: no patents located by my search; Etsy and Meta patents not specifically searched.
- Poshmark, Grailed, Depop ranking engineering posts with signals: none found (Depop has a talk abstract only).
- Controlled experiments on sharing, photo count, item-specific completeness, response time, sell-through or free shipping for any site: none found.
- Official eBay statement on Cassini, new-listing boost, free shipping rank: not found.
- Etsy and Vinted pages beyond highlights; Vinted help 1252 and the eBay seller standards policy: unopened.
- Mercari help 2514 "New Sellers" section: fetch truncated.

## Sources fetched

Opened by Exa fetch or search-result full text: eBay Best Match help page; Meta system card; Mercari help 2514 (truncated). All other URLs above were seen as search highlights only and are marked "highlight"; secondary sources (arclist.ai, sizeai.co, reva.run, vinteer.io, swiftlisted.ai, listing-forge, zikanalytics, quicksync, ecomli, underpriced.app, webinterpret) are unopened or highlight-only. Reva (2026-09-13) and vinteer (2026-09-28) were not used for claims.

### Searched / could not reach
Searched with Exa: eBay, Meta, Mercari, Vinted, Etsy ranking; marketplace patents; Poshmark, Depop, OfferUp, Grailed engineering; independent experiments. help.etsy.com URL returned 404, replaced by seller-handbook URLs. Patent claims were seen in highlights of freepatentsonline and Google Patents, not full documents; whether each is in use is unknown. OpenAlex not queried, so literature coverage is a search-engine sample. Searched but empty: Poshmark and Grailed engineering blogs, controlled seller experiments.
