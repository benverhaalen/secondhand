# 64: real sold rows for the backtest, and the eBay set only Databricks can pull

Updated: November 15, 2026, 09:05 UTC (codebook read, NBER URLs and the Mercari gate changed; see the follow-up in the research note). Owner: Ben. Agent: Claude Code, project thread "Get sold-item data for the backtest". Branch: `main`. Status: six sources frozen and reproducible; the NBER eBay set waits on a machine that can reach nber.org. *Agent proposal*.

## What changed for Nate

The backtest now has real sold rows, in the runner's schema (`FIELDS` in `jobs/valuation/experiment.py`), rebuilt from pinned public copies by `jobs/valuation/data/fetch.sh` with a hash check on every file. Sources, licences and biases: [research/price/ben/sold-datasets.md](../../../../research/price/ben/sold-datasets.md). Built copies are in project files under `secondhand-data/sold/`.

| Source | Rows | Dates | `may_model` |
|---|---|---|---|
| `stockx_2019` | 99,956 | 2017-09 to 2019-02 | true |
| `mercari_kaggle` | 1,481,661 | none | false in `rows.py` since 11-15 (Kaggle's rules: competition use only); the frozen copy still says true until it is frozen again |
| `grailed_2021` | 103,537 | none | false (a third party's scrape) |
| three small 2026 sets | 3,710 | 2026-06 to 2026-09 | false |

## What Nate's workspace can do that nothing else here can

The best set is NBER's eBay Best Offer data: about 98M eBay listings, May 2012 to June 2013, sold and unsold, with a product id, start and end dates, the accepted price, condition, photo count, seller feedback, views and watchers. eBay cleared it for research (https://www.nber.org/research/data/best-offer-sequential-bargaining). It's the only eBay data we can use without breaking eBay's User Agreement. Neither the cloud agents nor the VM on Ben's Mac can reach nber.org. A Databricks cluster with internet egress can.

1. In a notebook: `%sh curl -o /Volumes/<catalog>/<schema>/raw/anon_bo_lists.csv.gz https://back.nber.org/appendix/w24306/bargaining/anon_bo_lists.csv.gz` (4,451,661,738 bytes) and `sha256sum` it. `data.nber.org/data/bargaining/` now answers 403. The codebook is read and committed beside the research note; it confirms the reader's columns.
2. Load it with Spark (`spark.read.csv(..., header=True)`) into a raw Delta table, `sold_raw.nber_ebay_bo`. Keep the file's hash in the table comment.
3. Either run `jobs/valuation/data/rows.py`'s `nber_ebay_bo` mapping as a pandas UDF, or do the same mapping in SQL. It's one row per listing: `item_price` set means sold at that price, empty means `ended_unsold` priced at `start_price_usd`, `at` = `auct_end_dt` (the sale date when it sold), `listed_at` = `auct_start_dt`, `product_id` = `anon_product_id`. The dates are typed `str9`, so expect `01jun2012`, not ISO; `rows.py` accepts both. Leave `ref_price1` out: it averages sales across the whole period, so it leaks the future. Filter to the kinds the plan tests and to products with 30 or more sales. Then export one CSV per kind for `scripts/bench/backtest.py`.
4. Licence: "available for research purposes." Use it for the backtest and the published method, and keep it out of the shipped model's training. Cite Backus, Blake, Larsen and Tadelis (2020, QJE).

## What it depends on

Nothing in the app reads these tables. If a `comp` table is built in Delta later, these rows go in with `source` set and `may_model` carried through, so the runner's rule (no `may_model` false rows in any fit or comp) holds there too.

## Next action

Nate: pull NBER into the workspace when there's a slot, and tell the backtest thread the CSV paths. Ben: the two decisions in the research note's "Grey areas" (third-party scrapes and the Kaggle rules).
