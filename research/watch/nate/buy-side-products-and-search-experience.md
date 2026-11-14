# As of November 2026, which products let a person search used marketplaces in one place, find a cheaper or similar alternative, track used-goods prices, or shop through a view generated for the query, and what would an intuitive unified search and shopping experience take from them?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: watch.

Evidence marks. *observed* = I opened the page or got its text in a search result that carried the page text, and the source says so (URL and date given; "highlight" means only the search result excerpt, the full page was not opened). *asserted* = a source claims without showing, or an aggregator figure. *inferred* = my reasoning. "Unopened" = link not opened. Many pages below were seen only as search highlights; that is stated each time and the exact values should be re-opened before being quoted in a spec.

Existing notes referred to: [one-search-box.md](../ben/one-search-box.md), [buyer-side-actions-and-affiliate.md](./buyer-side-actions-and-affiliate.md), [existing-tools.md](../../appraise/ben/existing-tools.md), [direct-references.md](../../cross-cutting/ben/direct-references.md), [buy.md](../../../spec/features/buy.md).

## 1. Search engines and aggregators across used marketplaces

| Product | Sites covered | How it gets listings | Dedupe, ranking, stale | Business model | Traction and complaints |
|---|---|---|---|---|---|
| Phia | Claims 350M items, 5,000 brand partners (existing-tools.md lines 25-36, *asserted* there) | Not disclosed in what I read | Shows "high, typical or fair" price label (one-search-box.md line 26) | Affiliate; extension drops cookies only on user intent (see section 6) | Series A $35M announced 2026-01-27 (*observed*, GlobeNewswire and TechCrunch URLs in Sources); 640k+ downloads (existing-tools.md) |
| Encore (YC fall 2024) | Poshmark, The RealReal, Grailed, Etsy, eBay (TechCrunch); also Depop, Mercari, AptDeco, Chairish, Kaiyo, Vestiaire (gearandgrit); Reebelo seen in a test (Dataconomy) | "Hundreds of resale sites" aggregated, method not stated | LLM refines natural-language queries; site toggles ("untick" a site); follow-up prompts adjust results; suggestion chips like "only under $800" | Affiliate shares; $3 per month subscription tried (unlimited searches, image upload) | 50,000+ searches per month, 26% month-on-month search growth, 15% click growth, as of 2024-11-10 (*observed*, TechCrunch 2024-11-10). No 2026 figures found. |
| ThriftX | Depop, Poshmark, Vinted, eBay, Mercari, ThredUp | Live fan-out by text or photo (*observed*, ThriftX guide 2026-09-04; the vendor's own marketing page) | AI check of listing photos against the query; cross-post dedupe showing one card "at the cheapest listing" with other prices one tap away; one "watch" across all six, daily on every plan, hourly on ThredUp and eBay on paid plans | Not stated in the excerpt; "free on iPhone, standard search unlimited, no card" | Self-described; no independent traction or complaint source found |
| Gem | Vintage and resale sites, brand stores via /for-stores | See my earlier fetch of gem.app/about and /for-stores | Brand-store programme for retailers | Not re-confirmed this batch | App store pages and Vintage Fashion Guild interview in Sources |
| Beni | Browser extension that surfaces a used copy while browsing a new item | Partner and crawled listings | Extension shows resale alternative at point of view | Affiliate | TechCrunch 2022-12-13, Bloomberg 2022-11-22 (*observed*, old); no 2026 traction found |
| Croissant | Not a used-item search: shows a guaranteed buyback value on 150+ retailer sites, then resells through Poshmark, eBay and others | Scans secondhand sites for listing and sold prices into a data lake (*observed*, Modern Retail 2024-09-05) | Predicts resale value by brand, category, seasonality, materials | Commission from retailers | Retailers see 45% higher spend for opted-in customers (*asserted*, company CEO quote, Modern Retail 2024-09-19) |

Further products named in the brief and not separately researched this pass: SearchTempest-style tools, Lyst, ShopStyle, Google Shopping "used" filter, eBay and Vinted cross-border search, other extensions. See Not found.

Points taken from this group:
- Feed versus fan-out. ThriftX is a live fan-out with a photo check; Dupe.com and Phia-type tools are feed based (see group 2). This confirms the split in one-search-box.md lines 30-42 and adds that a live fan-out product with dedupe and a cross-site watch already ships (*observed*, ThriftX guide 2026-09-04, vendor source, so capability is *asserted* until tested).
- Encore prompt chips ("Outfit inspo for", "Shop from the Show") are there to avoid a blank page (*observed*, TechCrunch 2024-11-10). Extends one-search-box.md line 22 (query understanding) with a zero-input state.
- Encore says it takes no sponsored placement and makes money by affiliate and subscription (*asserted*, gearandgrit 2024-12-04, a review not the company page).
- Encore and the other products above all send the buyer to the marketplace to check out; none that I read takes payment (ThriftX: "the search layer, not the checkout", *observed*, vendor page). Confirms buyer-side-actions-and-affiliate.md lines 38-46 (agent buying is barred by marketplace terms) as the likely reason (*inferred*).

## 2. Similar-item and cheaper-alternative finders

- Dupe.com (Carrot Cart Inc.). Input: product link, photo, text, or a `dupe.com/` prefix on any product URL. It "works out what makes the product appealing" (for a sofa shape, proportions and materials), finds products across stores and "shows how close each one is" (*observed*, https://dupe.com/faq, undated). Strongest in furniture and home decor, then fashion, shoes, bags, beauty. Revenue: affiliate commission. Signed-out use covers search, results and click-through; an account is only for saving items, search history and a feed (*observed*, same page). It does not index used items on that page (*inferred*: it describes "retailers" and "retailer feeds").
- Its own caveats: prices come from retailer feeds and move between refreshes; "do not describe a dupe as identical"; materials, dimensions and build quality vary; it does not assess quality (*observed*, dupe.com/faq).
- Independent notes on limits: visual similarity "can overlook dimensions, construction quality, materials, comfort, compatibility" (*observed* highlight, https://lensapp.io/dupe-vs-lens-app/, 2026-08-20; a competitor's page). A feed-based tool can only return retailers that publish a feed, and a feed is a snapshot (*observed* highlight, https://www.stealsy.app/blog/do-dupe-finding-websites-work, undated; a competitor's blog).
- Accuracy evidence: an arXiv paper on a taxonomy-decoupled visual search for home goods reports Visual Similarity precision at 6 of 51.1 to 54.5 against Google Lens 31.4, and relevance precision 92.9 to 93.6 against Lens 76.7 (*observed* highlight, https://arxiv.org/html/2601.11769, undated; one author, one dataset, so one data point). On a 15k set the system scored Visual Similarity P@6 47.5% and Success@6 83.0% (same page). So even the best published similarity system has about half of its top six judged visually similar (*inferred* from those figures).
- What "similar" is measured on in these products: shape, colour, pattern, texture, proportion (*observed* highlight, https://www.getmatchymatchy.com/home-decor-dupe-finder, 2026-03-19, vendor). None of the pages I read lets the user choose which attribute to hold fixed or relax. Dupe.com says it "shows how close each match is" but I did not see the scale (*not-found*).
- Brand as the variable. The founder's phrase "distinct variables like just the brand name" has no product I found that exposes brand as a dropdown-style variable on a similar-item view; Dupe.com changes everything at once from the look (*inferred* from the pages above, not a proof of absence).
- Used goods: none of the dupe tools I read mix used listings into the alternatives (*not-found*). Croissant is the nearest, valuing a new item by its used resale (section 1).

Confirms one-search-box.md line 22 that ambiguity needs a question, and extends it: the closest shipping similar-item view makes no claim about material or build (*observed*, dupe.com/faq).

## 3. Price tracking and alerts for used goods

| Kind | Product | What it charts | How it separates a real change from noise |
|---|---|---|---|
| Cards | Card Ladder | 100M+ historical sales, back to 2000, daily value updates, population reports (*observed* highlight, https://www.cardladder.com/) | CL Value procedure per rip.fan (2026-10-11, *observed* highlight, third party): up to 1,000 sales, flagged sellers dropped, last 6 months (3 if more than 10 sales), newest 25, IQR outlier rule, newest sale if under 2 weeks old else scaled by an index; confidence rating 1 to 5 |
| Cards | eBay Price Guide | Median of sold prices, including accepted Best Offer, up to 2 years, refreshed every 24 hours, US only (*observed* highlight, rip.fan 2026-10-11) | Median |
| Cards | TCGplayer, CollX, Collectr | TCGplayer: average of recent sales, outliers ignored. CollX: median of last 10 sales over 6 months. Collectr: refreshed every 1-2 days, 5+ years of history on Pro (same rip.fan page) | Median or trimmed average |
| Watches | WatchCharts | 28,000+ watches, 100+ brands; daily price from a weighted 30-day window of transactions; last asking price used when the sold price is unknown; only new versus used is accounted for; admits lag in volatile markets (*observed* highlight, https://watchcharts.com/watches/about) | Weighted window; free tier 1 year of history, top tier 15+ years; real-time marketplace alerts and a risk score on a mid tier; days on market and sales volume on the top tier (*observed* highlight, https://watchcharts.com/subscribe). Prices: $39, $119, $199 per month (milleso.com 2026-08-19, third party) |
| Watches | ChronoPulse, EveryWatch, Chrono24 | Transaction sources versus asking-price sources are separated; market day's supply = active comparable listings / (sales in 90 days / 90) (*observed* highlight, https://milleso.com/articles/how-to-price-a-pre-owned-watch, 2026-08-19, third party) | Asking versus sold distinction; supply ratio |
| Sneakers | StockX | Price history by size and colourway, highs, lows, volatility, from a bid and ask model (*observed* highlight, Business Insider 2019-07-30, Contrary 2024-06-15; old) | Bid/ask spread and last sale |
| Any new item | Google Shopping, Chrome | 90-day history, typical range; Universal Cart tracks price drops, price history and back-in-stock in the background (*observed*, https://blog.google/products-and-platforms/products/shopping/google-shopping-cart/, 2026-05-19); price tracking set per size, colour and budget (*observed*, Google blog 2025-11-13) | Alert only at or below typical (Chrome Shopping Insights, from my earlier fetch) |
| Used on a marketplace | Poshmark | Price-drop policy counts a drop 10% below the historical low as real (earlier fetch) | Threshold below historical low |

Not found: Swappa, Keepa and CamelCamelCamel behaviour for used electronics; clothing and furniture price-history products (see Not found).

Points:
- Cards and watches use sold prices and flag the weaker asking price. WatchCharts falls back to asking when no sold price exists (*observed* highlight). A design that charts used goods needs a per-point label "sold" or "asking" (*inferred*).
- Noise controls in use: median, IQR outlier removal, minimum sales count, recency window, flagged-seller removal, a confidence score. Card Ladder's 1-5 confidence is the only user-visible uncertainty mark I found (*observed* highlight, rip.fan). Extends one-search-box.md line 26 ("typically $45-60 sold") by adding the sample size and age behind it (*inferred*).
- Watch brand and model numbers are variants of the same identity problem in one-search-box.md lines 20-24.

## 4. Generated shopping interfaces, 2025 to 2026

- Google AI Mode shopping. Responses are "tailored to your specific question and formatted for your needs"; visual queries return shoppable images, and a choice between options returns a comparison table (*observed*, https://blog.google/products-and-platforms/products/shopping/agentic-checkout-holiday-ai-shopping/, 2025-11-13). Query fan-out and a right-hand panel that updates dynamically (*observed* highlight, Google blog 2025-05-20). Shopping Graph: 50B+ listings, 2B refreshed hourly (same 2025-11-13 page). Universal Cart across Search, Gemini, YouTube, Gmail; it flags incompatibilities and suggests alternatives (*observed*, Google blog 2026-05-19). Launched in the US 2026-10-15; the Buy button only shows on listings with a `native_commerce` checkout eligibility attribute (*observed* highlight, https://sourcevision.com/guides/google-ai-mode-shopping/, 2026-11-04, third party). No page I read covers used or secondhand items on Google's surface.
- Checkout protocols. OpenAI and Stripe's Agentic Commerce Protocol (ACP, version 2026-04-17 in my earlier fetch) and Google's Universal Commerce Protocol (UCP, announced 2026-01-11, co-developed with Shopify; *observed* highlight, 9to5google 2026-01-11 and Shopify blog 2026-04-02), plus AP2 mandates. All three assume a merchant of record and a catalogue (*inferred*). Marketplace terms in buyer-side-actions-and-affiliate.md lines 38-46 bar buy-for-me agents on eBay, Grailed and others, so a checkout protocol does not reach those listings (*inferred*). OpenAI's own results fell short: TechCrunch 2026-03-24 headline reports its Amazon-like plans "aren't going so well" (unopened beyond the headline in my earlier search).
- What is generated per query versus fixed: Google generates the answer text, the table or image grid, and the panel; the Shopping Graph, cart and checkout stay fixed (*inferred* from the Google pages). Dupe.com says it "spins up a generative marketplace" per product URL (*observed* highlight, https://dupe.com/blog/finding-dupes-with-dupe-com, undated; marketing wording).
- Evidence and criticism:
  - 100 product scenarios on five AI shopping platforms, 2,500 steps: full success 28.2%, partial 36.5%, failure 35.2%; availability lookup fails 52.7%; ChatGPT 43.4% success, Perplexity 13.6% (*observed* highlight, https://doi.org/10.5281/zenodo.18406981, 2026-01-28; one author, preprint-style repository, not peer reviewed as far as I could see).
  - Eye-tracking experiment, 72 participants: acting on the user's behalf cut completion time but raised unease and lowered trust and perceived control; preview plus rationale reduced those penalties (*observed* highlight, https://www.mdpi.com/2414-4088/10/3/22, 2026-03-01).
  - Hybrid conversational shop prototype for white goods: conversational shopping "reduces efficiency but maintains effectiveness" against a traditional shop (*observed* highlight, ICIS 2026 proceedings, https://aisel.aisnet.org/icis2026/user_engage/user_engage/21/, undated).
  - 345 participants: the interface form (keyword, AI summary, conversational agent) shaped whether users saw the AI as tool, assistant or advisor (*observed* highlight, Hawaii scholarspace, undated).
  - 188 students using ChatGPT: perceived timeliness had the strongest link to decision confidence (beta 0.38) (*observed* highlight, https://www.tandfonline.com/doi/pdf/10.1080/23311975.2026.2667448, 2026); student sample, hypothetical purchase, stated limits.
  - Amazon Rufus, n=30: "notable expectation-performance gaps" on privacy, objectivity and reliability (*observed* highlight, https://opus.hs-offenburg.de/frontdoor/index/index/docId/11856, 2026).
  - All of these samples are small, student or Chinese-consumer, or vendor-produced; none involves used goods (*inferred*).

Confirms one-search-box.md lines 28 (freshness) with the finding that timeliness ties most strongly to confidence. Extends buy.md's agent flow with the trust data on acting on the user's behalf; buy.md line 142 and 144 treat `buy_offer` as ask-every-time, which matches the preview-and-undo result (*inferred*).

## 5. Search experience research for product search

All Baymard items are *observed* highlights from baymard.com, not full pages; the dates are page dates.
- No-results: nearly 50% of sites give no recovery path (2019-02-04). Strategies: related categories, alternative searches with previews of the top 3 to 5 products, auto-applying a single alternate query with a notice. https://baymard.com/research-articles/no-results-page
- Attribute words in the query ("feature" searches) have problems on 39% of sites; a Home Depot example returned 0 results while 45 products matched (2024-09-12). https://baymard.com/research-articles/ecommerce-search-query-types
- Persisting the query: 33% of desktop and 42% of mobile sites clear it; users iterate on average 2.2 times and try 3 to 5 iterations before abandoning; "filtering via query iteration" (2021-02-23). https://baymard.com/research-articles/persist-search-queries
- Filter labels: 62% of sites use unclear labels; remedy is jargon explanation and thumbnails (2024-02-27). https://baymard.com/research-articles/explain-industry-specific-filters
- Autodirect to a matching category fails on 46% of sites, losing category filters (2020-01-21). https://baymard.com/research-articles/autodirect-searches-matching-category-scopes
- Benchmark base: 19 sites, 8 verticals, more than 700 search issues, 31 guidelines. https://baymard.com/research/ecommerce-search
- Image or link as a query: Dupe.com accepts a link, photo or the `dupe.com/` URL prefix (section 2), Encore and ThriftX accept photos (section 1). I found no published usability study of image-or-link queries (*not-found*). NN/g was not searched (see Not found).
- Query-in-any-form examples in the wild: Encore accepts "I am a 6'2" person who skies and looking for skier pants under $100 with no big logos" and "Show me jeans" (*observed*, TechCrunch 2024-11-10). Query length varies widely.

Extends one-search-box.md line 22 (ask one tap question on ambiguity) with the measured behaviour that people iterate their query 2.2 times and that attribute words are the commonest failure; these are not about used goods (*inferred*).

## 6. Referral and affiliate programmes

This extends [buyer-side-actions-and-affiliate.md](./buyer-side-actions-and-affiliate.md) lines 65-73. Only new or changed items and conflicts are listed; for eBay, Poshmark, Mercari US, Depop, Grailed, OfferUp and Facebook the earlier note stands.

| Marketplace | Programme exists | Rate and cookie | Deep-link and disclosure | Mark |
|---|---|---|---|---|
| eBay | Yes, eBay Partner Network (EPN) | Earlier note: Fashion 4% from a 2020 card (line 66-ish area of that note); 24-hour click window per my earlier fetch | Buy API needs EPN approval (earlier note lines 18-19) | See earlier note; not re-opened |
| Poshmark | Posh Affiliate, credit-based, Ambassadors or 5,000+ followers (*observed*, blog.poshmark.com/posh-affiliate, 2019-05-13) | 1% to 5%, 24 hours from aggregators only (*asserted*) | Aggregator pages affiliategraph.ai/programs/poshmark: unopened for terms | Confirms earlier note line 68 |
| Depop | Conflicting | Aggregators list Skimlinks, Awin and other campaigns (*asserted*, linkmydeals.com) versus "no public programme" sources | No official page | Confirms earlier note line 70 as conflict |
| Mercari | Japan yes, US unclear | Japan: 2% of sale price; links generated from a web toolbar; promotional 5% ran 2023-11-14 to 2024-01-10 (*observed* highlight, https://www.valueaddedresource.net/mercari-ambassador-affiliate-program/, 2023-11-04). A network listing gives offer 6456, 2% CPS, cookie 1 day, 30 days to confirm (*asserted*, https://blog.affiliates.one/zh-TW/blog/post/mercari-affiliate-program, 2025-11-24) | No US official page | Extends earlier note line 69: adds a 1-day cookie claim, which is an aggregator figure |
| Facebook Marketplace | No programme found | | | Confirms earlier note line 73 |
| Vinted | No creator affiliate programme per Make Influence (undated) quoting LinkMyDeals: "the vinted.fr program is unavailable across 120+ pre-integrated affiliate networks/programs" (*observed* highlight, https://www.makeinfluence.com/en/academy/does-vinted-have-an-affiliate-program-for-creators-what-brands-actually-pay-for-instead); Vinted US shows "Closed" on MyLead (*observed* highlight, https://affi.io/m/vinted-us). One forum post (2025-06-28) claims a programme with an undisclosed cookie (*asserted*, weak, https://affiliateworldforums.com/threads/vinted-affiliate-program-review.1792/) | Vinted's own "Invite a Friend" in the UK pays vouchers: GBP 5 (2 x 2.50) once the friend lists 3 items in 7 days, or GBP 10 (5 x 2) once the friend sells in 30 days; voucher needs a GBP 15 purchase and expires after 90 days (*observed* highlight via Make Influence quoting vinted.co.uk/help/392/318-inviting-your-friends-to-vinted; the Vinted page itself was not opened) | | New in this note |
| Etsy | Yes. Etsy's own pages and third-party pages disagree: Rakuten versus Awin as the network, and 7 versus 30 days cookie (earlier fetch). Etsy's own pages are https://www.etsy.com/legal/affiliates/ and https://help.etsy.com/hc/en-us/articles/360000335987; treat the figures that appear on Etsy's own page as authoritative and the aggregator ones as *asserted* | | | Report both; I did not re-open this batch |
| Grailed | Conflicting: Impact 2% versus FlexOffers 8.8% new customers, 0.8% others, 15-day cookie (*asserted*) | | | Confirms earlier note line 71 |
| StockX | Yes, official news page https://stockx.com/news/stockx-affiliate-program/ | Rate from my earlier fetch; aggregators differ (makeinfluence, linktolooks, affiliategraph.ai) so figures are *asserted* unless on the StockX page | | Earlier fetch |
| GOAT | Programme appears in aggregator comparisons only (makeinfluence) | *asserted*; GOAT's own page not found | | Not found officially |
| The RealReal | Yes per avidaffiliate.com listing | *asserted* | | Not opened beyond that listing |

Disclosure requirement (US): the FTC Endorsement Guides, 16 CFR 255.5, require a material connection to be disclosed "clearly and conspicuously"; a review blogger who includes affiliate links and is paid on sales "should clearly and conspicuously disclose the compensation" (*observed*, https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-255/section-255.5, current at fetch). "Clear and conspicuous" in 255.0(f) means "difficult to miss" and, online, "unavoidable"; a disclosure behind a "more" link is not unavoidable (*observed*, https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-255). A ranking whose order is set by payments is deceptive even with a disclosure (255.1 Example 3, same page); a site paid only by affiliate referrals "should clearly and conspicuously disclose that it receives such payments" (same example). The final rule was published 2023-07-26 (*observed* highlight, Federal Register). Non-US rules: not researched.

Marketplace-specific terms for deep links, cookie rewriting and paid-click exclusions were not found on official pages for any marketplace other than eBay (earlier note) and Poshmark (earlier note).

Contradicts nothing in the earlier note; the Vinted row and the Mercari 1-day figure are new.

## 7. Saving and interest lists across sites

- Dupe.com: signed-out use covers search and click-through; account needed to save items, keep a search history and get a feed (*observed*, dupe.com/faq).
- ThriftX: one watch across six marketplaces with push on new matches; no mirroring to the marketplace's own favourites is mentioned (*observed*, ThriftX guide 2026-09-04; absence is *not-found*).
- Google Universal Cart: a cart across merchants with price-drop, history and back-in-stock tracking in the background; tied to a Google account (*observed*, Google blog 2026-05-19).
- Marketplaces keep their own saved searches and favourites: Depop, Vinted and eBay offer saved searches with notifications (*observed*, ThriftX guide 2026-09-04, vendor source). Each watches only its own inventory (same).
- Whether any aggregator mirrors its list into the marketplace's own watchlist: *not-found*. eBay's Trading `AddToWatchList` exists as an API (buyer-side-actions-and-affiliate.md line 9) but no aggregator using it was found.
- Gem and Beni lists: not re-checked this batch.

Extends one-search-box.md line 42 (monitor feature) with the finding that a cross-site watch already ships in at least one product.

## 8. Design: what an intuitive unified search and shopping experience takes from these (*inferred*)

Everything in this section is my reasoning from the above, not a finding. It does not rank features.

1. The query in any form. One box that takes plain words, a pasted link, or a photo (Encore, ThriftX, Dupe.com). Show example prompts when empty (Encore). Keep the query visible and editable after results, since people iterate 2.2 times on average (Baymard). A link or photo is read first for identity (group 5).
2. Identification first. Before listings, show what the system thinks the item is: brand, model, variant, with a way to correct it, then results. This follows one-search-box.md line 22-23 and the weakness in Dupe.com that look-alike matching ignores material and build.
3. A result view composed from a fixed set of parts chosen per query. Parts: identification card, listing grid, price-history panel, similar-and-cheaper panel, comparison table, fit or size panel, deal-score label, save and follow control, link-out control. The query decides which parts appear and in what order (Google generates text, table and panel per question while the underlying graph and cart stay fixed; section 4). A fixed catalogue of parts keeps the view predictable, which is the trust issue in the act-on-behalf study.
4. Similar and cheaper view with variables the person can relax. Show the original, then alternatives as rows with chips for brand, material, size or measurement, condition, era, price ceiling; the person drops one chip and the list recomputes. Each row carries a match label (same item, same model other seller, same family, comparable, looks similar but unverified) and the one thing that differs. No existing product I found exposes the variables as controls (group 2).
5. Price history in the result. Chart sold prices with asking prices marked differently, a sample count and a confidence mark (Card Ladder rating, WatchCharts last-asking fallback, milleso asking versus transaction). Show "typically $45 to 60 sold, 14 sales, 90 days" under the price, as in one-search-box.md line 26 plus the sample size.
6. Save and follow for signed-in users. Save an item, save a query, follow a price or a new-match watch. Keep the list in the app, and where a marketplace API allows it, mirror as that marketplace's own watch (only eBay `AddToWatchList` has a documented route in the earlier note).
7. Referral link-out for everyone. Every result opens the marketplace in a new tab with the referral tag where a programme exists; where none exists (Facebook, Vinted, per group 6) the link is plain. A disclosure sits next to the link, visible without a click, plus a note that ranking is not influenced by payment (FTC 255.1 Example 3).
8. What a visitor sees. The full search, identification, price history, similar view and link-out, with no login (Dupe.com signs out the same way). Save, follow and watch ask for sign-in. This matches the founder's "product and industry research tool" use.
9. Three things no existing product I found does, all *inferred* and *not-found* rather than proven absent:
   - A similar-and-cheaper view over used listings with the brand, material and size chips as live controls. Dupe.com does new retail by look; Encore and ThriftX search used goods but do not present a relaxable alternative set.
   - A single price-history panel that carries the sold versus asking label and a sample-size confidence beside a cross-marketplace listing grid, for clothing, furniture and electronics as well as cards and watches. Card and watch tools chart history but do not search across marketplaces; the search aggregators do not chart.
   - A saved item list that shows, per item, the same item on other marketplaces and drops in the lowest delivered total, with the marketplace's own watch kept in step where an API allows. ThriftX watches queries across six sites; I found no item-level cross-site list with price follow.

## Not found

- Google Shopping "used" or "pre-owned" filter and how it behaves.
- SearchTempest, Lyst, ShopStyle, eBay and Vinted cross-border search, and browser-extension products other than Beni and Phia: not researched this pass.
- Gem, Beni and Phia traction and complaint data for 2026 beyond funding news; Beni and Gem complaints.
- Swappa, Keepa, CamelCamelCamel: behaviour for used electronics.
- Price-history products for used clothing and used furniture.
- Official Vinted help page text; official Mercari US, GOAT, The RealReal and Etsy rate pages opened this batch.
- Official affiliate terms on deep-link rewriting for any marketplace other than eBay.
- NN/g published findings; any usability study of image or link as a query.
- Any aggregator that mirrors its list to the marketplace's own watchlist.
- Non-US disclosure rules.

Searched / could not reach: Exa searches on the topics above. Pages seen only as excerpts are marked "highlight". Many third-party affiliate listings are aggregator pages and carry no authority. Search snippets are a sample; absence from them is not proof of absence in the market. The Etsy, StockX, GOAT, The RealReal figures were taken in an earlier pass and not re-opened for this write-up.

## Sources fetched

Opened with text or highlight in this task (dates are page dates where shown):
- https://techcrunch.com/2024/11/10/encore-is-an-ai-powered-search-engine-for-your-thrifting-needs/ (2024-11-10)
- https://allthingsfashiontech.substack.com/p/founder-story-with-alex-ruber-co (2024-08-27)
- https://gearandgrit.com/encore-ai-thrifting-revolution/ (2024-12-04)
- https://dataconomy.com/2024/11/11/encore-ai-powered-shopping-assistant/ (2024-11-11)
- https://www.modernretail.co/marketing/how-croissant-is-trying-to-bring-more-retailers-into-the-resale-space/ (2024-09-05)
- https://www.modernretail.co/operations/as-demand-rises-new-resale-adjacent-services-pop-up/ (2024-09-19)
- https://www.businesswire.com/news/home/20231108423741/en/ (2023-11-08)
- https://www.thriftx.shop/guides/search-all-thrift-apps (2026-09-04)
- https://dupe.com/faq, https://dupe.com/, https://dupe.com/blog/finding-dupes-with-dupe-com (undated)
- https://lensapp.io/dupe-vs-lens-app/ (2026-08-20)
- https://arxiv.org/html/2601.11769 (undated)
- https://www.stealsy.app/blog/do-dupe-finding-websites-work (undated)
- https://www.getmatchymatchy.com/home-decor-dupe-finder (2026-03-19)
- https://loomlan.com/pages/visual-search (undated)
- https://www.mdpi.com/2414-4088/10/3/22 (2026-03-01)
- https://pmc.ncbi.nlm.nih.gov/articles/PMC13701913/ (2026-10-09)
- https://www.tandfonline.com/doi/pdf/10.1080/23311975.2026.2667448 (2026)
- https://aisel.aisnet.org/icis2026/user_engage/user_engage/21/
- https://doi.org/10.5281/zenodo.18406981 (2026-01-28)
- https://opus.hs-offenburg.de/frontdoor/index/index/docId/11856 (2026)
- https://scholarspace.manoa.hawaii.edu/server/api/core/bitstreams/714ca10b-290e-4e51-bd89-7efe6da10fb9/content
- https://doi.org/10.1002/cb.70238 (2026-08-26)
- https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-255/section-255.5 and .../part-255
- https://www.federalregister.gov/documents/2023/07/26/2023-14795/guides-concerning-the-use-of-endorsements-and-testimonials-in-advertising (2023-07-26)

From the earlier part of this task (full page or highlight; figures marked above):
- https://techcrunch.com/2026/01/27/phoebe-gates-and-sophia-kiannis-phia-raises-35m-to-make-shopping-fun-again/ ; https://www.vogue.com/article/is-phoebe-gatess-phia-the-most-celeb-backed-shopping-startup-of-all-time ; https://fortune.com/2026/08/12/phoebe-gates-phia/ ; https://www.globenewswire.com/news-release/2026/01/27/3226735/0/en/phia-raises-35m-series-a-to-build-the-ai-alignment-layer-for-commerce.html ; https://phia.com/ ; https://www.digitalcommerce360.com/2025/09/18/phia-raises-8-million-to-scale-ai-shopping-platform/ ; https://www.forbes.com/sites/emmasandler/2025/04/24/phia-a-shopping-app-from-two-stanford-grads-launches-amid-resale-boom/
- https://gem.app/about ; https://gem.app/for-stores ; https://vintagefashionguild.org/blog/finding-vintage-in-a-crowded-online-world-a-conversation-with-gem/ ; https://apps.apple.com/us/app/gem-search-vintage/id1459900557 ; https://play.google.com/store/apps/details?hl=en&id=app.gem ; https://sampokarjalainen.com/post/186207229025/gem-search-all-online-vintage
- https://techcrunch.com/2022/12/13/beni-secondhand-shopping/ ; https://www.bloomberg.com/news/articles/2022-11-22/this-company-wants-to-make-it-easier-to-buy-used-clothes-online ; https://startup.google.com/alumni/stories/beni/ ; https://www.fox26houston.com/news/beni-app-helps-shoppers-find-pre-loved-gems-deep-discounts ; https://thecircularpeople.com/2024/01/23/beni/ ; https://www.jenniferyjiang.com/beni-shopping-browser-extension
- https://help.etsy.com/hc/en-us/articles/360000335987-The-Etsy-Affiliates-Program-and-Creator-Collective ; https://www.etsy.com/legal/affiliates/ ; https://www.etsy.com/affiliates ; https://stockx.com/news/stockx-affiliate-program/ ; https://www.makeinfluence.com/en/academy/stockx-and-goat-sneaker-resale-marketplace-affiliate-programs-compared ; https://linktolooks.com/guides/affiliate-programs-for-sneaker-and-streetwear-creators/ ; https://www.affiliategraph.ai/programs/stockx ; https://www.affiliategraph.ai/programs/grailed ; https://www.affiliategraph.ai/programs/poshmark ; https://avidaffiliate.com/programs/therealreal-com/ ; https://www.flexoffers.com/affiliate-programs/grailed-affiliate-program/ ; https://blog.poshmark.com/posh-affiliate/ ; https://afprogs.com/poshmark-affiliate-program/ ; https://linkmydeals.com/affiliate-programs/info/depop.com/
- https://www.makeinfluence.com/en/academy/does-vinted-have-an-affiliate-program-for-creators-what-brands-actually-pay-for-instead ; https://affi.io/m/vinted-us ; https://affiliateworldforums.com/threads/vinted-affiliate-program-review.1792/ ; https://blog.affiliates.one/zh-TW/blog/post/mercari-affiliate-program ; https://www.valueaddedresource.net/mercari-ambassador-affiliate-program/ ; https://www.redrip.app/en/blog/vinted-vs-mercari/
- https://openai.com/index/buy-it-in-chatgpt/ ; https://techcrunch.com/2026/03/24/openais-plans-to-make-chatgpt-more-like-amazon-arent-going-so-well/ ; https://www.swell.is/content/agentic-commerce-protocol-explained ; https://www.neuralpartners.ai/resources/agentic-commerce-protocols-explained/ ; https://ottom.io/learn/state-of-agentic-checkout ; https://www.klaviyo.com/solutions/ai/what-is-agentic-commerce-protocol
- https://baymard.com/research-articles/no-results-page ; .../ecommerce-search-query-types ; .../persist-search-queries ; .../explain-industry-specific-filters ; .../autodirect-searches-matching-category-scopes ; https://baymard.com/research/ecommerce-search
- https://blog.google/products-and-platforms/products/shopping/agentic-checkout-holiday-ai-shopping/ ; .../google-shopping-ai-mode-virtual-try-on-update/ ; .../google-shopping-cart/ ; https://sourcevision.com/guides/google-ai-mode-shopping/ ; https://www.shopify.com/blog/google-ai-shopping ; https://9to5google.com/2026/01/11/gemini-ai-mode-checkout/
- https://www.cardladder.com/ ; https://rip.fan/guides/card-price-sites-compared/ ; https://watchcharts.com/watches/about ; https://watchcharts.com/subscribe ; https://milleso.com/articles/how-to-price-a-pre-owned-watch ; https://www.businessinsider.com/stockx-builds-database-for-sneakerheads-and-plans-for-more-2019-7 ; https://research.contrary.com/report/stockx
