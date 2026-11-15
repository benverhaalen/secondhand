-- DRAFTED 2026-11-15 by the fourth Databricks lead, NOT YET RUN (finalization.md DB9; databricks/RETAIL.md).
-- Additive only: a new schema with views over our existing tables. No existing table, view, job, alert,
-- dashboard or Genie space changes. Before running: load the databricks-dbsql and databricks-ai-functions skills,
-- confirm the ai_forecast arguments there, run each statement alone with node databricks/run-sql.mjs, read its
-- output, stop the warehouse, record the spend.
-- Entity and column names follow the Open Retail Data Model (Apache-2.0,
-- github.com/databricks-industry-solutions/open-retail-data-model: canonical-core/product/tables/product.sql,
-- canonical-core/transaction/tables/sales.sql, read 2026-11-15). Resale additions are named columns at the end.

CREATE SCHEMA IF NOT EXISTS secondhand.retail COMMENT 'Our resale data under the Open Retail Data Model entity names (Apache-2.0), with what resale adds: condition, the marketplace, and the rights on every row. Views only.';

CREATE OR REPLACE VIEW secondhand.retail.product
COMMENT 'ORDM product, from secondhand.market.product (public comps). One row per product; resale adds kind, how many sales and listings back it, and the sources it rests on.'
AS SELECT p.product_id, CAST(NULL AS STRING) AS gtin, CAST(NULL AS STRING) AS sku,
          CAST(NULL AS STRING) AS style_id, get_json_object(p.spec, '$.size') AS size,
          p.brand, p.category, CAST(NULL AS STRING) AS subcategory, 'each' AS unit_of_measure, 'USD' AS currency_code,
          p.kind, get_json_object(p.spec, '$.era') AS era, p.n_rows, p.n_sold, p.first_at, p.last_at, p.sources
FROM secondhand.market.product p;

CREATE OR REPLACE VIEW secondhand.retail.sales
COMMENT 'ORDM sales, one row per sold comp. store_id is the marketplace; units is 1 (one-of-one items); revenue is the sale price in dollars without buyer shipping. Resale adds condition, marketplace and the row and source rights, so a reader can tell what it may model or show.'
AS SELECT c.row_id AS sales_id, date(c.at) AS date_key, c.product_id, c.site AS store_id, 'NO_PROMO' AS promo_id,
          1 AS units, CAST(c.price_cents / 100.0 AS DECIMAL(18,2)) AS gross_revenue, CAST(0 AS DECIMAL(18,2)) AS discount_amount,
          CAST(c.price_cents / 100.0 AS DECIMAL(18,2)) AS net_revenue, 'USD' AS currency_code, c.data AS record_source,
          c.condition, c.site AS marketplace, c.kind, c.source, c.licence,
          c.may_model, c.may_show, c.may_store, c.may_share, r.may_model_scope AS use_scope
FROM secondhand.market.comp c
LEFT JOIN secondhand.governance.source_rights r ON r.source = c.source
WHERE c.price_type = 'sold';

-- The forecast. Read before showing anyone: the dates are historical (StockX 2017 to 2019), so the horizon is
-- weeks past that data's last day, not today. It forecasts the daily median sale price by kind on one dataset;
-- check that every forecast row is positive and inside the observed min and max before it is shown.
-- If ai_forecast refuses a subquery for horizon, read max(day) first and write that date plus 28 days as a literal.
CREATE OR REPLACE VIEW secondhand.retail.sales_price_forecast
COMMENT 'ai_forecast of the daily median sale price by kind, on historical StockX 2019 public sales (dataset:stockx_2019). A development reading over past dates, never a current price or a claim about live listings.'
AS SELECT * FROM ai_forecast(
  TABLE(SELECT day, kind, median_cents FROM secondhand.market.comp_daily
        WHERE source = 'stockx_2019' AND price_type = 'sold' AND day IS NOT NULL),
  horizon => (SELECT date_add(max(day), 28) FROM secondhand.market.comp_daily WHERE source = 'stockx_2019' AND price_type = 'sold'),
  time_col => 'day', value_col => 'median_cents', group_col => 'kind');
