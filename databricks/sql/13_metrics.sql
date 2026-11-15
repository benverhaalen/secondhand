-- The dashboard's semantic layer (spec/databricks-build.md section 8). Guarded like the app:
-- a rate is null when fewer than 30 estimates were shown in the cell (valuation_accuracy uses the same 30).
-- Create through the Statements API: the CLI's aitools query drops indented YAML lines.
CREATE OR REPLACE VIEW secondhand.measures.valuation_metrics
WITH METRICS
LANGUAGE YAML
COMMENT 'Backtest accuracy of our price and its baselines on the same held-out sales, latest run per source. Historical public sales, not accuracy on live data.'
AS $$
version: 1.1
comment: "Latest backtest per source. Every rate is null when fewer than 30 estimates were shown in the cell."
source: |
  SELECT e.*, r.source, r.test_from, r.n_tests
  FROM secondhand.measures.backtest_estimate e
  JOIN (
    SELECT run_id, source, test_from, n_tests,
           row_number() OVER (PARTITION BY source ORDER BY started_at DESC, run_id DESC) AS rank
    FROM secondhand.measures.backtest_run
  ) r ON r.run_id = e.run_id AND r.rank = 1
dimensions:
  - name: Price from
    expr: CASE contestant WHEN 'model' THEN 'Our price' WHEN 'last_sale' THEN 'Last sale' WHEN 'product_90d_median' THEN '90-day median' ELSE contestant END
    comment: "Who made the estimate: our model, or a baseline on the same sale."
    synonyms: [contestant, method, baseline]
  - name: Week
    expr: DATE_TRUNC('WEEK', as_of)
    comment: "Week of the estimate's freeze date."
  - name: Kind
    expr: kind
  - name: Dataset
    expr: data
    comment: "dataset:<source>; never live data."
measures:
  - name: Sales tested
    expr: COUNT(1)
  - name: Estimates shown
    expr: COUNT_IF(shown)
  - name: Within 20 percent
    expr: CASE WHEN COUNT_IF(shown) >= 30 THEN AVG(CASE WHEN shown THEN CAST(within_20 AS DOUBLE) END) END
    comment: "Share of shown estimates within 20 percent of the real sale price; null under 30 shown."
    format:
      type: percentage
  - name: Median error
    expr: CASE WHEN COUNT_IF(shown) >= 30 THEN PERCENTILE_APPROX(CASE WHEN shown THEN abs_pct_err END, 0.5) END
    comment: "Median distance from the real sale price, as a share of it; null under 30 shown."
    format:
      type: percentage
  - name: Range held the sale
    expr: CASE WHEN COUNT_IF(shown) >= 30 THEN AVG(CASE WHEN shown THEN CAST(in_range AS DOUBLE) END) END
    comment: "Share of shown ranges that contained the real sale price; null under 30 shown."
    format:
      type: percentage
$$
