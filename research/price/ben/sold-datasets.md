# Which real sold-item datasets can the backtest run on tonight, and what may we do with each?
Researched 2026-11-15 by Ben (Claude Code agent, project thread "Get sold-item data for the backtest"). Feature: price.

Ben, 07:39 UTC: "well what are our easiest ways of getting data of sold items", then 07:40: "look deeper into each. engineer your way around limitations. use rdd or iae if anything ends up running into a wall." Feeds [plan decisions 29 to 32](../../../spec/plans/backtest/plan.md) and the runner in `jobs/valuation/experiment.py`. Builds on [sold-price-data.md](sold-price-data.md) and [comps-sources-live.md](comps-sources-live.md) and does not repeat them. The frozen files and how to rebuild them: [jobs/valuation/data/README.md](../../../jobs/valuation/data/README.md).

## What changed

**The draft** (the coordinator's ranking at 07:39): Kaggle Mercari for the model benchmark tonight, Terapeak pulled by hand for the headline number, then Ben's Depop export, then public Poshmark and Mercari sold pages.

**What changed after searching for and against it:**

1. **There is a large eBay dataset that eBay itself cleared for research, and it beats Terapeak for the headline.** NBER hosts the eBay Best Offer data of Backus, Blake, Larsen and Tadelis (QJE 2020): 98 million listings from May 1, 2012 to June 1, 2013. It was "cleared for public release by eBay.com" and is "available for research purposes" (*observed*, nber.org data page). The listing file has a product id, start and end dates, the start price, the price paid (accepted offers included), condition, photo count, seller feedback, views, watchers and a reference price (*observed* in the column dump of a public notebook that loaded it, [AndersMunkN/PublicData](https://github.com/AndersMunkN/PublicData/blob/main/eBay/materialize.ipynb); NBER's own codebook did not load for us). Unsold listings are in the file, which gives the censored rows that D10 needs. The only catch is that it's from 2012-13.
2. **Terapeak rows are worse than "unread terms."** eBay's User Agreement §10 says of eBay's content "You may use that content solely in your eBay listings" and bars "derivative works based on that data" (*observed*, ebay.com User Agreement, effective June 28, 2026). A price model fitted on hand-pulled Terapeak rows would likely be a derivative work outside listing use (*inferred*). Keep Terapeak for looking things up, not for rows.
3. **StockX released real dated sales, so the time-ordered test can run tonight on shoes.** The StockX Data Contest 2019 workbook holds 99,956 US sales of Off-White x Nike and Yeezy 350 from Sept 1, 2017 to Feb 13, 2019. StockX's own note says it is "a random, fixed percentage of StockX sales (X%) for each colorway, on each day" (*observed*, the workbook's first sheet).
4. **Kaggle Mercari is reachable without a Kaggle login, and it is sold data.** The same 77,912,192-byte `train.tsv.7z` blob sits in three unrelated GitHub repositories (*observed*, identical git blob 6bbef977), so it is almost certainly Kaggle's original file. Mercari calls it "the product data of items sold through our US app" (*observed*, Mercari engineering blog, 2018-11-14). The Kaggle rules page renders empty for a fetcher. The 2026-11-15 follow-up below finds its competition-only data-use clause in the public search index (*observed*).
5. **Public sold pages are closed for collection.** Poshmark's terms bar anyone who would "copy, scrape, harvest, crawl or use any technology, software or automated systems to collect any information or data" (§4(b)). Grailed's §12 bars scrapers and "artificial intelligence or machine learning systems" that "collect, harvest, or extract data". eBay's §3 bars "any robot, spider, scraper ... except with the prior express permission of eBay". eBay's robots.txt disallows `/sch/` for generic bots (*observed*, each site, 2026-11-15). So the safe ways in are data the sites released themselves, our own users' sales, and live listings read by a person (the backtest thread's forecast duel).

## The datasets, frozen

Every row is in the runner's schema. The rows live in project files under `secondhand-data/sold/<source>/`, and the manifests with every hash are in [jobs/valuation/data/manifests/](../../../jobs/valuation/data/manifests/).

| Source | Rows | Dates | Identity | Released by | Licence and terms | `may_model` |
|---|---|---|---|---|---|---|
| `stockx_2019` | 99,956 sold | 2017-09-01 to 2019-02-13 | product = sneaker + size (951 products, 50 models) | StockX, for its 2019 data contest | no licence stated; released for public analysis (*observed*) | true |
| `mercari_kaggle` | 1,481,661 sold (874 at $0 dropped) | none | name, brand, category, condition; no product id | Mercari, through Kaggle | competition-only use in publicly indexed Specific Rules A (*observed*, follow-up below) | false |
| `nber_ebay_bo` | about 98M listings, sold and unsold | 2012-05-01 to 2013-06-01 | eBay `anon_product_id`, condition, category | eBay, through NBER | "available for research purposes"; cite Backus et al. 2020 (*observed*) | true |
| `grailed_2021` | 103,537 sold | none (file dated 2021-01-27) | designer, category, size, condition, photo count | a third party's scrape | no licence; Grailed's terms bar scraping and ML extraction | false |
| `ebay_comps_cc0` | 570 sold | 2026-08-23 to 2026-09-18 | keyword, title, condition | a third party, CC0 | CC0, but the rows were scraped from eBay | false |
| `goodwill_cc0` | 2,678 hammer prices | 2026-06-20 to 2026-09-19 | keyword, title, bid count | a third party, CC0 | CC0; ShopGoodwill terms restrict automated extraction and reuse (*observed*, follow-up below) | false |
| `mercari_apify_ccby` | 462 sold | listed dates only, October 2026 | Switch consoles, condition | a third party, CC BY 4.0 | CC BY, but scraped from Mercari | false |

`may_model` is true only for marketplace-released rows whose terms allow this research use; Kaggle Mercari is excluded by its specific competition restriction (follow-up below). The runner keeps `may_model` false rows out of every fit and comp, so they can only ever be scored against, which is a decision for Ben (below).

## What each one can and can't prove

- **`stockx_2019` is the time-ordered comp test for shoes, and it is easy mode.** Identical shoes in the same week sold a median 1.7% apart, and 99.2% landed within 20% of their week's median (*observed*, our run on 87,035 rows in product-size-weeks with 3 or more sales). Any comp method, the eBay-style median included, will look good here. It tests drift and the size premium, not condition or identity, so present it as the noise floor, not the headline.
- **`nber_ebay_bo` is the closest thing to the real test:** used goods across eBay categories, accepted offers recovered, unsold listings kept. Its prices are 13 years old, so it proves the method, not today's level. The rows are all Best Offer-enabled listings, which skews toward pricier, negotiable items (*inferred* from the paper's subject).
- **`mercari_kaggle` would be the from-a-title benchmark (decision 31), but its indexed competition-only rule excludes this backtest (*inferred*; follow-up below).** It has no dates and no product id, so it cannot run the comp engine. It is the cold case: price from name, brand, category, condition and description, scored in RMSLE beside the 2018 leaderboard. 674k of its rows are apparel and 101k are shoes (`by_kind` in the manifest). It's from 2017, and the shipping flag only says who paid.
- **`grailed_2021` is the apparel cold case with photos counted and seller feedback.** It's a scrape, so score-only at most.
- **The 2026 CC0 and CC BY files are small and current,** good for a sanity check of today's price levels in a few collectible keywords, not for a test.

## Grey areas, for Ben

1. **Third-party scrapes (`grailed_2021`, `ebay_comps_cc0`, `goodwill_cc0`, `mercari_apify_ccby`):** we didn't scrape them, and two carry open licences, but the sites' terms bar the collection itself. My recommendation: leave them out of every published number, and use them only as labelled exploratory cells. Kept out of fits by the runner already.
2. **Kaggle's rules:** direct fetches remain unreadable, but the publicly indexed Specific Rules A restrict data use to the competition, overriding the general research allowance (*observed*, 2026-11-15 follow-up below). `may_model` is now false. Neither this backtest nor product training is established as permitted (*inferred*).
3. **NBER's "research purposes":** a hackathon backtest that we publish as a method is research. Fitting the shipped product's model on it is not, so keep it to the backtest (*inferred*).

## Not reached, and prior work worth knowing

- **Blocked from this container:** Kaggle, Hugging Face, nber.org, archive.org, Zenodo, Figshare, the marketplaces and data.pyg.org (which hosts a Mercari copy for PyTorch Frame). Only GitHub and package registries answer. The VM on Ben's Mac had no network at all. So NBER has to be pulled from Nate's Databricks or a Mac (packet 64).
- **Searched and not found as open data:** Depop, Poshmark, Vinted or ThredUp listing-level sold sets. Resale IQ publishes monthly Vinted aggregates under CC BY 4.0 ([resaleiq/secondhand-price-index](https://github.com/resaleiq/secondhand-price-index)): asking prices and "departures", not sales. SoldSignal (aiplannermail.com) advertises a free weekly sold-median API with no key (*asserted*, its README; unopened).
- **Paid or login-only:** PriceCharting's API, WorthPoint, eBay Marketplace Insights, BrickLink's price guide API, Discogs' price suggestions (a token), and a third-party "400M+ completed eBay sales" API ([colindaniels/eBay-sold-items-documentation](https://github.com/colindaniels/eBay-sold-items-documentation), a scraping vendor, so the same eBay §3 problem).
- **Open-source resale agents doing the same job (IAE):** [wuisabel-gif/resell-agent](https://github.com/wuisabel-gif/resell-agent) (photo to comps and price) and [BuilderShip/bricklist](https://github.com/BuilderShip/bricklist) (LEGO). Both read live comps. Neither publishes a backtest, which leaves room for ours (*observed*, their READMEs' descriptions in GitHub search; code unopened). [driscoll42/ebayMarketAnalyzer](https://github.com/driscoll42/ebayMarketAnalyzer) (275 stars) scrapes eBay sold pages, which §3 bars.
- **Wayback snapshots** of sold-search pages would be eBay content with the same §10 problem, and archive.org is blocked here. Not pursued.
- **Google Shopping** gives new and asking prices, not sales. It is useful as the `retail_offer` baseline, not as truth.

## Follow-up, 2026-11-15

*observed* - Read on 2026-11-15 by Ben's Codex agent. Question: what do the NBER columns mean, what do the three marketplaces permit, what does SoldSignal supply, and are Mercari competition rows usable here? This checks the reader and its `may_model` gate. Sources below were read without logging in. The NBER codebook, its text extract, the NBER README text and the two SoldSignal API responses are in [sources/sold-followup-2026-11-15/](sources/sold-followup-2026-11-15/). Marketplace terms pages were read but not copied into the repo.

### What changed

*asserted* - Draft before checking: NBER's price and offer mapping probably holds; Kaggle probably allows non-commercial research; SoldSignal probably supplies free weekly medians. The marketplace clauses were unknown.

*observed* - The NBER codebook confirms the price and offer meanings. Against the draft, Kaggle's publicly indexed competition-specific rule restricts use to the competition. SoldSignal supplies aggregates, including asking prices, rather than dated transaction rows. Mercari and ShopGoodwill expose restrictions on automated extraction. StockX's current terms could not be read. These findings replace the earlier unread-terms entries where specified below.

### (a) NBER codebook and reader

*observed* - [NBER's appendix directory](https://back.nber.org/appendix/w24306/bargaining/), lines 3-7, links the codebook, README and archives. Read 2026-11-15. Its job is to establish the original release location. `http://data.nber.org/data/bargaining/Codebook.xlsx` and its HTTPS equivalent returned 403. `https://www.nber.org/data/bargaining/Codebook.xlsx` returned HTML, not a workbook. The guessed `/research/data/bargaining-data` page failed in the web fetcher. [The appendix Codebook.xlsx](https://back.nber.org/appendix/w24306/bargaining/Codebook.xlsx) returned a valid 15,559-byte XLSX. Saved as `Codebook.xlsx`; its cells were opened directly from the workbook XML, with an extracted `codebook.txt` beside it. Read 2026-11-15. This is the authority for field meanings, replacing the notebook transcription.

*observed* - Exact explanations from the workbook's `bo_lists` sheet follow. The locator is the explanation cell, unless a value cell is also named. All read 2026-11-15 from the codebook URL above.

| Column | Cell | Exact explanation |
|---|---|---|
| `anon_item_id` | C3 | "Anonymized listing ID." |
| `anon_product_id` | C5 | "Anonymized product ID, only available for items that can be linked to specific cataloged products" |
| `auct_start_dt` | C9 | "Listing start date." |
| `auct_end_dt` | C10 | "Listing end date chosen by seller. If listing sells, this date instead represents the date of sale." |
| `start_price_usd` | C15 | "Buy-It-Now price" |
| `item_price` | C32 | "Final price (Buy-It-Now price if the item sold through Buy-It-Now option, or the final negotiated price if the item sold through Best Offer. This variable is missing if the item never sold)" |
| `bo_ck_yn` | C33; D33:D34 | "Indicator for whether item sold through best offer."; "0 = No"; "1 = Yes" |
| `item_cndtn_id` | C19 | "Indicator for the new/used status of the item." |
| `meta_categ_id` | C56 | "Meta category ID, not anonymized." |
| `photo_count` | C16 | "Number of photos in listing." |
| `fdbk_score_start` | C55 | "seller's number of previous feedbacks received at the time of the listing" |
| `view_item_count` | C30 | "Number of times the item page was viewed" |
| `wtchr_count` | C31 | "Number of users who selected the "add to watch list" option for this listing" |
| `ref_price1` | C42 | "Average price for sold fixed price listings with the same listing title as this item, sold during the time frame of the data" |

*observed* - `item_price` includes the accepted Best Offer amount when the sale used Best Offer. It is the Buy-It-Now amount otherwise. Missing means never sold (C32). `bo_ck_yn` identifies an actual Best Offer sale, not merely an enabled feature (C33:D34). The reader's sold/unsold distinction and `1`/`1.0` → `accepted` logic agree. Its unsold rows leave `best_offer` empty. Its sold rows with `0` use `none`.

*observed* - The condition values in D19:D29 are: 1000 New; 1500 New other; 1750 New with defects; 2000 Manufacturer refurbished; 2500 Seller refurbished; 2750 Like New; 3000 Used; 4000 Very Good; 5000 Good; 6000 Acceptable; 7000 For parts / not working. `_EBAY_CONDITION` includes all of them and preserves those meanings.

*observed* - The complete meta-category list in D56:D93 is below. Repeated IDs and labels are in the source, not transcription repairs.

```text
1 Collectibles
99 Everything Else
220 Toys & Hobbies
237 Dolls & Bears
260 Stamps
267 Books
281 Jewelry & Watches
293 Computers & Electronics
293 Consumer Electronics
316 Specialty Services
550 Art
619 Musical Instruments & Gear
625 Cameras & Photo
870 Pottery & Glass
888 Sporting Goods
1249 Video Games & Consoles
1281 Pet Supplies
1305 Tickets & Experiences
2984 Baby
3252 Travel
6000 eBay Motors
10542 Real Estate
11116 Coins
11116 Coins & Paper Money
11232 DVDs & Movies
11233 Music
11450 Clothing Shoes & Accessories
11700 Home
11700 Home & Garden
12576 Business & Industrial
14339 Crafts
15032 Cell Phones & Accessories
20081 Antiques
26395 Health & Beauty
45100 Entertainment Memorabilia
58058 Computers/Tablets & Networking
64482 Sports Mem Cards & Fan Shop
172008 Gift Cards & Coupons
```

*observed* - Every ID explicitly used by `_EBAY_KIND` occurs in this list. Unmapped IDs 316, 1305, 3252, 6000, 10542 and 172008 fall through to `other`. The codebook supplies eBay categories, not our kind families. *inferred* - These are coarse assignments, not exact item types: 11450 can include shoes and bags as well as apparel; 1249 mixes games and consoles; 12576 is broader than tools. The codebook does not support silently splitting them. No category-map correction follows from it.

*observed* - The reader keeps listing and product IDs separate, reads listing/sale dates from the stated columns, uses seller feedback count rather than percentage, and carries photo, view and watcher counts. It does not read `ref_price1`. The codebook calls the date columns `str9`, but gives no date-string format. *inferred* - Date meanings agree; actual CSV date parsing remains unverified without a source-row sample. The codebook types both dates `str9` (B9, B10). Nine characters fit Stata's `01jun2012` and not ISO `2012-06-01`, which the reader's `[:10]` slice assumed. The AndersMunkN notebook parses them with `pd.to_datetime`, which accepts either, and shows no sample value (*observed*, its cells). So the reader now accepts both forms (`_nber_date` in `rows.py`), and its test feeds `02jun2012` and `30JUN2012` (added by Ben's Claude Code agent in review, 2026-11-15). `ref_price1` uses sales across the data period, so treating it as a time-safe reference would risk future leakage.

*observed* - The reader's docstring called `start_price_usd` the last ask. C15 only establishes the Buy-It-Now price; C37 separately records whether that price was modified. The docstring now says Buy-It-Now price, without claiming it is the last ask. No NBER executable mapping changed. The existing NBER test exercises an accepted offer and an unsold listing with synthetic ISO dates; it does not demonstrate the real archive's date encoding.

*observed* - `curl -sI` on the HTTP and HTTPS `data.nber.org/data/bargaining/` archive URLs returned 403. HEAD requests to the appendix mirror returned 200 and these `Content-Length` values, read 2026-11-15:

- [anon_bo_lists.csv.gz](https://back.nber.org/appendix/w24306/bargaining/anon_bo_lists.csv.gz): 4,451,661,738 bytes.
- [bargaining_data.zip](https://back.nber.org/appendix/w24306/bargaining/bargaining_data.zip): 5,918,427,304 bytes.

*observed* - Neither large file was downloaded. [README.pdf](https://back.nber.org/appendix/w24306/bargaining/README.pdf), page 1, read 2026-11-15, confirms public release cleared by eBay, research use, the listing period and the requested citation to Backus et al., NBER Working Paper 24306 (2018). NBER's `may_model` and licence text stay unchanged.

### (b) Marketplace terms

*observed* - [Mercari US Terms of Service](https://www.mercari.com/us/help_center/topics/account/policies/terms-of-service/), effective November 5, 2026, read 2026-11-15. `/us/tos/` failed in the web fetcher and returned 403 with curl; the Help Center page loaded in both. §2 incorporates Prohibited Conduct; §8 requires compliance with it. §5 restricts copying and derivative works of the app or website and circumventing protective measures. Exact excerpt, §5, lines 88-89: "You may not modify, alter, reproduce, distribute or make the App or Website available over a network". §7's content licence is a grant from the posting user to Mercari, not a general grant to reuse other sellers' data.

*observed* - [Mercari Prohibited Conduct](https://www.mercari.com/us/help_center/topics/account/policies/prohibited-conduct/), unnumbered fourth prohibited-conduct bullet, line 29, read 2026-11-15. Latest update listed: January 23, 2023. Exact excerpts: "use any robot, spambot, spider, crawler, scraper or other automated means or interface not provided by us" and "extract data". The same bullet bars collecting personal information without consent. The policy also bars transferring access rights (next-but-one bullet, line 31). The automated-access clause is in the policy incorporated by §§2 and 8, not a numbered scraping clause in the main terms.

*observed* - [ShopGoodwill Terms of Use](https://shopgoodwill.com/about/terms-of-use), last updated January 22, 2025, read 2026-11-15, loaded with both curl and the web fetcher. No separate effective date is shown. The fetched HTML uses unnumbered list headings for the relevant sections; it does not expose reliable section numbers. Under Ownership of the Sites and Services, lines 22-24, data is included in content; publication, distribution and commercial reuse need prior written consent, with a personal, non-commercial, non-competitive copying exception. Under Your License to Use Our Services, lines 25-28, the grant is restricted to "private, non-commercial purposes only". Under Acceptable Use of the Services, lines 38-39, the extraction prohibition includes "other automated means or interface not authorized by us to access the Services, extract data". It also bars unauthorized interacting applications and ignoring robots.txt. These are exact excerpts, not the full long clauses. `goodwill_cc0` remains false; its licence text now records these restrictions rather than unread terms.

*observed* - [StockX terms](https://stockx.com/terms), read attempt 2026-11-15: curl returned 403. The web fetcher returned 146 lines of navigation/footer, with no terms body; following its Terms link returned the same shell. Curl also returned 403 for `https://www.stockx.com/terms`, `/terms?x=1`, `/en-us/terms` and `/news/terms-and-conditions/`. The web fetcher failed on `/terms?locale=en-US` and `/news/terms-and-conditions/`, and returned 404 for `/en-us/terms` and `/terms-and-conditions`. No current clause, section number or effective date was verified. A search found an older StockX news announcement and a third-party July capture, but neither establishes today's terms. StockX's current terms remain unread; its 2019 release's `may_model` and licence text stay unchanged.

### (c) SoldSignal

*observed* - [SoldSignal home](https://aiplannermail.com), [free API documentation](https://www.aiplannermail.com/free-resale-price-api/) and [methodology](https://www.aiplannermail.com/methodology/), read 2026-11-15. The web fetcher failed on the home and methodology URLs. Curl loaded them and the docs. The docs' Endpoints and FAQ sections describe keyless, free static JSON and CSV. Their job is to define the response, not establish marketplace permission.

*observed* - A keyless GET to [api/v1/items.json](https://www.aiplannermail.com/api/v1/items.json) returned 200: 47 items, week `2026-W46`, updated `2026-11-09`, licence `CC BY 4.0`. Root fields are `week`, `updated`, `license`, `terms`, `source`, `items`. Each item has `slug`, `name`, `category`, `price`, `priceType`, `sampleSize`, `href`, `page`. First item: Air Jordan 4 Retro 'Bred Reimagined', price 247.0, `SOLD`, sample size 13. Read 2026-11-15; saved response `items.json`, with a line-readable pretty copy.

*observed* - Its [documented item endpoint](https://www.aiplannermail.com/api/v1/items/air-jordan-4-bred-reimagined.json) also returned 200 without a key. It includes basis, retail price, premium/change, source-specific figures, payouts, fee comparisons, history, timestamps, attribution and licence. The $247 basis is GOAT's median last sale across 13 sizes. StockX's figure in its payout table is a $217 90-day average. These are returned aggregates, not inspected underlying transactions. Read 2026-11-15; saved as `item-detail` and a pretty copy.

*asserted* - Methodology, Sources through Schedule and history, extracted lines 205-262: weekly public-page collection; exact-product filtering; Mercari uses up to 100 recent sold results, with title exclusions and price bands; GOAT uses last sale per size, often men's 7-13; StockX uses a 90-day average and count; Chrono24 is asking prices. SOLD and ASK remain separate. GOAT sample size counts sizes, and its sale dates are unavailable. Sources with fewer than five points are omitted. Failed sources may remain for two weeks with a stale mark. These methods were read, not independently reproduced. Read 2026-11-15.

*observed* - [SoldSignal Terms of Use](https://www.aiplannermail.com/terms/), effective November 1, 2026, version 1.0, read 2026-11-15. §5, extracted lines 260-268, grants CC BY 4.0 for downloadable/API data: commercial sharing and adaptation with attribution, licence link and changes indicated. It excludes site design, images, code and third-party trademarks, and forbids suggesting endorsement or official marketplace status. §6, lines 269-276, permits automated access for lawful purposes while forbidding service-degrading traffic, bypassing security and removing notices. §7 covers reading, indexing, summarising and citing by AI systems and agents. §4 warns of matching errors, stale data and uncertain third-party prices. Curl loaded the terms; saved as `terms` and `terms.txt`.

*inferred* - SoldSignal can supply a weekly aggregate comparison, not the listing-level sold/unsold backtest requested here. Its own open licence does not demonstrate that underlying marketplaces authorized collection. No SoldSignal reader or `may_model` entry was added.

### (d) Kaggle Mercari data-use rule

*observed* - Direct opening of both [the original Rules URL](https://www.kaggle.com/c/mercari-price-suggestion-challenge/rules) and [the competitions URL](https://www.kaggle.com/competitions/mercari-price-suggestion-challenge/rules) returned no readable rules in the web fetcher. Curl returned a page shell. No login was used. However, public web search restricted to the original Rules URL exposed the indexed official text, including the specific override and General Rules §7. Read 2026-11-15; the index reported a crawl two months earlier. This is indexed primary-source text, not a successful live-page read. A requested line-open of that result still returned zero lines, so a live line locator remains unavailable.

*observed* - In A. Specific Competition Rules, Competition Data Access and Use Restriction, the indexed text explicitly supersedes General Rules §7.A. Exact clause: "After your acceptance of these Rules, you may access and use the Competition Data only for the purposes of the Competition." The same indexed page's general research/education allowance is conditional on competition-specific restrictions. Searching for that broader allowance first, then for the specific override, changed the draft. The indexed §7.B also bars redistribution to nonparticipants. Source and date read: Rules URL above, 2026-11-15; no rule effective date was visible.

*inferred* - This is evidence against the earlier memory-based non-commercial-research permission. `mercari_kaggle` now has `may_model = false` for this independent backtest, and its licence text records competition-only use and the indexed-source limitation. It should not appear as an authorized model benchmark. The note's table and grey-area text are corrected accordingly. This gate excludes new Mercari rows from fitting and comps; it does not make scoring or redistribution permissible. Existing frozen rows/manifests were not regenerated or edited in this task. The runner reads `may_model` from each frozen row (`experiment.py` line 91, `fit.py` lines 154 and 214), and the frozen `mercari_kaggle` rows and [manifest](../../../jobs/valuation/data/manifests/mercari_kaggle.json) still say true (*observed*). The gate takes effect only when `mercari_kaggle` is frozen again with this `rows.py`. After that, `fit.py` refuses any fit on those rows, which blocks decision 31's from-a-title benchmark as planned (*inferred*). Whether to refreeze is Ben's call.

*observed* - Verification: the Mercari row and freeze-manifest assertions were changed to require false and failed against the old gate. After the gate change, `cd jobs && python -m pytest valuation/data` passed: 5 tests. Only this note, `jobs/valuation/data/rows.py` and `jobs/valuation/data/test_rows.py` were edited. No commit or push was made.

*observed* - `node .agents/check.mjs` failed outside the edited files: missing vendor documents and spec anchors, the published-words check, Node 20 rejecting TypeScript imports, and an eBay offer-clock check. These failures were not repaired because other repo files are outside this task. The generated check log was kept out of the repo. `git diff --check` passed. A fresh helper could not start because the collaboration service failed to load its thread context; review was not independent.

## Ben's call on Kaggle Mercari, 2026-11-15 09:09

Ben: "so there is no public way to access mercari data? if its there lets use it its for a hackathon demo". It is public in three GitHub mirrors of Kaggle's original file (*observed*, above), so `mercari_kaggle` is back to `may_model` true for the demo. Its licence column keeps both facts: Kaggle's "only for the purposes of the Competition" and Ben's decision. Any page that shows a Mercari number names the source and the year (*inferred*: a judge who knows the competition will ask).
