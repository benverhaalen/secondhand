# Sold rows for the backtest

One command rebuilds every frozen file from its pinned public copy and checks each hash:

    jobs/valuation/data/fetch.sh <out_dir>

Tests: `cd jobs && python -m pytest valuation/data`. About 90 seconds and 170 MB of output on a laptop. The rows are not in git, because the repo is public and most of these licences don't allow redistribution (plan §6). The manifests are in git: `manifests/<source>.json` holds each input's sha256, the output's sha256, row counts by price type and kind, the date range and what was dropped and why. A built copy sits in project files under `secondhand-data/sold/<source>/rows.csv.gz`.

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

`nber_ebay_bo` is eBay's Best Offer listings for May 2012 to June 2013, released through NBER for research: https://www.nber.org/research/data/best-offer-sequential-bargaining. It is 4,451,661,738 bytes compressed and about 98M rows, so it is not part of the 90-second run, and this container cannot reach nber.org. From a machine that can:

    curl -O https://back.nber.org/appendix/w24306/bargaining/anon_bo_lists.csv.gz   # data.nber.org now answers 403
    shasum -a 256 anon_bo_lists.csv.gz        # record it in sources.json under nber_ebay_bo.files
    cd jobs && PYTHONPATH=../log python3 -m valuation.data.freeze --share=0.05 nber_ebay_bo <out_dir>/nber_ebay_bo /path/to/anon_bo_lists.csv.gz

`--share` keeps a fixed share of products, chosen by hashing `product_id`, with every listing of a kept product, so histories stay whole and the same share always picks the same products ([datasets.md §3](../../../spec/plans/backtest/datasets.md#3-how-to-sample)). 5% is about the 5 to 10M history rows the sampling plan needs. Column meanings are confirmed against NBER's codebook (the research note's follow-up). The Databricks route is in [packet 64](../../../.agents/team/packets/data/64-nber-ebay-sold-rows.md).
