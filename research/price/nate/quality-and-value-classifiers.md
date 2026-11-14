# Which classifiers, scoring models and ranking structures that judge one piece of content or product above another have been published, leaked or reverse-engineered as of November 2026, and what in their design could score and improve a used-goods listing and its price?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: price.

Evidence marks: *observed* means I opened the source and it says so, with URL and the source's date. *observed (highlight)* means I saw the passage only in a search-result excerpt of that URL, not the full page. *asserted* means the source claims it without showing, or I am relaying a press report. *inferred* is my reasoning. "Unopened" means I did not open the link.

## Summary

1. No source I opened shows TikTok or Douyin scoring users' attractiveness with a model, or detecting emotion to shape feeds (*observed*, Part 1). The "ugly" material is a 2020 moderator rulebook and a 2024 lawsuit paragraph quoting an internal report line.
2. The disclosed ranking structures are one pattern: predict several action probabilities, then combine them with hand-set weights (X, TikTok, Instagram, YouTube). Quality enters as a feature or a filter, not as the whole score.
3. The one published link between photo quality and used-goods sale is small: odds ratios 1.17 to 1.25, and about 1 point of accuracy over a baseline (eBay and Cornell, 2018). A separate paper finds photo count matters far more than photo quality on resale.
4. Price position against similar sold items is the strongest published listing-level predictor (eBay 2011; the Avito 5th-place writeup's best engineered feature was relative price).
5. Published price-suggestion systems gate before they predict (arXiv 2012.06008) and Mercari's own report says the Kaggle winner did not reproduce its score on the Japanese app.

## Part 1. Premise check: did leaks or audits show TikTok or Douyin scoring attractiveness or reading emotion?

| Source and date | What it says (quoted) | What it shows about a beauty model | What it shows about emotion detection |
|---|---|---|---|
| The Intercept, "TikTok Told Moderators: Suppress Posts by the 'Ugly' and Poor", 2020-03-16, https://theintercept.com/2020/03/16/tiktok-app-moderators-users-discrimination/ | "instructed moderators to suppress posts created by users deemed too ugly, poor, or disabled for the platform, according to internal documents obtained by The Intercept." (*observed*; the Exa fetch returned only the opening, so the rule text itself is *asserted* by the article and I did not read it in full) | Shows a human-moderator instruction set about appearance and environment. It names moderators, not a classifier. Does not show a model scoring faces. TikTok said the rules were no longer in use (*asserted*, from my earlier read of the article through a summariser, so treat as unverified) | Nothing on emotion in what I read |
| New York Times, Ben Smith, "How TikTok Reads Your Mind", 2021-12 (published around 5 Dec), the "TikTok Algo 101" document | "There are four main goals for TikTok's algorithm: 用户价值, 用户价值 (长期), 作者价值, and 平台价值, which the company translates as 'user value,' 'long-term user value,' 'creator value,' and 'platform value.'" (*observed*, Exa fetch; the page returned only the opening). The article says the document was produced by TikTok's Beijing engineering team and a spokeswoman confirmed it is authentic and explains the algorithm to nontechnical employees (*observed*) | Nothing in the text I read mentions attractiveness | Nothing in the text I read mentions emotion. The "reads your mind" framing is the headline's, and the body I read describes engagement scoring |
| Same document, as reported by Gizmodo and The Verge (unopened by me): score = Plike x Vlike + Pcomment x Vcomment + Eplaytime x Vplaytime + Pplay x Vplay | *asserted* (press relay, unopened) | None | None |
| Kentucky Attorney General complaint against TikTok, unsealed 2024-10 (PDF I downloaded; paragraphs 197 to 198) | An internal "US Weekly Report" insight reading "High volume of . . . not attractive subjects", which the complaint says was resolved by "changing" the algorithm, and the complaint alleges promotion of a narrow beauty norm (*observed*; allegation, not a finding) | Shows a complaint quoting one internal line about "not attractive subjects" in content. Does not describe a model, labels, features or a score | None found in these paragraphs |
| Academic audits: Urman and Makhortykh 2022 (arXiv 2201.12271) and Mosnar 2025 (arXiv 2504.18140) | Behavioural audits of what the feed shows after watching, liking and following (*asserted*; I did not open them in full) | Neither is described as testing appearance | Neither is described as testing emotion |

Not found: any primary source (leak, filing, patent I opened, audit) in which TikTok or Douyin runs an emotion-recognition model on users or ranks by a facial-attractiveness score. A narrow search does not prove none exists (*not-found*).

What the sources do support (*observed*): the ranking document describes engagement predictions and four named value goals; separate human rules about appearance existed in 2020; a lawsuit filing quotes an internal line about "not attractive subjects". The jump from these to "an attractiveness model shapes the feed" is *inferred* by whoever makes it, not shown by the sources.

## Part 2. Disclosed systems

### 2.1 Feed rankers: X, TikTok, Instagram, YouTube

| System, source, date | What is scored | Inputs | Structure | How scores become rank | Evidence of effect |
|---|---|---|---|---|---|
| X, twitter/the-algorithm-ml heavy ranker README (2023; downloaded) | Probabilities of positive and negative actions on a post | User and post features, engagement history | Neural multi-task ranker (MaskNet) with one head per action (*observed*, README on disk) | Weighted sum of head probabilities (*observed* in README) | None published in the repo |
| X, xai-org/x-algorithm README (2026; downloaded) | Same family of action predictions | User history sequence | Transformer called Phoenix (*observed*, README) | Weighted combination; I did not verify exact 2026 weights against `vm-ranker/params.rs`. A third-party site lists weights, unopened | None published |
| TikTok "Algo 101", NYT 2021-12 | Four goals: user, long-term user, creator, platform value | Not shown in what I read | Not shown | Formula as reported by press: sum of P(action) x V(action) (*asserted*, unopened) | None |
| Instagram, Mosseri, "Shedding More Light on How Instagram Works", 2021-06-09 (Medium copy dated 2022-02-23) | Roughly a dozen predictions; Feed's five: spend a few seconds, comment, like, save, tap profile photo | Post, poster, your activity, your history with the poster (*observed (highlight)*) | Prediction heads | "The more likely you are to take an action, and the more heavily we weigh that action, the higher up you'll see the post." Reels not recommended if low-resolution or watermarked (*observed (highlight)*) | None stated. Explore ranks "without us necessarily understanding what each post is about" (*observed (highlight)*) |
| YouTube, Zhao et al., RecSys 2019, "Recommending What Video to Watch Next", https://dl.acm.org/doi/pdf/10.1145/3298689.3346997 | Engagement and satisfaction objectives | Video, user and context features | Multi-gate mixture-of-experts on a Wide and Deep base; binary heads use cross-entropy, regression heads squared loss; a shallow position-bias tower with 10% position dropout (*observed (highlight)*) | "combined score using a combination function in the form of weighted multiplication. The weights are manually tuned" (*observed (highlight)*) | Live: 8-expert MMoE +0.45% engagement and +3.07% satisfaction, against shared-bottom +0.1% and +1.89% (*observed (highlight)*) |

Design points (*inferred* from the above): rank is a hand-weighted combination, so the weights are a product decision; position bias is modelled explicitly in YouTube, which matters when learning from logs of listings shown in a fixed order.

### 2.2 Search and recommendation at marketplaces

| System, source, date | What is scored | Structure and combination | Evidence of effect |
|---|---|---|---|
| Airbnb, Grbovic and Cheng, KDD 2018 (blog 2018-03-13) | Listing similarity | 32-dimension listing embeddings from click sessions, the booked listing as global context, same-market negatives; 4.5M listings, 800M sessions; embedding similarity features fed to the search ranker (*observed (highlight)*) | +21% Similar Listing carousel click-through, +4.9% guests finding the booked listing there (*observed (highlight)*) |
| Airbnb, "Categorizing Listing Photos", 2018-05-02 | Room type | ResNet50 classifier (*observed (highlight)*) | Not stated |
| Airbnb, "When a Picture Is Worth More Than Words", 2022-12-08 | Photo aesthetics and home design | Aesthetics model with earth mover's distance loss on 1 to 5 rating distributions; predicted mean "highly correlated with image resolution and listing booking probability"; home-design model trained on Plus and Luxe qualification labels; photo auto-rank of the first five trades off design score, room relevance and diversity (*observed (highlight)*) | Ads photos from the top 50th percentile gave substantially higher click-through and booking in A/B; auto-rank launched 2021 with "significant lifts" in listing creation and booking, no figures (*observed (highlight)*) |
| Etsy, Unified Embedding Based Personalized Retrieval, arXiv 2306.04833 | Query to product match | Two-tower with T5-small text and graph and location encoders; a query-independent quality score Q(p) multiplied into relevance in the inverted index (S = R x Q); in ANN retrieval, additive boosting by hydrated vectors with weights tuned by Bayesian optimisation to maximise purchase recall (*observed (highlight)*) | +5.58% organic search purchase rate, +2.63% site-wide conversion (*observed (highlight)*) |
| Etsy 2020 personalised search (Lucia Yu) | Purchase likelihood | Gradient-boosted trees, pairwise formulation, top 1,000 candidates, NDCG on purchases (*observed (highlight)*) | Not captured |
| Pinterest, Zhai et al., "Learning a Unified Embedding for Visual Search", KDD 2019, https://arxiv.org/html/1908.01707 | Visual similarity for three products | One multi-task image embedding, shared base, per-task softmax branches over proxies, binarisable (*observed (highlight)*) | Better than the specialised embeddings on relevance and engagement; lower infrastructure cost (*observed (highlight)*) |
| Pinterest, Shop The Look, KDD 2020, https://dl.acm.org/doi/pdf/10.1145/3394486.3403372 | Shoppable objects in a scene | Object detector, then embedding nearest-neighbour filtered by predicted category (*observed (highlight)*) | "over 160% in end-to-end human relevance judgements and over 80% in engagement" cumulative (*observed (highlight)*) |
| Vinted, Vespa post 2023-10-09; dense retrieval 2025-11-18; autocomplete 2026-04-22 | Item to user match; query suggestions | Two-tower with listing metadata and photos on one side and user sequences on the other; 256-dim space with CLIP embeddings of primary photos; LightGBM LambdaRank on NDCG@1 for autocomplete, with item sell-through rate as a per-suggestion metric (*observed (highlight)*) | A scoped-suggestion variant raised click-through about 2.4% but cut purchase likelihood about 1.3%, and was rejected (*observed (highlight)*) |
| Mercari, "Fine-tuned SigLIP Image Embeddings for Similar Looks", 2024-11-08, https://engineering.mercari.com/en/blog/entry/20241104-similar-looks-recommendation-via-vision-language-model/ | Visual similarity | SigLIP fine-tuned on about one million listings (title and image pairs), 768 to 128 dimensions by PCA; nDCG@5 0.662 against MobileNet 0.607 | 1.5x tap rate, +14% purchases via item detail page in A/B (*observed (highlight)*). The post says embeddings also serve fraudulent-listing detection (*observed (highlight)*) |
| Amazon learning to rank and A/B findings | | | Not searched in this run (*not-found*) |

### 2.3 Quality and sale outcome for used goods

| Source and date | What it measures | Result |
|---|---|---|
| Ma, Wilber et al., "Understanding Image Quality and Trust in Peer-to-Peer Marketplaces", WACV 2019, arXiv 1811.10648 (2018-11-26); Cornell Chronicle 2019-01-08 | eBay logs: shoes (66k sold, 66k unsold) and handbags (16k and 16k) | Odds ratio of sale 1.17 (shoes) and 1.25 (handbags), p<.001, controlling for an AVA-trained aesthetics score; baseline accuracy 80.3% and 74.7%, with image quality adding about 1 point; about 75,000 images, quality prediction about 87% accurate; 300 raters scored trust 3.8 for high-quality user photos, 3.7 stock, 3.4 low-quality; brighter and higher foreground-to-background contrast scored higher (*observed (highlight)*) |
| "Is a Picture Really Worth a Thousand Words?", WSDM 2014, https://dlnext.acm.org/doi/pdf/10.1145/2556195.2556226 | Resale pairs, n=55,396 | Photo count correlates with resale profit at 0.788 and image quality at 0.032; image-quality impact is limited for used and resale goods (*observed (highlight)*) |
| Yuan, "Predicting eBay Listing Conversion", SIGIR 2011 | Probability a live listing sells | Features: price, clicks, category, duration, seller feedback, format. The ratio of initial total price to the median total price of recently sold similar items is "highly correlated with conversion" (*observed (highlight)*) |
| Talebi and Milanfar, NIMA, arXiv 1709.05424; Google blog 2017-12-18 | Aesthetic and technical quality | Predicts a distribution of ratings with an earth mover's distance loss; trained on AVA (about 255,000 images) and TID2013 for technical quality; the mean ranks photos and the standard deviation reflects unconventionality (*observed (highlight)*). Successors (MUSIQ, LAION aesthetic predictor): not searched (*not-found*) |

### 2.4 Price prediction and where it failed

| Source and date | Finding |
|---|---|
| Mercari Price Suggestion Challenge, first place Jankiewicz and Lopuhin, Kaggle writeup 2018-03-31 | Sparse MLP ensemble, log-price target, RMSLE 0.3733 private; 60-minute, 16 GB kernel limit; no images in the data (*observed (highlight)*) |
| Mercari Engineering, "Report of Mercari Price Suggestion Challenge", 2018-11-14, https://engineering.mercari.com/en/blog/entry/2018-11-14-172509/ | A 3000 JPY item came out as a range of 2051 to 4387 JPY with a competition-style model; "even the model provided by the winning team was unable to achieve the same score in the Japanese version of the app" (*observed (highlight)*) |
| Mercari Engineering, "Price Guidance System for Mercari US", 2020-12-23, https://engineering.mercari.com/en/blog/entry/pricing-guidance-system/ | Neural models suggest a listing price and a floor price from image, title, description, category, brand and condition, with a qualitative "slow or speedy" cue; Smart Pricing lowers the price toward the secret floor using current price, demand, views, likes and impressions (*observed (highlight)*) |
| Mercari Shops validation, 2022-09-16 | Averages reasonable, high prices poor; units and quantity were not captured as fields (*observed (highlight)*) |
| arXiv 2012.06008, "Price Suggestion for Online Second-hand Items with Texts and Images" | A binary "qualified for suggestion" classifier before a regression, with percentile and threshold constraints; unqualified items are asked to improve photos or text; custom loss balances seller gain against transaction promotion. Platform and dataset not identified (*observed (highlight)*) |
| Avito Demand Prediction (Kaggle 2018): 3rd and 5th place writeups | 3rd used "image quality features", CNN class predictions and cross-entropy objective because the target is a probability; 5th wrote that "there was no big thing missed there" on images, that "relative price" (a count-weighted ratio of item price to group mean) was one of the strongest features and that public-kernel image features "helped a little" (*observed (highlight)*) |
| Zillow Offers, Q3 2021 10-Q (filed 2021-11-02); Observer 2021-11-10; Architectural Digest 2021-11-04 | $304.4M inventory write-down because homes were bought above estimated future sale prices; Zestimate median error 1.9% on-market and 6.9% off-market; about 27,000 bought and 17,000 sold; the spokesperson cited forecasting "three to six months out" (*observed (highlight)*). The model was an estimate of today's value used to commit capital against a future price (*inferred*) |

### 2.5 Fraud and policy classifiers

| Source | Finding |
|---|---|
| Mercari Engineering, multimodal fraudulent-listing detection, 2018-04-24 (Japanese) | Inception-v3 image branch plus text network; mean average precision 0.7690 (concatenate) and 0.7704 (max-pool); adding brand, category and price reached 0.7870, and a text CNN 0.7924 (*observed (highlight)*) |
| Vinted | A third-party summary says Vinted's published material does not cover price suggestion or trust models; the company careers page names an anti-counterfeit team without describing the technology (*asserted*, secondary) |
| eBay, Poshmark, Facebook Marketplace classifiers | Not found (not searched deeply) |

## Part 3. Scores a used-goods assistant could compute before posting (*inferred*)

All rows are *inferred* designs. "Borrows from" cites Part 2. Every score is about the item or the listing, never about the seller or anyone in the photo.

| Score | Borrows from | Data to train or calibrate | Must not be used for |
|---|---|---|---|
| Photo technical quality (sharpness, exposure, resolution, watermark) | NIMA technical branch and Instagram's low-resolution and watermark rule | TID2013-style labelled distortions; the user's own listing views and sales by photo-quality bucket | Judging the person, face or home; blocking a listing on a score that the eBay study shows moves odds only 1.17 to 1.25 |
| First-photo strength (item visible, centred, contrast against background) | Airbnb photo auto-rank (design, relevance, diversity); eBay finding that brighter, high-contrast images score higher | Own click and save data per first photo; room or item-type labels | Ranking people's looks; any face-derived feature (the eBay slides note bias risk with faces) |
| Photo count and coverage | WSDM 2014 (count 0.788 against quality 0.032) | Resale pairs from own listings | Treating count as quality |
| Title and attribute completeness against what buyers search | Etsy query-independent quality Q(p); Mercari Shops finding on missing quantity field; Vinted autocomplete with sell-through as the metric | Search queries with purchase outcomes, sold-listing text, per-category attribute lists | Keyword stuffing that platform policy forbids |
| Price position against live competitors and sold comps | eBay 2011 price-to-median-sold ratio; Avito relative price with count shrinkage | Sold comps per channel (access limits in [valuation-engine](../ben/valuation-engine.md) lines 11 to 14) | Pricing from asking prices alone (they include items that never sell) |
| Predicted time to sell | eBay conversion model; Mercari "slow or speedy" cue; queue estimate | Sold and unsold outcomes with censoring | Quoting a single date as certain; Zillow shows forecast error grows with horizon |
| Trust signals (photos match item, complete description, consistent brand and category) | WACV 2019 trust ratings; Mercari multimodal fraud model | Own flagged and reviewed listings | Any inference about the seller as a person; auto-accusing a seller of counterfeits |
| Qualified-to-price gate | arXiv 2012.06008 | Abstain labels from comp counts | Hiding that the system abstained |

## Where this note confirms, extends or contradicts existing notes

- Confirms the abstain rule: the gate-before-regression design in arXiv 2012.06008 matches [valuation-engine.md](../ben/valuation-engine.md) lines 64 to 66 and [price.md](../../../spec/features/price.md) line 60 (*inferred* match).
- Confirms comps over models: Mercari's 2018-11-14 report that the winning model did not carry over, against [valuation-engine.md](../ben/valuation-engine.md) line 12 ("Comps beat models when you can show them").
- Extends the evaluation at [valuation-engine.md](../ben/valuation-engine.md) lines 81 to 87 and [price.md](../../../spec/features/price.md) line 116 (censoring): Zillow's failure and the Airbnb, YouTube position-bias and Vinted CTR-versus-purchase result all concern selection and horizon, which is the survivorship point in [analytics-and-recommendations.md](../../data/nate/analytics-and-recommendations.md) lines 95 to 96.
- Extends the plan objective `argmax P(sale within T | p) x net(p)` ([price.md](../../../spec/features/price.md) line 64): that is the "calibrated probability times value" shape of the feed rankers in 2.1 with the weights replaced by net money.
- Extends [list.md](../../../spec/features/list.md) line 59 and 60 (photo count and order are plain code): the published photo-ranking designs (Airbnb) treat order as a scored trade-off, and the eBay data suggest quality is a weak lever.
- Contradicts nothing directly. [price.md](../../../spec/features/price.md) line 72, "Do not assume relisting improves ranking", is consistent with the absence of any disclosed freshness boost I found (*inferred*; no source I opened addresses relisting).

## Searched / could not reach

Searched with Exa: Instagram, YouTube, Airbnb, NIMA, Zillow, Mercari, Etsy, eBay, Vinted, Pinterest, Avito, TikTok. Downloaded: the Kentucky complaint, X's 2023 and 2026 README files. The NYT and Intercept fetches returned only the opening paragraphs. Many Part 2 rows rest on search excerpts, marked *observed (highlight)*; they are samples, not full reads.

## Not found

- Any primary source showing TikTok or Douyin scores facial attractiveness or reads emotion to rank feeds.
- Amazon learning-to-rank papers and A/B findings (not searched).
- Poshmark and eBay listing-quality, price-suggestion or counterfeit classifier posts.
- Vinted price-suggestion and trust models.
- NIMA successors (MUSIQ, LAION aesthetic) read for this note.
- Verified 2026 X weights from `params.rs`.
- Any published causal test (A/B) that photo-quality coaching raises resale sales.

## Sources fetched

- https://theintercept.com/2020/03/16/tiktok-app-moderators-users-discrimination/ (2020-03-16, opening only)
- NYT, "How TikTok Reads Your Mind", 2021-12 (opening only)
- Kentucky complaint PDF (2024), twitter/the-algorithm-ml README, xai-org/x-algorithm README (read from disk)
- Exa search excerpts: Pinterest arXiv 1908.01707 and KDD 2020 Shop The Look; Kaggle Avito 3rd, 5th and other writeups (2018); Mercari engineering posts (2018-04-24, 2018-11-14, 2020-12-23, 2022-09-16, 2024-11-08); Etsy arXiv 2306.04833; Vinted engineering posts; Airbnb posts; YouTube RecSys 2019 PDF; eBay and WACV 2019 papers; WSDM 2014; Zillow 10-Q and press; arXiv 2012.06008
- Existing notes read: [valuation-engine.md](../ben/valuation-engine.md), spec/features price and list, analytics-and-recommendations.md, pricing-in-context.md

Skipped or not checked: Amazon, Poshmark, eBay classifiers, full reads of most cited papers.
