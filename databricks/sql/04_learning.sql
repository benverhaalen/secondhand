-- spec/databricks-build.md §§3,6,7. Public sold sets are labelled, never live reads.
CREATE SCHEMA IF NOT EXISTS secondhand.measures;

INSERT INTO secondhand.governance.principal_map
SELECT current_user(), 'usr_backtest'
WHERE NOT EXISTS (SELECT 1 FROM secondhand.governance.principal_map
                  WHERE principal = current_user() AND user_id = 'usr_backtest');

CREATE TABLE IF NOT EXISTS secondhand.measures.backtest_run (
  run_id STRING NOT NULL COMMENT 'Unique backtest execution id.',
  source STRING NOT NULL COMMENT 'Public sold source requested by the runner.',
  test_from TIMESTAMP NOT NULL COMMENT 'Inclusive start of scored sales.',
  test_to TIMESTAMP COMMENT 'Exclusive end; null means all remaining sales.',
  rows_hash STRING NOT NULL COMMENT 'SHA-256 of sorted normalized runner input rows.',
  code_sha STRING COMMENT 'Code revision supplied by SECONDHAND_CODE_SHA or SECONDHAND_BUILD; unknown if absent.',
  started_at TIMESTAMP NOT NULL COMMENT 'UTC execution start.',
  ended_at TIMESTAMP NOT NULL COMMENT 'UTC scoring completion.',
  n_tests BIGINT NOT NULL COMMENT 'Distinct scored test sales, not contestant estimates.',
  mlflow_run_id STRING NOT NULL COMMENT 'Tracking run in /Shared/secondhand/valuation-backtest.',
  report STRING NOT NULL COMMENT 'Scorer JSON with uncited_contestants counts and mapping notes.',
  sentence STRING COMMENT 'Scorer conclusion based on the paired lift interval.',
  data STRING NOT NULL COMMENT 'dataset:<source>, synthetic, or live:<site>; never unlabelled.'
) COMMENT 'One frozen valuation backtest execution and its evidence.';

CREATE TABLE IF NOT EXISTS secondhand.measures.backtest_headline (
  run_id STRING NOT NULL COMMENT 'Foreign key to backtest_run.',
  contestant STRING NOT NULL COMMENT 'Runner contestant name.',
  n BIGINT NOT NULL COMMENT 'Number of test sales.',
  priced BIGINT NOT NULL COMMENT 'Number of shown estimates.',
  hit_rate DOUBLE COMMENT 'Priced share of all tests.',
  within_20 DOUBLE COMMENT 'Within 20 percent of truth among shown estimates.',
  median_ape DOUBLE COMMENT 'Scorer overall.median_pct_off; null when unavailable.',
  coverage DOUBLE COMMENT 'Share of shown ranges containing truth.',
  bias DOUBLE COMMENT 'Median signed proportional error.',
  lift_vs_primary DOUBLE COMMENT 'Scorer lift_vs_primary.diff on shared items; null for primary.',
  data STRING NOT NULL COMMENT 'dataset:<source>, synthetic, or live:<site>.'
) COMMENT 'One headline per contestant and backtest run.';

CREATE TABLE IF NOT EXISTS secondhand.measures.backtest_estimate (
  run_id STRING NOT NULL COMMENT 'Foreign key to backtest_run.',
  contestant STRING NOT NULL COMMENT 'Runner contestant name.',
  item_id STRING NOT NULL COMMENT 'Test sale row_id.',
  as_of TIMESTAMP NOT NULL COMMENT 'Freeze date strictly after every basis comp.',
  freeze_basis STRING NOT NULL COMMENT 'Listed date or sale date proxy and optional window clamp.',
  q10_cents BIGINT COMMENT 'Rounded lower estimate, integer USD cents.',
  q50_cents BIGINT COMMENT 'Rounded middle estimate, integer USD cents.',
  q90_cents BIGINT COMMENT 'Rounded upper estimate, integer USD cents.',
  shown BOOLEAN NOT NULL COMMENT 'Original contestant display decision.',
  comp_ids ARRAY<STRING> NOT NULL COMMENT 'Basis row ids; empty for the current market model.',
  truth_cents BIGINT NOT NULL COMMENT 'Observed item sold price excluding buyer shipping, integer cents.',
  kind STRING COMMENT 'Test item kind.',
  site STRING COMMENT 'Test marketplace.',
  abs_pct_err DOUBLE COMMENT 'Absolute proportional error before rounding; null when hidden.',
  within_20 BOOLEAN COMMENT 'Error at most 0.2; null when hidden.',
  in_range BOOLEAN COMMENT 'Truth in original q10 to q90; null when hidden.',
  data STRING NOT NULL COMMENT 'dataset:<source>, synthetic, or live:<site>.'
) COMMENT 'Frozen contestant estimates and held-out sold truth.';

CREATE TABLE IF NOT EXISTS secondhand.measures.param_moves (
  run_id STRING NOT NULL COMMENT 'Unique walk execution id.',
  mlflow_run_id STRING NOT NULL COMMENT 'MLflow parent run for this walk.',
  month TIMESTAMP NOT NULL COMMENT 'UTC first day of held-out scoring month.',
  name STRING NOT NULL COMMENT 'Registry parameter name.',
  scope STRING NOT NULL COMMENT 'Canonical registry scope_key JSON.',
  action STRING NOT NULL COMMENT 'propose, promote, hold or rollback.',
  version INT NOT NULL COMMENT 'Version proposed, considered or restored.',
  value DOUBLE NOT NULL COMMENT 'Half-life days of this move version.',
  held_out_score DOUBLE COMMENT 'Move value within-20 rate on the current month.',
  champion_version INT NOT NULL COMMENT 'Champion in force immediately after this move.',
  champion_score DOUBLE COMMENT 'Incumbent within-20 rate on the same month, before this move.',
  diff DOUBLE COMMENT 'Move value score minus incumbent score on the same sales.',
  noise DOUBLE COMMENT '95th percentile absolute centered paired bootstrap error, 200 draws.',
  reason STRING NOT NULL COMMENT 'Registry verdict or next-month rollback explanation.',
  priced_share DOUBLE NOT NULL COMMENT 'Share of current-month sold tests with at least three earlier comps.',
  data STRING NOT NULL COMMENT 'dataset:<source>, synthetic, or live:<site>.'
) COMMENT 'Past-only fitting, held-out promotion decisions and the rollback watch.';

ALTER TABLE secondhand.core.param SET TBLPROPERTIES ('delta.enableChangeDataFeed' = 'true');

CREATE OR REPLACE VIEW secondhand.measures.valuation_accuracy AS
WITH latest AS (
  SELECT *, row_number() OVER (PARTITION BY source ORDER BY started_at DESC, run_id DESC) AS rank
  FROM secondhand.measures.backtest_run
), cells AS (
  SELECT r.source, e.run_id, e.contestant, e.kind, e.data,
    CASE WHEN NOT e.shown OR e.q50_cents IS NULL THEN 'not_priced'
         WHEN e.q50_cents < 2500 THEN 'under_25'
         WHEN e.q50_cents < 10000 THEN '25_to_100'
         WHEN e.q50_cents <= 50000 THEN '100_to_500'
         ELSE 'over_500' END AS price_band,
    count(*) AS n, count_if(e.shown) AS priced,
    avg(CASE WHEN e.shown THEN CAST(e.within_20 AS DOUBLE) END) AS within_20,
    percentile_approx(CASE WHEN e.shown THEN e.abs_pct_err END, 0.5) AS median_ape,
    avg(CASE WHEN e.shown THEN CAST(e.in_range AS DOUBLE) END) AS coverage
  FROM secondhand.measures.backtest_estimate e
  JOIN latest r ON e.run_id = r.run_id AND r.rank = 1
  GROUP BY r.source, e.run_id, e.contestant, e.kind, e.data,
    CASE WHEN NOT e.shown OR e.q50_cents IS NULL THEN 'not_priced'
         WHEN e.q50_cents < 2500 THEN 'under_25'
         WHEN e.q50_cents < 10000 THEN '25_to_100'
         WHEN e.q50_cents <= 50000 THEN '100_to_500'
         ELSE 'over_500' END
)
SELECT source, run_id, contestant, kind, price_band, data, n, priced,
  CASE WHEN priced >= 30 THEN within_20 END AS within_20,
  CASE WHEN priced >= 30 THEN median_ape END AS median_ape,
  CASE WHEN priced >= 30 THEN coverage END AS coverage,
  priced < 30 AS too_few
FROM cells;

CREATE OR REPLACE VIEW secondhand.measures.param_timeline AS
WITH terminal AS (
  SELECT *, row_number() OVER (
    PARTITION BY run_id, name, scope, month
    ORDER BY CASE action WHEN 'hold' THEN 4 WHEN 'promote' THEN 3 WHEN 'propose' THEN 2 ELSE 1 END DESC, version DESC
  ) AS rank
  FROM secondhand.measures.param_moves
)
SELECT m.*, CAST(p.value_or_hyperparams AS DOUBLE) AS champion_value,
       p.prior, p.family, p.fitted_on_ids_hash, p.n_eff,
       t.champion_version AS final_champion_version
FROM secondhand.measures.param_moves m
JOIN terminal t ON m.run_id = t.run_id AND m.name = t.name AND m.scope = t.scope AND m.month = t.month AND t.rank = 1
LEFT JOIN secondhand.core.param p ON p.name = t.name AND p.scope = t.scope AND p.version = t.champion_version;
