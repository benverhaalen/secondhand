# Sold rows for the backtest

Rebuild the six smaller sources from pinned public copies and check their input hashes:

    jobs/valuation/data/fetch.sh <out_dir>

Tests, one file at a time: `./.venv/bin/python -m pytest jobs/valuation/data/test_rows.py -q` and `./.venv/bin/python -m pytest jobs/valuation/data/test_subset.py -q`. About 90 seconds and 170 MB of output on a laptop. The rows are not in git, because the repo is public and most of these licences don't allow redistribution (plan §6). The manifests are in git: `manifests/<source>.json` holds each input's sha256, the output's sha256, row counts by price type and kind, the date range and what was dropped and why. A built copy sits in project files under `secondhand-data/sold/<source>/rows.csv.gz`.

What each source is, its licence, its bias and what it can prove: [research/price/ben/sold-datasets.md](../../../../research/price/ben/sold-datasets.md).

| File | Role |
|---|---|
| `rows.py` | one reader per source, into the runner's `FIELDS` plus four extras (`description`, `retail_cents`, `released_at`, `region`) |
| `freeze.py` | one source's raw files into `rows.csv.gz` and `manifest.json`, byte-identical on rerun; refuses a raw file whose hash changed |
| `subset.py` | two streaming CSV passes select repeat-sale NBER products, then write through `freeze.py` |
| `sources.json` | where each raw file comes from (the official page, the pinned mirror commit) and its expected sha256 |
| `fetch.sh` | clones the pinned mirrors and runs `freeze.py` for each source |

## Run the backtest on one

    gunzip -c <out_dir>/stockx_2019/rows.csv.gz > stockx.csv
    python3 scripts/bench/backtest.py backtest --rows stockx.csv --test-from 2018-11-01 --out stockx-bt.json

Only `stockx_2019` and `nber_ebay_bo` have sale dates, so only they can run the time-ordered test. `mercari_kaggle` and `grailed_2021` have no dates or product ids and are for the from-a-title test.

## The NBER eBay data

`nber_ebay_bo` is eBay Best Offer listings from May 2012 to June 2013. NBER describes them as "cleared for public release by eBay.com" and "available for research purposes" ([NBER page](https://www.nber.org/research/data/best-offer-sequential-bargaining), lead's reading, 2026-11-15). Cite Backus, Blake, Larsen and Tadelis (2020), QJE. These historical rows test the method, not today's prices; use them for research backtests rather than training the shipped model.

The working download URL is https://data.nber.org/bargaining/anon_bo_lists.csv.gz. The older `http://data.nber.org/data/bargaining/` path returns 403 (lead's observation, 2026-11-15). The pinned input is 4,451,661,738 bytes, sha256 `ceda12755878304daa4ca43b45c72ec98a7382a1ee646e66c33f6841e5d1a646`. A different hash is refused before either CSV pass or any rows are written. Input paths may differ, but the basename must match `sources.json`.

`fetch.sh` does not build this subset. Build `nber_ebay_bo` with:

    cd jobs && PYTHONPATH=../log python3 -m valuation.data.subset <raw gz> <out dir>

For this checkout's environment:

    cd jobs && PYTHONPATH=../log ../.venv/bin/python -m valuation.data.subset ~/secondhand-data/raw/nber/anon_bo_lists.csv.gz ~/secondhand-data/sold/nber_ebay_bo

Pass 1 counts rows with `item_price` set per non-empty `anon_product_id`. Products need at least 30 sold rows and mapped meta categories. For each kind, select at most 80 products by the smallest sha256 of the UTF-8 product id, with product id breaking hash ties. Selection uses sale counts only as a threshold. Pass 2 keeps every listing of a selected product, including ended-unsold listings, in input order; normalization drops invalid start/end dates and rows without a price and counts each reason. Counts and kind sets stay in memory; listing rows and output CSV stream.

*Agent proposal for products spanning categories:* a product must rank in the smallest 80 in every kind it appears in; a product with any unmapped meta category is excluded. This keeps each selected product whole and each kind at most 80 products. It can leave a kind below 80. Products per kind count distinct products actually written after normalization drops.

Output `rows.csv.gz` contains exactly the runner's `FIELDS`, in order. Gzip has mtime 0 and no embedded filename. `manifest.json` records the input file hash and bytes, compressed output file hash, columns, row counts by `price_type` and kind, actual products per kind, end-date range, input row count, mutually exclusive drop counts and the full subset rule. Compare both files' hashes across runs at the same code commit; then copy `manifest.json` to `jobs/valuation/data/manifests/nber_ebay_bo.json`. `build.jsonl` records runtime events through `log/`; it is separate from the deterministic artifacts. Older manifests for the six smaller sources hash the uncompressed CSV; newly built manifests hash the gzip file itself.

### Columns checked against the codebook

Read locally on 2026-11-15 with `rows.py`'s stdlib `_xlsx_rows(path, 1)`: `Codebook.xlsx`, sheet `bo_lists`, sha256 `3fa5e83046ac29e610cf2bcf02fd85682f93f3608c689c5a434d794c65bb6516`. Every raw column read by the mapper or subset is listed below. The earlier notebook-based names agree with the codebook; the price description and date conversion needed correction.

| Input | Codebook meaning and output |
|---|---|
| `anon_item_id` | Anonymized listing ID; prefixed into `row_id`. |
| `anon_product_id` | Anonymized catalog product ID, available only for catalog-linked items; `product_id` and subset selection. |
| `auct_start_dt` | Listing start date; parse `%d%b%Y`, such as `22oct2012`, into ISO `listed_at`. |
| `auct_end_dt` | Seller-chosen end date, replaced by sale date if sold; parsed into ISO `at`. |
| `start_price_usd` | Buy-It-Now price; integer cents for `ended_unsold` rows. The codebook does not call it the last ask; `bin_rev` says whether it was ever modified. |
| `item_price` | Final Buy-It-Now or negotiated Best Offer price; missing means never sold. Sets `price_type`, supplies sold `price_cents`, and counts sales for selection. |
| `photo_count` | Number of listing photos; `photo_count`. |
| `fdbk_score_start` | Number of previous seller feedbacks received at listing time; optional `seller_feedback`. |
| `item_cndtn_id` | Stated new/used status; mapped into `condition`. |
| `meta_categ_id` | Non-anonymized meta category ID; retained in `category` and mapped into `kind`. |
| `bo_ck_yn` | Whether sold through Best Offer: 0 no, 1 yes; sold rows get `best_offer=none` or `accepted`. |
| `view_item_count` | Number of item-page views; `views`. |
| `wtchr_count` | Number of users who added the listing to their watch list; `watchers`. |

Condition codes checked: 1000 new, 1500 new other, 1750 new with defects, 2000 manufacturer refurbished, 2500 seller refurbished, 2750 like new, 3000 used, 4000 very good, 5000 good, 6000 acceptable, 7000 for parts/not working. Unknown or missing condition stays empty. Meta IDs in `_EBAY_KIND` were checked against the same sheet; the table groups broad categories into existing kind families. For example, 11450 is Clothing Shoes & Accessories, grouped as apparel; this source cannot separate shoes and bags within that meta category.

`anon_slr_id` and `anon_buyer_id` are never emitted or used to derive features. The only seller attribute retained is the feedback count. Shipping prices are unavailable and left empty; shipping-time columns are hours, not costs. Full-period `ref_price*` averages are excluded. Titles and leaf categories are anonymized and unused. `cluster_id` remains empty: listing IDs do not establish physical-item deduplication across relists, so this freeze alone does not satisfy plan decision 5. Views and watchers are listing totals, not observations as of listing time. The 30-sale threshold over the full source does not guarantee decision 29's locked-month sample size.
