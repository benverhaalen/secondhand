# Sold rows for the backtest

Rebuild the six smaller sources from pinned public copies and check their input hashes:

    jobs/valuation/data/fetch.sh <out_dir>

Check: `./.venv/bin/python -m pytest jobs/valuation/data/test_rows.py -q`. The six-source rebuild takes about 90 seconds and writes 170 MB on a laptop (earlier source-thread observation). The rows are not in git, because the repo is public and most of these licences don't allow redistribution (plan §6). The manifests are in git: `manifests/<source>.json` holds each input's sha256, the output's sha256, row counts by price type and kind, the date range and what was dropped and why. A built copy sits in project files under `secondhand-data/sold/<source>/rows.csv.gz`.

What each source is, its licence, its bias and what it can prove: [research/price/ben/sold-datasets.md](../../../research/price/ben/sold-datasets.md).

| File | Role |
|---|---|
| `rows.py` | one reader per source, into the runner's `FIELDS` plus four extras (`description`, `retail_cents`, `released_at`, `region`) |
| `freeze.py` | one source's raw files into `rows.csv.gz` and `manifest.json`, byte-identical on rerun; refuses a raw file whose hash changed |
| `sources.json` | where each raw file comes from (the official page, the pinned mirror commit) and its expected sha256 |
| `fetch.sh` | clones the pinned mirrors and runs `freeze.py` for each source |

## Run the backtest on one

    gunzip -c <out_dir>/stockx_2019/rows.csv.gz > stockx.csv
    python3 scripts/bench/backtest.py backtest --rows stockx.csv --test-from 2018-11-01 --out stockx-bt.json

Only `stockx_2019` and `nber_ebay_bo` have sale dates, so only they can run the time-ordered test. `mercari_kaggle` and `grailed_2021` have no dates or product ids and are for the from-a-title test.

## The NBER eBay data

`nber_ebay_bo` is eBay Best Offer listings from May 2012 to June 2013. NBER describes them as "cleared for public release by eBay.com" and "available for research purposes" ([NBER page](https://www.nber.org/research/data/best-offer-sequential-bargaining), lead's reading, 2026-11-15). Cite Backus, Blake, Larsen and Tadelis (2020), QJE. These historical rows test the method, not today's prices; use them for research backtests rather than training the shipped model.

The working download URL is https://data.nber.org/bargaining/anon_bo_lists.csv.gz (lead's observation, 2026-11-15). The pinned input is 4,451,661,738 bytes, sha256 `ceda12755878304daa4ca43b45c72ec98a7382a1ee646e66c33f6841e5d1a646`. The earlier 1.5 GB hash was measured during the download and is invalid. `sources.json` pins the complete file; the freeze CLI refuses a hash mismatch before writing rows.

`fetch.sh` builds only the six smaller sources. The lead will freeze NBER with:

    cd jobs && PYTHONPATH=../log ../.venv/bin/python -m valuation.data.freeze --share=0.05 nber_ebay_bo <out_dir> ~/secondhand-data/raw/nber/anon_bo_lists.csv.gz

`--share` selects products by `sha256(product_id)`, keeping all valid sold and unsold listings of a selected product in input order. An empty product ID uses the row ID as its sampling key. There is no sale-count threshold or per-kind cap. Thickness, price and kind strata belong in the runner; [datasets.md §3](../../../spec/plans/backtest/datasets.md#3-how-to-sample) gives the sampling design and the reason for 5%. No backtest runs until the backend is set up, per Ben's instruction there.

`rows.csv.gz` contains the runner's `FIELDS` plus the four extras listed above. Gzip has mtime 0 and no embedded filename. `manifest.json` records input hashes and bytes, the compressed output file hash, columns, row counts by price type and kind, end-date range, drop reasons and the sampling rule. Runtime events use `log/`. Older manifests for the six smaller sources hash the uncompressed CSV; newly built manifests hash the gzip file itself. The old 30-sale NBER manifest has been deleted; a replacement awaits the lead's freeze.

### Columns checked against the codebook

Read locally on 2026-11-15 with `rows.py`'s stdlib `_xlsx_rows(path, 1)`: `Codebook.xlsx`, sheet `bo_lists`, sha256 `3fa5e83046ac29e610cf2bcf02fd85682f93f3608c689c5a434d794c65bb6516`. The repository copy has sha256 `35ccde1c33c89cb7e425996f84c032e44a12903e528901bc8ce2da19425718df`; its column meanings agree with the local copy. `test_nber_codebook_pin_and_fields` checks the repository pin and meanings without downloading anything. Every raw column read by the mapper is listed below. The earlier notebook-based names agree with the codebook; the price description and date conversion needed correction.

| Input | Codebook meaning and output |
|---|---|
| `anon_item_id` | Anonymized listing ID; prefixed into `row_id`. |
| `anon_product_id` | Anonymized catalog product ID, available only for catalog-linked items; `product_id` and product sampling. |
| `auct_start_dt` | Listing start date; parse `%d%b%Y`, such as `22oct2012`, into ISO `listed_at`. |
| `auct_end_dt` | Seller-chosen end date, replaced by sale date if sold; parsed into ISO `at`. |
| `start_price_usd` | Buy-It-Now price; integer cents for `ended_unsold` rows. The codebook does not call it the last ask; `bin_rev` says whether it was ever modified. |
| `item_price` | Final Buy-It-Now or negotiated Best Offer price; missing means never sold. Sets `price_type` and supplies sold `price_cents`. |
| `photo_count` | Number of listing photos; `photo_count`. |
| `fdbk_score_start` | Number of previous seller feedbacks received at listing time; optional `seller_feedback`. |
| `item_cndtn_id` | Stated new/used status; mapped into `condition`. |
| `meta_categ_id` | Non-anonymized meta category ID; retained in `category` and mapped into `kind`. |
| `bo_ck_yn` | Whether sold through Best Offer: 0 no, 1 yes; sold rows get `best_offer=none` or `accepted`. |
| `view_item_count` | Number of item-page views; `views`. |
| `wtchr_count` | Number of users who added the listing to their watch list; `watchers`. |

Condition codes checked: 1000 new, 1500 new other, 1750 new with defects, 2000 manufacturer refurbished, 2500 seller refurbished, 2750 like new, 3000 used, 4000 very good, 5000 good, 6000 acceptable, 7000 for parts/not working. Unknown or missing condition stays empty. Category names and mappings are listed below. Meta category 11450 combines apparel, shoes and bags; the anonymized leaf categories cannot separate them, so it maps to apparel. This dataset cannot independently fill the shoes and bags strata from that meta ID.

`anon_slr_id` and `anon_buyer_id` are never emitted or used to derive features. The only seller attribute retained is the feedback count. Shipping prices are unavailable and left empty; shipping-time columns are hours, not costs. Full-period `ref_price*` averages are excluded. Titles and leaf categories are anonymized and unused. `cluster_id` remains empty: listing IDs do not establish physical-item deduplication across relists, so this freeze alone does not satisfy plan decision 5. Views and watchers are listing totals, not observations as of listing time. A 5% product sample does not guarantee the locked-month sample sizes; the lead must check the manifest against the sampling plan.

### Raw end dates after June 2013

*Observed*, 2026-11-15: a read-only CSV scan of the complete raw gzip counted 98,307,281 listings. 6,960,984 have `auct_end_dt` after 2013-06-30: 1,283,870 with `item_price` present, and 5,677,114 with it missing. The codebook (`bo_lists` C10, C32) identifies the former as sales and the latter as unsold listings with seller-chosen end dates. Thus the dates after the advertised collection period are not all sale dates, and they are not all invalid dates. The collection window describes listings collected; later outcomes can appear in those rows.

*Observed*: those late sold dates span 2013-07-01 to 2016-09-22; late unsold end dates span 2013-07-01 to 2016-09-23. Their listing start dates span 2012-06-01 to 2013-05-31. This explains how an end-date range can extend into 2016 while the listings were collected in 2012 to 2013. Per end year:

| End year | Sold (`item_price` present) | Unsold (`item_price` missing) |
|---|---:|---:|
| 2013 (after June 30) | 1,282,644 | 1,836,330 |
| 2014 | 501 | 2,073,989 |
| 2015 | 501 | 707,362 |
| 2016 | 224 | 1,059,433 |

The reader retains the sold rows, including later sales, and drops the unsold rows ending after June 2013 with reason `unsold_end_after_observation`. These unsold end dates do not establish a sale or an observed censoring time within the collection window. Dropping them is the requested data-cleaning rule, not evidence that their later sell-through was observed. Other unsold rows remain. A regression test distinguishes the boundary (June 30), a later real sale and a future unsold end date. The lead's sampled manifest will count the exclusions during normalization, before sampling; the counts here cover the whole raw source.

Reproduce the aggregate audit without normalizing, freezing, or running a backtest:

    ./.venv/bin/python jobs/valuation/data/audit_nber.py ~/secondhand-data/raw/nber/anon_bo_lists.csv.gz

### Every raw meta category

*Observed*: counts below cover every raw row, before date exclusions or product sampling; they sum to 98,307,281. Names come from the pinned [codebook transcription](../../../research/price/ben/sources/sold-followup-2026-11-15/codebook.txt), `bo_lists` D56:D93; cells are listed per row. All 35 observed IDs have a name there. Duplicate names for one ID are preserved.

*Agent mapping*: kinds use [plan decision 30](../../../spec/plans/backtest/plan.md)'s six kinds, as enumerated in [the collection note §6](../../../research/price/ben/what-predicts-price-and-speed.md#6-what-to-collect), or `other`. The broad Home, Art and Antiques meta categories cannot establish that an item is one-off furniture or unbranded, so none is assigned to the hard bucket solely from its meta ID. Shoes and bags cannot be separated from apparel here. These coarse assignments do not certify that each row has clear product identity.

| `meta_categ_id` | Raw rows | Codebook name | Codebook cells | `kind` |
|---|---:|---|---|---|
| 1 | 13,617,718 | Collectibles | D56 | `cards_collectibles` |
| 99 | 346,846 | Everything Else | D57 | `other` |
| 220 | 4,534,127 | Toys & Hobbies | D58 | `toys_lego` |
| 237 | 962,388 | Dolls & Bears | D59 | `toys_lego` |
| 260 | 1,459,425 | Stamps | D60 | `cards_collectibles` |
| 267 | 5,210,337 | Books | D61 | `other` |
| 281 | 13,936,557 | Jewelry & Watches | D62 | `other` |
| 293 | 1,298,415 | Computers & Electronics / Consumer Electronics | D63, D64 | `electronics` |
| 316 | 32,371 | Specialty Services | D65 | `other` |
| 550 | 2,186,763 | Art | D66 | `other` |
| 619 | 1,149,426 | Musical Instruments & Gear | D67 | `other` |
| 625 | 785,393 | Cameras & Photo | D68 | `electronics` |
| 870 | 1,868,648 | Pottery & Glass | D69 | `other` |
| 888 | 2,423,930 | Sporting Goods | D70 | `other` |
| 1249 | 1,130,258 | Video Games & Consoles | D71 | `electronics` |
| 1281 | 75,703 | Pet Supplies | D72 | `other` |
| 1305 | 366,342 | Tickets & Experiences | D73 | `other` |
| 2984 | 160,275 | Baby | D74 | `other` |
| 3252 | 54,934 | Travel | D75 | `other` |
| 6000 | 3 | eBay Motors | D76 | `other` |
| 10542 | 4,170 | Real Estate | D77 | `other` |
| 11116 | 2,251,868 | Coins / Coins & Paper Money | D78, D79 | `cards_collectibles` |
| 11232 | 1,162,719 | DVDs & Movies | D80 | `other` |
| 11233 | 3,027,032 | Music | D81 | `other` |
| 11450 | 16,078,763 | Clothing Shoes & Accessories | D82 | `apparel` |
| 11700 | 2,408,416 | Home / Home & Garden | D83, D84 | `other` |
| 12576 | 3,640,324 | Business & Industrial | D85 | `other` |
| 14339 | 683,075 | Crafts | D86 | `other` |
| 15032 | 580,781 | Cell Phones & Accessories | D87 | `electronics` |
| 20081 | 1,765,987 | Antiques | D88 | `other` |
| 26395 | 680,421 | Health & Beauty | D89 | `other` |
| 45100 | 1,781,839 | Entertainment Memorabilia | D90 | `cards_collectibles` |
| 58058 | 2,400,244 | Computers/Tablets & Networking | D91 | `electronics` |
| 64482 | 10,230,463 | Sports Mem Cards & Fan Shop | D92 | `cards_collectibles` |
| 172008 | 11,320 | Gift Cards & Coupons | D93 | `other` |

The raw scan does not support the earlier claim that 92 million rows had unmapped meta IDs: the previous `_EBAY_KIND` keys cover 97,838,141 rows; only 469,140 rows use its six missing keys (316, 1305, 3252, 6000, 10542 and 172008). In particular, 16,078,763 raw rows have apparel's ID 11450. The earlier single-product apparel result came from the removed subset path; these category counts alone do not establish its cause. No 30-sale cut remains. The new table explicitly covers every observed ID, and the reader normalizes numeric ID spelling before lookup while retaining the raw category in the output.

*Observed product-ID caveat for the lead*: no raw product IDs are empty strings. In a separate read-only check of the first 100,000 rows, `anon_product_id=547957` occurs 93,886 times across 34 meta categories, including 8,820 apparel rows. The codebook does not identify that value as a missing-product sentinel. Its meaning is unresolved; the reader retains it and main's hash rule treats it as one product. *Inferred*: the removed subset's rule excluding a product if any of its categories was unmapped could reject this large cross-category group; the raw category counts alone cannot attribute its entire 92-million-row exclusion. Before interpreting the lead's freeze as a representative product sample, verify this ID's meaning and inspect the resulting sampled kind counts. No alternate sampling rule has been introduced.
