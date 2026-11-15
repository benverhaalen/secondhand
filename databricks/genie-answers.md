# Genie's answers to the judge questions

Asked 2026-11-15T12:49:23.180Z of the space secondhand market (01f1e0d8d8d3161fa9590e55702c1b46) by `node databricks/genie/ask.mjs`. Every figure is a development reading on historical public sales (StockX 2017 to 2019 and the other public datasets), never accuracy on live listings. The workspace backtest scores the nightly market model, which the app does not serve; the served engine is `measures.engine_ablation`.

## What is the Adidas Yeezy Boost 350 V2 Zebra worth, and which sales does that rest on?

Status: COMPLETED

```sql
WITH p AS (  SELECT s.id FROM secondhand.measures.shown_prices s  WHERE s.metric = 'valuation.model.q50' AND lower(s.item) LIKE '%zebra%'  ORDER BY s.as_of DESC, s.id  LIMIT 1)
SELECT 'nightly market model, not the engine the app serves' AS priced_by, b.item, try_divide(b.value_cents,100.0) AS market_model_price_dollars, try_divide(b.lo_cents,100.0) AS low_dollars, try_divide(b.hi_cents,100.0) AS high_dollars,       try_divide(b.sold_cents,100.0) AS it_sold_for_dollars, b.basis_count, b.basis_level, b.as_of, b.data,       try_divide(b.basis_price_cents,100.0) AS earlier_sale_dollars, b.basis_at, b.basis_source, b.source_url, b.rebuilt_exactly
FROM secondhand.measures.price_basis b
JOIN p ON p.id = b.id
ORDER BY b.basis_at DESC
```

The Adidas Yeezy Boost 350 V2 Zebra was valued at **$337.97** by the nightly market model (not the app engine), based on StockX sales data from February 2019. This price is rebuilt exactly from the **5 sales it cites**, with sale prices ranging from **$306.50** to **$349.00**. All cited sales are from the dataset:stockx_2019, with the most recent basis sale on 2019-02-11.

## How did our price do against the last sale and the 90-day median on the same sales?

Status: COMPLETED

```sql
WITH m AS (  SELECT `Price from` AS price_from, MEASURE(`Sales tested`) AS sales_tested, MEASURE(`Estimates shown`) AS prices_given,         MEASURE(`Within 20 percent`) AS within_20_percent, MEASURE(`Median error`) AS median_error,         MEASURE(`Range held the sale`) AS range_held_the_sale  FROM secondhand.measures.valuation_metrics  GROUP BY ALL)
SELECT 'workspace backtest, latest run' AS reading, price_from, sales_tested, prices_given, within_20_percent, median_error, range_held_the_sale,       CAST(NULL AS DOUBLE) AS vs_last_sale_points, CAST(NULL AS DOUBLE) AS vs_last_sale_lo, CAST(NULL AS DOUBLE) AS vs_last_sale_hi
FROM m
UNION ALL
SELECT concat(a.reading, ', ', a.data) AS reading, a.label AS price_from, a.sales AS sales_tested, CAST(round(a.sales * a.priced) AS BIGINT) AS prices_given,       a.within_20 AS within_20_percent, a.median_error, a.range_held AS range_held_the_sale, a.vs_last_sale_points, a.vs_last_sale_lo, a.vs_last_sale_hi
FROM secondhand.measures.engine_ablation a
ORDER BY reading, within_20_percent DESC
```

On the StockX 2019 dataset, the engine the app serves was within 20 percent of the last sale on **96%** of sales, with a median error of **3.89%** and a range held the sale of **86%**. Compared to the last sale, its within-20-percent rate was **1.0 percentage point lower** (interval: -1.4 to -0.7 points). Against the 90-day median, the app engine had a higher within-20-percent rate (**96%** vs **89.1%**) and a lower median error (**3.89%** vs **5.76%**), both on 41,988 sales.

## Which price engine does the app serve, and how does it compare with the last sale?

Status: COMPLETED

```sql
SELECT 
  contestant AS engine_served, 
  label AS price_basis, 
  served, 
  data, 
  test_from, 
  test_to, 
  sales, 
  ROUND(sales * priced) AS prices_given, 
  within_20 AS within_20_percent, 
  median_error, 
  range_held, 
  width, 
  vs_last_sale_points, 
  vs_last_sale_lo, 
  vs_last_sale_hi, 
  vs_last_sale_n, 
  reading, 
  source
FROM secondhand.measures.engine_ablation
WHERE served = true
```

The app serves the **engine_all_on** price engine, based on the dataset:stockx_2019 and a development reading dated 2026-11-15. Compared to the last sale, this engine's within-20-percent rate is **1.0 percentage point lower** (vs_last_sale_points = -1.0) over 41,452 sales. This comparison covers sales from 2018-11-01 to 2019-02-13.

## Which weight moved, and on what evidence?

Status: COMPLETED

```sql
WITH months_per_run AS (SELECT run_id, count(DISTINCT month) AS months_tested FROM secondhand.measures.param_moves GROUP BY run_id) SELECT m.run_id, m.month, mp.months_tested, m.name, m.scope, m.action, m.version, m.value, m.held_out_score, m.champion_version, m.champion_score, m.diff, m.noise, m.reason, m.data FROM secondhand.measures.param_moves m LEFT JOIN months_per_run mp ON m.run_id = mp.run_id ORDER BY m.run_id, m.name, m.scope, m.month, CASE m.action WHEN 'rollback' THEN 0 WHEN 'propose' THEN 1 WHEN 'promote' THEN 2 WHEN 'hold' THEN 3 END, m.version
```

The weight **comps_half_life_days** moved, with its value changing from 90.0 to 7.0. The evidence for these moves includes reasons such as "prior proposed; noise: centered paired bootstrap: 95th percentile of |d* - mean d|, 200 resamples," "past-three-month grid fit," and "beat v1." Examples include:
- **Value 90.0** proposed and promoted with reason "prior proposed; noise: centered paired bootstrap"
- **Value 7.0** proposed with reason "past-three-month grid fit"
- **Value 7.0** promoted with reason "beat v1"
- **Value 7.0** held with reason "lost held-out"
- **Value 7.0** repeatedly proposed and held with similar evidence in subsequent months.

## How many sales did each source contribute, and under what rights?

Status: COMPLETED

```sql
SELECT f.source, f.bronze, f.dropped, f.kept, f.modelled,       r.may_model, r.may_model_scope, r.clause, r.clause_url
FROM secondhand.measures.pipeline_funnel f
LEFT JOIN secondhand.governance.source_rights r ON r.source = f.source
ORDER BY f.kept DESC
```

Each source contributed the following number of sales ("kept"), along with their associated rights:
- **mercari_kaggle**: 1,481,418 sales, may be used for modeling under hackathon_demo rights (Kaggle competition use only)
- **grailed_2021**: 103,525 sales, not permitted for modeling (no license; Grailed terms bar scraping and ML extraction)
- **stockx_2019**: 99,956 sales, may be used for modeling under hackathon_demo rights (StockX Data Contest, no license stated)
- **goodwill_cc0**: 2,673 sales, not permitted for modeling (CC0 1.0, but ShopGoodwill terms restrict reuse)
- **ebay_comps_cc0**: 569 sales, not permitted for modeling (CC0 1.0, collected from eBay)
- **mercari_apify_ccby**: 462 sales, not permitted for modeling (CC BY 4.0, collected from Mercari)

The largest contribution comes from mercari_kaggle, and only mercari_kaggle and stockx_2019 are allowed for modeling under the specified rights.

## What is the median sold price among the earliest 10 StockX sales?

Status: COMPLETED

```sql
WITH s AS (SELECT `price_cents`, `at` FROM `secondhand`.`market`.`comp` WHERE `source` = 'stockx_2019' AND `price_type` = 'sold' ORDER BY `at` ASC NULLS LAST, `comp_id` LIMIT 10) SELECT count(*) AS `n`, min(`at`) AS `first_at`, max(`at`) AS `last_at`, CASE WHEN count(*) < 30 THEN concat('too few: ', count(*), ' sales') END AS `refused`, CASE WHEN count(*) >= 30 THEN try_divide(percentile_approx(`price_cents`, 0.5),100.0) END AS `median_dollars` FROM s
```

There are **too few: 10 sales** among the earliest StockX sales to provide a median sold price. To resolve this, a wider date range or the parent kind would be needed.

Would you prefer to see the median sold price among the earliest 30 StockX sales instead of just 10?

## What is the median sold price of a Yeezy on Depop?

Status: COMPLETED

```sql
SELECT count(*) AS n, min(comp.at) AS first_at, max(comp.at) AS last_at,
  CASE WHEN count(*) < 30 THEN concat('too few: ', count(*), ' sales; try a wider date range or the parent kind') END AS refused,
  CASE WHEN count(*) >= 30 THEN try_divide(percentile_approx(comp.price_cents, 0.5),100.0) END AS median_dollars
FROM secondhand.market.comp comp
WHERE comp.site = 'Depop' AND comp.brand = 'Yeezy' AND comp.price_type = 'sold'
```

There were **0 sales** of Yeezy on Depop in the dataset, so the median sold price cannot be calculated. To resolve this, try a wider date range or include the parent kind.

## Which core tables are locked to their owner, and which columns are masked?

Status: COMPLETED

```sql
SELECT l.schema_name, l.table_name, l.has_owner_tag, l.masked_columns, l.retention_class, l.read_at
FROM secondhand.measures.locks_in_force l
WHERE l.schema_name = 'core'
ORDER BY l.table_name
```

All 11 core tables are locked to their owner. Only two tables have masked columns: the **decision** table masks the "buyer_handle" column, and the **observation** table masks the "seller_handle" column. The remaining core tables do not have any masked columns.
