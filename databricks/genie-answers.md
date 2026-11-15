# Genie's answers to the judge questions

Asked 2026-11-15T11:21:57.943Z of the space secondhand market (01f1e0d8d8d3161fa9590e55702c1b46) by `node databricks/genie/ask.mjs`. Every figure is a development reading on historical public sales (StockX 2017 to 2019 and the other public datasets), never accuracy on live listings. The workspace backtest scores the nightly market model, which the app does not serve; the served engine is `measures.engine_ablation`.

## What is the Adidas Yeezy Boost 350 V2 Zebra worth, and which sales does that rest on?

Status: COMPLETED

```sql
WITH p AS (  SELECT s.id FROM secondhand.measures.shown_prices s  WHERE s.metric = 'valuation.model.q50' AND lower(s.item) LIKE '%zebra%'  ORDER BY s.as_of DESC, s.id  LIMIT 1)
SELECT 'nightly market model, not the engine the app serves' AS priced_by, b.item, try_divide(b.value_cents,100.0) AS market_model_price_dollars, try_divide(b.lo_cents,100.0) AS low_dollars, try_divide(b.hi_cents,100.0) AS high_dollars,       try_divide(b.sold_cents,100.0) AS it_sold_for_dollars, b.basis_count, b.basis_level, b.as_of, b.data,       try_divide(b.basis_price_cents,100.0) AS earlier_sale_dollars, b.basis_at, b.basis_source, b.source_url, b.rebuilt_exactly
FROM secondhand.measures.price_basis b
JOIN p ON p.id = b.id
ORDER BY b.basis_at DESC
```

The Adidas Yeezy Boost 350 V2 Zebra was valued at **$337.97** by the nightly market model (not the app's engine), based on StockX sales data from February 2019. This price is rebuilt exactly from the following 5 sales it cites:
- **$338.00** on 2019-02-11
- **$349.00** on 2019-02-08
- **$348.00** on 2019-02-08
- **$306.50** on 2019-02-07
- **$345.00** on 2019-02-07

All cited sales are from the dataset:stockx_2019 and occurred within a five-day period.

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

On StockX sneaker sales (Off-White x Nike and Yeezy 350, 2017-09 to 2019-02), the engine the app serves matched the last sale within 20 percent on **96%** of sales, with a median error of **3.89%** and a range held the sale rate of **86%**. Compared to the 90-day median, it matched within 20 percent on **96%** of sales, with a median error of **3.89%** and a range held the sale rate of **86%**. The engine trailed the last sale by **1.0 percentage point** in the within-20-percent rate (interval: -1.4 to -0.7 points, 41,988 sales), but beat the 90-day median by **6.9 percentage points**.

## Which price engine does the app serve, and how does it compare with the last sale?

Status: COMPLETED

```sql
SELECT contestant AS engine_served, label, served, data, test_from, test_to, sales, ROUND(sales * priced) AS prices_given, within_20 AS within_20_percent, median_error, range_held AS range_held_the_sale, vs_last_sale_points, vs_last_sale_lo, vs_last_sale_hi, vs_last_sale_n
FROM secondhand.measures.engine_ablation
WHERE served = true
ORDER BY test_from DESC, test_to DESC, contestant
```

The app serves the **engine_all_on** price engine (label: Engine the app serves) using the **dataset:stockx_2019**. Compared to the last sale, this engine's within-20-percent rate is **1.0 percentage point lower** (vs_last_sale_points = -1.0) over **41,452** paired sales. The test period is from **2018-11-01** to **2019-02-13**.

## Which weight moved, and on what evidence?

Status: COMPLETED

```sql
WITH months_per_run AS (SELECT run_id, COUNT(DISTINCT month) AS months_tested FROM secondhand.measures.param_moves GROUP BY run_id) SELECT m.run_id, m.month, mp.months_tested, m.name, m.scope, m.action, m.version, m.value, m.held_out_score, m.champion_version, m.champion_score, m.diff, m.noise, m.reason, m.data FROM secondhand.measures.param_moves m LEFT JOIN months_per_run mp ON m.run_id = mp.run_id ORDER BY m.run_id, m.name, m.scope, m.month, CASE m.action WHEN 'rollback' THEN 0 WHEN 'propose' THEN 1 WHEN 'promote' THEN 2 WHEN 'hold' THEN 3 END, m.version
```

The **comps_half_life_days** weight moved, with actions including propose, promote, and hold. Evidence for these moves includes reasons such as "prior proposed," "past-three-month grid fit," "first champion," and "beat v1," all supported by centered paired bootstrap noise estimates and held-out scores. Examples include changes from value 90.0 to 7.0, with supporting held-out scores ranging from 0.991 to 0.994 and reasons detailing the statistical methods used.

Would you prefer to see the parameter moves ordered by the actual timestamp if available, or grouped differently by action type?

## How many sales did each source contribute, and under what rights?

Status: COMPLETED

```sql
SELECT f.source, f.bronze, f.dropped, f.kept, f.modelled,       r.may_model, r.may_model_scope, r.clause, r.clause_url
FROM secondhand.measures.pipeline_funnel f
LEFT JOIN secondhand.governance.source_rights r ON r.source = f.source
ORDER BY f.kept DESC
```

Each source contributed a different number of sales, with rights varying by source. Examples include:
- **mercari_kaggle**: 1,481,418 sales kept, rights limited to hackathon demo use under Kaggle competition rules
- **grailed_2021**: 103,525 sales kept, no modelling rights due to Grailed's terms
- **stockx_2019**: 99,956 sales kept, rights limited to hackathon demo use, no licence stated
- **goodwill_cc0**: 2,673 sales kept, no modelling rights due to ShopGoodwill's terms
- **ebay_comps_cc0**: 569 sales kept, no modelling rights, CC0 1.0
- **mercari_apify_ccby**: 462 sales kept, no modelling rights, CC BY 4.0

The largest contribution came from mercari_kaggle, while only mercari_kaggle and stockx_2019 allowed modelling for the hackathon demo.

## What is the median sold price among the earliest 10 StockX sales?

Status: COMPLETED

```sql
WITH s AS (
  SELECT c.price_cents, c.at FROM secondhand.market.comp c
  WHERE c.source = 'stockx_2019' AND c.price_type = 'sold'
  ORDER BY c.at ASC NULLS LAST, c.comp_id
  LIMIT 10)
SELECT count(*) AS n, min(at) AS first_at, max(at) AS last_at,
       CASE WHEN count(*) < 30 THEN concat('too few: ', count(*), ' sales') END AS refused,
       CASE WHEN count(*) >= 30 THEN try_divide(percentile_approx(price_cents, 0.5),100.0) END AS median_dollars
FROM s
```

There are **too few: 10 sales** among the earliest 10 StockX sales to provide a median sold price. A wider date range or including more sales would be needed to calculate this statistic.

## What is the median sold price of a Yeezy on Depop?

Status: COMPLETED

```sql
WITH s AS (
  SELECT price_cents, site
  FROM secondhand.market.comp
  WHERE brand = 'Yeezy' AND site ILIKE '%depop%' AND price_type = 'sold'
)
SELECT count(*) AS n,
       CASE WHEN count(*) < 30 THEN concat('too few: ', count(*), ' sales; try a wider date range or the parent kind') END AS refused,
       CASE WHEN count(*) >= 30 THEN try_divide(percentile_approx(price_cents, 0.5),100.0) END AS median_dollars,
       min(site) AS site
FROM s
```

There are **too few: 0 sales** of Yeezy on Depop to report a median sold price. To get a result, try a wider date range or include the parent kind.

Would you prefer to see the median sold price for Yeezy products on the exact site named 'Depop' only, instead of any site containing 'depop'?

## Which core tables are locked to their owner, and which columns are masked?

Status: COMPLETED

```sql
SELECT l.schema_name, l.table_name, l.has_owner_tag, l.masked_columns, l.retention_class, l.read_at
FROM secondhand.measures.locks_in_force l
WHERE l.schema_name = 'core'
ORDER BY l.table_name
```

All 11 core tables are locked to their owner. Only two tables have masked columns: the **decision** table masks "buyer_handle" and the **observation** table masks "seller_handle". The remaining tables do not have any masked columns.
