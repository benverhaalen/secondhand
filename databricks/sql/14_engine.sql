-- The engine the app serves, beside the baselines and the nightly market model, on the same test sales.
-- The workspace backtest (backtest_estimate, valuation_metrics) scores the nightly market model, which the app does not serve.
-- These rows are the engines lead's ablation of 2026-11-15, copied from spec/engines/valuation.md section 9
-- (the "all on" row is the served engine). Replace them only from a rerun of the same command on the same items.
-- Run by hand: node databricks/run-sql.mjs databricks/sql/14_engine.sql
CREATE OR REPLACE TABLE secondhand.measures.engine_ablation (
  contestant STRING,
  label STRING,
  served BOOLEAN,
  data STRING,
  test_from DATE,
  test_to DATE,
  sales BIGINT COMMENT 'held-out test sales scored',
  priced DOUBLE COMMENT 'share of the test sales this contestant priced, 0 to 1',
  median_error DOUBLE COMMENT 'median absolute error as a share of the sale price, 0 to 1',
  within_20 DOUBLE COMMENT 'share of priced sales within 20 percent of the sale price, 0 to 1',
  range_held DOUBLE COMMENT 'share of sales inside the 80 percent range, 0 to 1',
  width DOUBLE COMMENT 'median range width as a share of the middle price, 0 to 1',
  vs_last_sale_points DOUBLE COMMENT 'served engine within-20 rate minus the last sale within-20 rate, in percentage points, paired on the sales both priced; negative means it trails the last sale. Not a price difference',
  vs_last_sale_lo DOUBLE COMMENT 'lower end of the 95 percent interval of vs_last_sale_points, product-blocked bootstrap',
  vs_last_sale_hi DOUBLE COMMENT 'upper end of the 95 percent interval of vs_last_sale_points',
  vs_last_sale_n BIGINT COMMENT 'sales both the served engine and the last sale priced',
  reading STRING,
  source STRING
)
COMMENT 'Development reading on historical StockX 2019 public sales, not accuracy on live listings. served = true is the engine the app serves; market_model is the nightly model the workspace backtest scores, which the app does not serve.';

INSERT INTO secondhand.measures.engine_ablation VALUES
  ('engine_all_on', 'Engine the app serves', true, 'dataset:stockx_2019', DATE'2018-11-01', DATE'2019-02-13', 41988, 1.000, 0.0389, 0.960, 0.860, 0.227, -1.0, -1.4, -0.7, 41452,
   'development reading 2026-11-15', 'spec/engines/valuation.md section 9; jobs/valuation/ablate.py --calibrate-from 2018-09-01 --test-from 2018-11-01, branch w/eng-valuation-2'),
  ('engine_before', 'Engine before the ablation', false, 'dataset:stockx_2019', DATE'2018-11-01', DATE'2019-02-13', 41988, 0.991, 0.0625, 0.871, 0.857, 0.277, NULL, NULL, NULL, NULL,
   'development reading 2026-11-15', 'spec/engines/valuation.md section 9; jobs/valuation/ablate.py --calibrate-from 2018-09-01 --test-from 2018-11-01, branch w/eng-valuation-2'),
  ('last_sale', 'Last sale', false, 'dataset:stockx_2019', DATE'2018-11-01', DATE'2019-02-13', 41988, 0.987, 0.0325, 0.974, 0.798, 0.145, NULL, NULL, NULL, NULL,
   'development reading 2026-11-15', 'spec/engines/valuation.md section 9; jobs/valuation/ablate.py --calibrate-from 2018-09-01 --test-from 2018-11-01, branch w/eng-valuation-2'),
  ('product_90d_median', '90-day median', false, 'dataset:stockx_2019', DATE'2018-11-01', DATE'2019-02-13', 41988, 0.985, 0.0576, 0.891, 0.827, 0.272, NULL, NULL, NULL, NULL,
   'development reading 2026-11-15', 'spec/engines/valuation.md section 9; jobs/valuation/ablate.py --calibrate-from 2018-09-01 --test-from 2018-11-01, branch w/eng-valuation-2'),
  ('market_model', 'Market model (nightly, not served)', false, 'dataset:stockx_2019', DATE'2018-11-01', DATE'2019-02-13', 41988, 0.946, 0.0329, 0.985, 0.792, 0.136, NULL, NULL, NULL, NULL,
   'development reading 2026-11-15', 'spec/engines/valuation.md section 9; jobs/valuation/ablate.py --calibrate-from 2018-09-01 --test-from 2018-11-01, branch w/eng-valuation-2');
