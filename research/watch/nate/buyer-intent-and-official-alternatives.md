# How should a used-goods buyer app represent a buyer's purpose, decide what to ask, and compare a used listing with the best official new option?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: watch.

Evidence labels: *observed* = page text opened this session (URL, source date given); *asserted* = vendor or third party says so, or search highlight only, or from memory; *inferred* = mine. "Unopened" = link seen in a search highlight, not opened. Today is 2026-11-14. Many pages here are vendor marketing; vendor numbers are asserted even when read.

Already covered elsewhere, not repeated: Google AI Mode, UCP and ACP, the 100-scenario AI shopping test and generative UI ([buy-side note](buy-side-products-and-search-experience.md), lines 59-88); EIG, stopping rules and LLM clarification failure modes ([clarifying inputs](../../identify/nate/clarifying-inputs.md), lines 28-45); the spec's ask-when table (`spec/features/identify.md` lines 41-53, as that note points to it).

## 1. How do shipped products and literature represent a buyer's purpose and constraints?

- Amazon COSMO builds a commonsense graph of why people buy. Relations include used_for_function, used_for_event, used_for_audience, capable_of, is_a, cause. *Asserted* (search highlight of https://www.amazon.science/blog/building-commonsense-knowledge-graphs-to-aid-product-recommendation, 2024-05-10, page not opened in full). The same highlight reports a 60% higher macro F1 with a frozen encoder and a 28% macro F1 / 22% micro F1 edge fine-tuned, on the Shopping Queries Data Set. The paper page (https://www.amazon.science/publications/cosmo-a-large-scale-e-commerce-common-sense-knowledge-generation-and-serving-system-at-amazon) says it covers 18 categories and shipped in search navigation with A/B gains (*asserted*, highlight).
- Guided-selling quizzes (Octane AI, RevenueHunt, Zoovu) represent purpose as the quiz answers mapped to product tags. *Asserted* (vendor descriptions, highlights). Zoovu markets "Dynamic Questions" that pick the next question from the remaining catalogue (*asserted*, vendor, not opened).
- Purpose slots seen across these sources (*inferred* from the above and the clarifying-inputs note): use or function, event or deadline, audience (who it is for), budget, size or spec, compatibility with something already owned, condition tolerance, and brand preference.
- Not found: a published schema from ChatGPT shopping research, Rufus, Klarna or Perplexity for how they store purpose; only press descriptions surfaced (AEOsome, Business Standard, *asserted*, unopened). See Not found.
- The spec already holds a `clarify` job kind (`spec/product.md:249`) and a `candidate.match` scale (`spec/product.md:106`: exact, likely_same_model, same_family_other_variant, comparable, unresolved). A buyer purpose object with slots like those above is not in the spec files I grepped (*inferred*; grep of `spec/features` and `spec/determinations` for purpose, budget, use case returned no match).

## 2. How do products decide what to ask and when to stop?

- Policy literature (*asserted*, from memory and highlights, unopened this session): EAR, an ask-or-recommend policy (WSDM 2020); QSBPS (arxiv 1908.11733); entropy or information-gain over attributes, generalized binary search. Stop when the candidate list is short, marginal gain is low, or confidence is high. Detail and failure modes are in the clarifying-inputs note, lines 28-45.
- Quiz length, measured on Shopify stores. RevenueHunt analysed 1,905 quizzes over 180 days. *Observed* at https://revenuehunt.com/quiz-creation-mistakes-that-hurt-your-ecommerce-sales/ (opened 2026-11-14): the highest conversion rate sits at 9-12 questions across platforms; it advises starting at the industry median and extending toward 9-12 only if a longer variant lifts conversion. Email gating (*observed*, same page): gated 432 quizzes, 76% completion, 7% conversion; optional 85% and 9%; none 90% and 5%. The top-third question count by industry is 5 to 7 (*asserted*, highlight). Examples of a 21-question quiz converting at 0% and a 3-question quiz at 0% are from the same highlight (*asserted*).
- Octane AI vendor cases (*asserted*, highlights, unopened): Geologie quiz-to-purchase 9% to 13%, completion above 90%; one case with 12 questions, 86% completion, 12% quiz-to-purchase; another capped at 10 questions with 1-3 recommendations on the result page; quiz landing page 7.1% against product page 2.3% (500+ merchants). Quiz Playbook says 15% of finishers order (*asserted*, page dated Nov 2026).
- Reading across these (*inferred*): the quiz data measures a form shown up front, not an adaptive ask-when-needed policy; no source found gives a tolerated question count for a conversational assistant.

## 3. How do official-refurbished and brand-resale programs define "official alternative"?

Opened pages:
- Apple Certified Refurbished. *Observed* at https://www.apple.com/shop/refurbished/about (2026-11-14): "special savings of up to 15%"; every product carries a one-year limited warranty, AppleCare eligible. Highlight adds new battery and shell on iOS devices, free shipping and returns (*asserted*).
- eBay Refurbished. *Observed* at https://pages.ebay.com/refurbishedprogramwarranty/ (2026-11-14): Certified Refurbished is the top tier with a two-year warranty serviced by Allstate; Excellent, Very Good and Good carry a one-year warranty (the page text near "Excellent, Very Good and Good" continues past my extract; length of that warranty read as one year from the highlight, *asserted*); Open Box is pre-owned, like new, one-year Allstate warranty. Grading PDF (https://ir.ebaystatic.com/cr/v/c01/Refurb_Grading_Criteria_Q2-2025_05.23.24_US.pdf, *asserted*, highlight): free shipping and 30-day returns on all four tiers; Certified is done by the maker or an authorised refurbisher with OEM parts.

Highlights only (not opened as full pages, all *asserted*):
- Amazon Renewed (https://www.amazon.com/gp/help/customer/display.html?nodeId=GRAS7M4E8YJCLWH7): grades Premium, Excellent, Good, Acceptable; battery above 90% on Premium and above 80% on others; "Amazon Renewed Guarantee". Rebuya (2026-10-07, unopened) says 30-day returns and an 11-month Asurion warranty on select items.
- Back Market (https://www.backmarket.com/en-us/e/controlled-renewed): "Certified Renewed" means refurbished by the brand or authorised affiliates; other grades Excellent, Good, Fair; one-year limited warranty; a 30-day return window per NBC Select (2025-06-06, unopened).
- Google Refurbished (https://support.google.com/product-documentation/answer/10296924): one-year warranty.
- Patagonia Worn Wear (https://www.patagonia.com/trade-in/): credit about 20% of MSRP, items before 2007 not taken. Third party Better Trail (2026-11-13) says about 40,000 used items and that the Ironclad Guarantee covers used items (*asserted*).
- Lululemon Like New (https://likenew.lululemon.com/faq): grades excellent, great, good; 14-day returns with a $7.50 deduction; a Zendesk article dated 2026-09-29 says Like New items do not get the Quality Promise or warranty (*asserted*). This contrasts with Patagonia's guarantee.
- Levi's SecondHand terms (https://secondhand.levi.com/pages/terms-and-conditions): credit set by resale price and condition; one trade-in a month, max five items (*asserted*).
- REI Re/Supply: members only; mail returns within 30 days, in-store final sale (third party, unopened, *asserted*).
- IKEA, Walmart Restored Premium, Amazon Warehouse, Google Shopping's condition filter and Merchant Center `condition` values: only secondary mentions or nothing (see Not found).

Branded-resale platforms that show used and new together:
- Trove (https://trove.com/resale-trade-in/): Resale Widget, Resale Catalog API, Checkout API; used options on the product page when a size or colour is out of stock; used and new in one checkout (*asserted*, highlight).
- Archive (https://www.archiveresale.com/resale-platform): peer-to-peer, localized peer-to-peer, brand inventory, resale WMS, "Archive Intelligence"; style-ID lookup pre-fills a seller's listing (Modern Retail 2023-03-16, *asserted*).
- Recurate: new and used in the same cart, a Shopify app (Trellis 2021-07-19, *asserted*). BoF (2023-03-14) says Archive and Treet run a mirrored site while Recurate sits inside the brand's store (*asserted*).
- Modern Retail: over 120 brands had resale channels; Trove reported 50-70% year-over-year brand growth (*asserted*).
- Shape of these programs (*inferred*): "official" splits into three kinds with different guarantees: manufacturer-refurbished (Apple, Google, eBay Certified), marketplace-graded refurbishment by third parties (Back Market grades, Amazon Renewed, eBay lower tiers), and brand take-back resale (Patagonia, Lululemon, Levi's, REI), where warranty differs by brand.

## 4. Decision factors with numbers

- Price gap. Apple says up to 15% off new (*observed*, above). Swappa's "New vs Used" page (2026-06-17, highlight, *asserted*, "illustrative ranges only") gives typical used discounts of 35-60% for Android phones and 30-45% for iPhones, and a 9-15% launch-price drop in days after a successor launches. Direct fetch of the Swappa resale-data page returned a bot challenge (5 KB, "Just a moment"), so those numbers are highlights.
- Value retained after N years. Swappa "Used Electronics Resale Data" (https://swappa.com/blog/used-electronics-resale-data/, header 2026-06-17, prices dated 2026-09-24; *asserted*, highlight): average completed-sale price over base launch price. At about 1, 2, 3, 4 years: iPhone 91, 66, 48, 35%; Pixel 59, 46, 36, 29%; Galaxy S 53, 40, 30, 22%; Apple Watch 72, 60, 45, 34%; MacBook Air M4 87% at 1.5 years, M3 66% at 2.5, M2 52% at 4.2. Consoles above launch price (Xbox Series X 108%, PS5 Slim 101%); iPad (A16) 97% after new price rose to $449; used consoles 64-77% of today's new price. Page notes averages may blend condition grades and carriers. Swappa is a marketplace.
- Resale value matters to buyers: ThredUp 2026 Resale Report (2026-04-02, GlobalData) says 60% of 3,268 surveyed consumers call resale value a key factor in buying new apparel (*asserted*, via a copy at janeclauss.com, unopened).
- Warranty and returns. Table from section 3: Apple 1 year; eBay Certified 2 years; eBay Excellent/Very Good/Good 1 year; Google 1 year; Back Market 1 year; Amazon Renewed varies by seller (30 days to 11 months asserted); Lululemon Like New none; peer-to-peer listings none stated (*inferred*).
- Remaining life. Battery floors: Amazon above 90% (Premium) and above 80% (others), Back Market 80% per MakeUseOf (2026-09-05, *asserted*). Value-retention curves above show a first-year cliff on phones (iPhone 91% to 66%) (*inferred* from the figures).
- Recall and safety. CPSC Recalls REST API, root https://www.saferproducts.gov/RestWebServices/Recall, keyless, format=json, searchable on ProductName, Manufacturer, UPC, RecallDateStart/End and others; returns Products (Name, Model, Type, NumberOfUnits). Programmer's guide v1.4, 2018-09-17 (*asserted*, highlight; the page fetch by curl returned only 458 bytes). An unknown parameter returns every record (over 8,000 in 2018). UPC is included only "when provided". The spec already gates on this API (`spec/features/appraise.md:12`, `:74`, `:154`).
- Net cost of ownership = purchase price + shipping + expected repair or battery cost - resale value at exit (*inferred*; no vendor publishes this formula, see Not found). Inputs exist in Swappa-style value-kept curves and warranty terms above.
- Authenticity risk, delivery time, size or spec availability, newer model replacing it: no numeric source found beyond Swappa's successor-drop figure and Trove's out-of-stock-size use case.

## 5. How are successors and equivalents found?

- RTINGS (https://www.rtings.com/, *asserted*, highlight): 5,086 products bought and tested in 28 categories, Side-by-Side tool, usage-based scores (for example a TV scored for gaming versus movies). Methodology page https://www.rtings.com/company/test-benches-and-scoring-system not opened.
- Wirecutter comparison tables (https://www.nytimes.com/wirecutter/blog/comparison-tables/, 2020-05-13, *asserted*, highlight): attributes weighted by importance, for example 79 variables for space heaters; guides include a "who this is for" section (2020-07-02, *asserted*).
- Spec today: "Cheaper equivalents with a match label" across the used sites, ranked by total cost to the door, labels Exact verified, Likely same model, Same family different variant, Comparable substitute (`spec/features/appraise.md:16`, `:43`, `:80`). Equivalents sourced from official new retail are not mentioned in the files grepped (*inferred*).
- Not found: an open dataset mapping a model to its successor or its new-retail equivalent.

## Feature table

| feature | who has it | in a used-goods app that also covers new retail | data needed | in spec or new |
|---|---|---|---|---|
| Purpose slots (use, event, audience, budget, size, compatibility) | Amazon COSMO ([blog](https://www.amazon.science/blog/building-commonsense-knowledge-graphs-to-aid-product-recommendation), asserted); Octane AI, Zoovu quizzes | buyer purpose object attached to a watch or search, narrowing both used and new candidates | buyer answers, product attributes, category slot lists | new (`clarify` job kind exists, `spec/product.md:249`) |
| Adaptive next-question choice, stop rule | Zoovu Dynamic Questions (asserted); EAR, QSBPS papers | ask only the attribute that splits remaining candidates, stop at short list | candidate set, attribute values | partly (`spec/features/identify.md` ask-when table, per clarifying-inputs note); buyer-purpose use new |
| Quiz length and email gating defaults | RevenueHunt ([page](https://revenuehunt.com/quiz-creation-mistakes-that-hurt-your-ecommerce-sales/), observed) | measured question-count range for any fixed intake form | none | new |
| Official refurbished tier lookup | Apple, eBay Certified, Back Market, Amazon Renewed, Google | show the maker-refurbished price beside a used listing | program catalog by brand, price, grade, warranty | new |
| Warranty and returns comparison row | eBay ([page](https://pages.ebay.com/refurbishedprogramwarranty/), observed), Apple (observed) | row per option: warranty length, return days, who services | program terms per seller | new |
| Brand resale with take-back guarantee | Patagonia Worn Wear, Lululemon Like New, Levi's, REI | surface brand-owned used stock as an option | brand program feeds or pages | new |
| Used and new in one cart or page | Trove, Recurate, Archive | used option next to new for out-of-stock size or colour | brand catalog and stock, GTIN or style ID | new |
| Value retained and depreciation curve | Swappa ([data](https://swappa.com/blog/used-electronics-resale-data/), asserted) | resale-value-at-exit line in net cost | completed sales over launch price by model | partly (completed sales feed `valuation`, `spec/product.md:60`); curve new |
| Successor announced, new price drop | Swappa (asserted) | "newer model out, used price falling" flag | release dates, price history | new |
| Net cost of ownership | none found | price + shipping + repair - exit value, used vs new | all above | new |
| Recall gate | CPSC API ([guide](https://www.cpsc.gov/Recalls/CPSC-Recalls-Application-Program-Interface-API-Information)) | block or flag on both used and new options | brand, model, UPC | in spec (`spec/features/appraise.md:12`, `:74`) |
| Equivalent finder with match labels | Wirecutter and RTINGS tables for new; none for used | substitutes ranked by total cost, incl. new retail | attribute tables, test scores | partly (`spec/features/appraise.md:80`, used only) |
| Condition grade normalisation | eBay, Amazon, Back Market, Lululemon grades | one grade scale across sites and programs | grade definitions per program | partly (`candidate.match`, `spec/product.md:106`); grade map new |

## Not found

- Google Shopping condition filter and Merchant Center `condition` attribute page; Amazon Warehouse terms; Walmart Restored; IKEA Circular Hub terms; Rufus, ChatGPT shopping research and Klarna internals on how they store purpose; Zoovu pages opened.
- Any published tolerated question count for a conversational shopping assistant; Zou CIKM 2020 paper not opened; no OpenAlex search run for job-to-be-done or purpose inference.
- A published net-cost-of-ownership formula; authenticity-risk rates per category; warranty-transfer rules for used goods; a model-to-successor dataset.
- Swappa pages returned a bot challenge to curl; CPSC page returned 458 bytes to curl.

## Searched / could not reach

Searched: Amazon COSMO, Octane AI, RevenueHunt, Zoovu, official refurbished programs, brand resale programs, Trove, Archive, Recurate, Swappa, ThredUp, CPSC API, RTINGS, Wirecutter. Most of these were search highlights only. Opened in full this session: Apple, eBay warranty, RevenueHunt. Could not reach or did not open: Swappa (bot challenge), CPSC (stub), Amazon, Back Market, Lululemon, Patagonia, Trove, Archive. A narrow search does not prove absence.

## Sources fetched

- https://www.apple.com/shop/refurbished/about (opened, 2026-11-14)
- https://pages.ebay.com/refurbishedprogramwarranty/ (opened, 2026-11-14)
- https://revenuehunt.com/quiz-creation-mistakes-that-hurt-your-ecommerce-sales/ (opened, 2026-11-14)
- https://swappa.com/blog/used-electronics-resale-data/ (bot challenge; highlight only)
- https://www.cpsc.gov/Recalls/CPSC-Recalls-Application-Program-Interface-API-Information (stub; highlight only)
- All other URLs above: search highlights, unopened.
