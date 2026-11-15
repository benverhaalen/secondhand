# Which real sold-item datasets can the backtest run on tonight, and what may we do with each?
Researched 2026-11-15 by Ben (Claude Code agent, project thread "Get sold-item data for the backtest"). Feature: price.

Ben, 07:39 UTC: "well what are our easiest ways of getting data of sold items", then 07:40: "look deeper into each. engineer your way around limitations. use rdd or iae if anything ends up running into a wall." Feeds [plan decisions 29 to 32](../../../spec/plans/backtest/plan.md) and the runner in `jobs/valuation/experiment.py`. Builds on [sold-price-data.md](sold-price-data.md) and [comps-sources-live.md](comps-sources-live.md) and does not repeat them. The frozen files and how to rebuild them: [jobs/valuation/data/README.md](../../../jobs/valuation/data/README.md).

## What changed

**The draft** (the coordinator's ranking at 07:39): Kaggle Mercari for the model benchmark tonight, Terapeak pulled by hand for the headline number, then Ben's Depop export, then public Poshmark and Mercari sold pages.

**What changed after searching for and against it:**

1. **There is a large eBay dataset that eBay itself cleared for research, and it beats Terapeak for the headline.** NBER hosts the eBay Best Offer data of Backus, Blake, Larsen and Tadelis (QJE 2020): 98 million listings from May 1, 2012 to June 1, 2013. It was "cleared for public release by eBay.com" and is "available for research purposes" (*observed*, nber.org data page). The listing file has a product id, start and end dates, the start price, the price paid (accepted offers included), condition, photo count, seller feedback, views, watchers and a reference price (*observed* in the column dump of a public notebook that loaded it, [AndersMunkN/PublicData](https://github.com/AndersMunkN/PublicData/blob/main/eBay/materialize.ipynb); NBER's own codebook did not load for us). Unsold listings are in the file, which gives the censored rows that D10 needs. The only catch is that it's from 2012-13.
2. **Terapeak rows are worse than "unread terms."** eBay's User Agreement §10 says of eBay's content "You may use that content solely in your eBay listings" and bars "derivative works based on that data" (*observed*, ebay.com User Agreement, effective June 28, 2026). A price model fitted on hand-pulled Terapeak rows would likely be a derivative work outside listing use (*inferred*). Keep Terapeak for looking things up, not for rows.
3. **StockX released real dated sales, so the time-ordered test can run tonight on shoes.** The StockX Data Contest 2019 workbook holds 99,956 US sales of Off-White x Nike and Yeezy 350 from Sept 1, 2017 to Feb 13, 2019. StockX's own note says it is "a random, fixed percentage of StockX sales (X%) for each colorway, on each day" (*observed*, the workbook's first sheet).
4. **Kaggle Mercari is reachable without a Kaggle login, and it is sold data.** The same 77,912,192-byte `train.tsv.7z` blob sits in three unrelated GitHub repositories (*observed*, identical git blob 6bbef977), so it is almost certainly Kaggle's original file. Mercari calls it "the product data of items sold through our US app" (*observed*, Mercari engineering blog, 2018-11-14). The Kaggle rules page renders empty for a fetcher, so the data-use clause is still unread.
5. **Public sold pages are closed for collection.** Poshmark's terms bar anyone who would "copy, scrape, harvest, crawl or use any technology, software or automated systems to collect any information or data" (§4(b)). Grailed's §12 bars scrapers and "artificial intelligence or machine learning systems" that "collect, harvest, or extract data". eBay's §3 bars "any robot, spider, scraper ... except with the prior express permission of eBay". eBay's robots.txt disallows `/sch/` for generic bots (*observed*, each site, 2026-11-15). So the safe ways in are data the sites released themselves, our own users' sales, and live listings read by a person (the backtest thread's forecast duel).

## The datasets, frozen

Every row is in the runner's schema. The rows live in project files under `secondhand-data/sold/<source>/`, and the manifests with every hash are in [jobs/valuation/data/manifests/](../../../jobs/valuation/data/manifests/).

| Source | Rows | Dates | Identity | Released by | Licence and terms | `may_model` |
|---|---|---|---|---|---|---|
| `stockx_2019` | 99,956 sold | 2017-09-01 to 2019-02-13 | product = sneaker + size (951 products, 50 models) | StockX, for its 2019 data contest | no licence stated; released for public analysis (*observed*) | true |
| `mercari_kaggle` | 1,481,661 sold (874 at $0 dropped) | none | name, brand, category, condition; no product id | Mercari, through Kaggle | competition rules unread; non-commercial research use *asserted* from memory of Kaggle's rules of that era | true |
| `nber_ebay_bo` | about 98M listings, sold and unsold | 2012-05-01 to 2013-06-01 | eBay `anon_product_id`, condition, category | eBay, through NBER | "available for research purposes"; cite Backus et al. 2020 (*observed*) | true |
| `grailed_2021` | 103,537 sold | none (file dated 2021-01-27) | designer, category, size, condition, photo count | a third party's scrape | no licence; Grailed's terms bar scraping and ML extraction | false |
| `ebay_comps_cc0` | 570 sold | 2026-08-23 to 2026-09-18 | keyword, title, condition | a third party, CC0 | CC0, but the rows were scraped from eBay | false |
| `goodwill_cc0` | 2,678 hammer prices | 2026-06-20 to 2026-09-19 | keyword, title, bid count | a third party, CC0 | CC0; ShopGoodwill's terms did not load | false |
| `mercari_apify_ccby` | 462 sold | listed dates only, October 2026 | Switch consoles, condition | a third party, CC BY 4.0 | CC BY, but scraped from Mercari | false |

`may_model` is true only where the marketplace itself released the rows. The runner keeps `may_model` false rows out of every fit and comp, so they can only ever be scored against, which is a decision for Ben (below).

## What each one can and can't prove

- **`stockx_2019` is the time-ordered comp test for shoes, and it is easy mode.** Identical shoes in the same week sold a median 1.7% apart, and 99.2% landed within 20% of their week's median (*observed*, our run on 87,035 rows in product-size-weeks with 3 or more sales). Any comp method, the eBay-style median included, will look good here. It tests drift and the size premium, not condition or identity, so present it as the noise floor, not the headline.
- **`nber_ebay_bo` is the closest thing to the real test:** used goods across eBay categories, accepted offers recovered, unsold listings kept. Its prices are 13 years old, so it proves the method, not today's level. The rows are all Best Offer-enabled listings, which skews toward pricier, negotiable items (*inferred* from the paper's subject).
- **`mercari_kaggle` is the from-a-title benchmark (decision 31).** It has no dates and no product id, so it cannot run the comp engine. It is the cold case: price from name, brand, category, condition and description, scored in RMSLE beside the 2018 leaderboard. 674k of its rows are apparel and 101k are shoes (`by_kind` in the manifest). It's from 2017, and the shipping flag only says who paid.
- **`grailed_2021` is the apparel cold case with photos counted and seller feedback.** It's a scrape, so score-only at most.
- **The 2026 CC0 and CC BY files are small and current,** good for a sanity check of today's price levels in a few collectible keywords, not for a test.

## Grey areas, for Ben

1. **Third-party scrapes (`grailed_2021`, `ebay_comps_cc0`, `goodwill_cc0`, `mercari_apify_ccby`):** we didn't scrape them, and two carry open licences, but the sites' terms bar the collection itself. My recommendation: leave them out of every published number, and use them only as labelled exploratory cells. Kept out of fits by the runner already.
2. **Kaggle's rules:** reading them needs a Kaggle login, which I won't use. Ben can read the "Rules" tab of the competition in a minute. If it says non-commercial research use only, the backtest is that, and the product's model should not be trained on it.
3. **NBER's "research purposes":** a hackathon backtest that we publish as a method is research. Fitting the shipped product's model on it is not, so keep it to the backtest (*inferred*).

## Not reached, and prior work worth knowing

- **Blocked from this container:** Kaggle, Hugging Face, nber.org, archive.org, Zenodo, Figshare, the marketplaces and data.pyg.org (which hosts a Mercari copy for PyTorch Frame). Only GitHub and package registries answer. The VM on Ben's Mac had no network at all. So NBER has to be pulled from Nate's Databricks or a Mac (packet 64).
- **Searched and not found as open data:** Depop, Poshmark, Vinted or ThredUp listing-level sold sets. Resale IQ publishes monthly Vinted aggregates under CC BY 4.0 ([resaleiq/secondhand-price-index](https://github.com/resaleiq/secondhand-price-index)): asking prices and "departures", not sales. SoldSignal (aiplannermail.com) advertises a free weekly sold-median API with no key (*asserted*, its README; unopened).
- **Paid or login-only:** PriceCharting's API, WorthPoint, eBay Marketplace Insights, BrickLink's price guide API, Discogs' price suggestions (a token), and a third-party "400M+ completed eBay sales" API ([colindaniels/eBay-sold-items-documentation](https://github.com/colindaniels/eBay-sold-items-documentation), a scraping vendor, so the same eBay §3 problem).
- **Open-source resale agents doing the same job (IAE):** [wuisabel-gif/resell-agent](https://github.com/wuisabel-gif/resell-agent) (photo to comps and price) and [BuilderShip/bricklist](https://github.com/BuilderShip/bricklist) (LEGO). Both read live comps. Neither publishes a backtest, which leaves room for ours (*observed*, their READMEs' descriptions in GitHub search; code unopened). [driscoll42/ebayMarketAnalyzer](https://github.com/driscoll42/ebayMarketAnalyzer) (275 stars) scrapes eBay sold pages, which §3 bars.
- **Wayback snapshots** of sold-search pages would be eBay content with the same §10 problem, and archive.org is blocked here. Not pursued.
- **Google Shopping** gives new and asking prices, not sales. It is useful as the `retail_offer` baseline, not as truth.
