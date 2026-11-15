-- spec/databricks-build.md sections 7–9; spec/engines/valuation.md section 9.
-- Run after the market pipeline and 01–09 with databricks/run-sql.mjs.
CREATE OR REPLACE VIEW secondhand.measures.pipeline_funnel
COMMENT 'Source mix: bronze, dropped, kept, modelled and excluded rows, with the dates of kept sales.'
AS
WITH b AS (
  SELECT source, count(*) bronze FROM secondhand.market.sold_raw GROUP BY source
), s AS (
  SELECT source, data, count(*) kept, count_if(may_model) modelled,
         min(at) first_at, max(at) last_at
  FROM secondhand.market.comp GROUP BY source, data
)
SELECT b.source, s.data, b.bronze, b.bronze - coalesce(s.kept, 0) AS dropped,
       coalesce(s.kept, 0) AS kept, coalesce(s.modelled, 0) AS modelled,
       coalesce(s.kept, 0) - coalesce(s.modelled, 0) AS excluded_from_models,
       s.first_at, s.last_at
FROM b LEFT JOIN s USING (source);

CREATE OR REPLACE VIEW secondhand.measures.param_history
COMMENT 'Parameter insertions and updated values from Delta CDF; preimages are excluded.'
AS
SELECT name, scope, version, status, value_or_hyperparams, held_out_score, moved_by,
       _change_type, _commit_version, _commit_timestamp
FROM table_changes('secondhand.core.param', 0)
WHERE _change_type IN ('insert', 'update_postimage');

CREATE OR REPLACE VIEW secondhand.measures.headline_latest
COMMENT 'Latest backtest per source, with dataset, tested families and test window attached to every contestant. Historical results only.'
AS
WITH latest AS (
  SELECT *, row_number() OVER (PARTITION BY source ORDER BY started_at DESC, run_id DESC) AS rank
  FROM secondhand.measures.backtest_run
), families AS (
  SELECT run_id, concat_ws(', ', sort_array(collect_set(kind))) AS families
  FROM secondhand.measures.backtest_estimate
  GROUP BY run_id
)
SELECT r.run_id, r.source, r.data, r.test_from, r.test_to, r.n_tests, r.started_at,
       f.families, h.contestant, h.n, h.priced, h.hit_rate, h.within_20,
       h.median_ape, h.coverage, h.bias, h.lift_vs_primary,
       concat('Backtest on ', r.source, ', ', coalesce(nullif(f.families, ''), 'families not recorded'),
              ', sales ', date_format(r.test_from, 'yyyy-MM-dd'), ' to ',
              coalesce(concat(date_format(r.test_to, 'yyyy-MM-dd'), ' (exclusive)'), 'open end'),
              '; not today''s market') AS claim
FROM latest r
JOIN secondhand.measures.backtest_headline h ON h.run_id = r.run_id
LEFT JOIN families f ON f.run_id = r.run_id
WHERE r.rank = 1;

-- Keep the correlated table function behind a measures view. Select five ids
-- before expanding their basis rows; the lead must validate LATERAL in the workspace.
CREATE OR REPLACE VIEW secondhand.measures.recent_why
COMMENT 'Recomputed proof for the five most recent shown numbers visible to the caller.'
AS
SELECT g.id, g.created_at, s.*
FROM (
  SELECT id, created_at FROM secondhand.core.guarded_number
  WHERE state = 'shown'
  ORDER BY created_at DESC, id DESC
  LIMIT 5
) g, LATERAL secondhand.measures.why_summary(g.id) s;

CREATE OR REPLACE VIEW secondhand.measures.break_glass_windows
COMMENT 'Maintenance window ids and times; principal identities and free-text reasons remain in governance.break_glass.'
AS
SELECT id, started_at, ended_at, ended_at IS NULL AS is_open
FROM secondhand.governance.break_glass;

CREATE OR REPLACE VIEW secondhand.measures.shown_prices
COMMENT 'Each shown valuation with the item it prices and the sales behind it; open one with measures.why(id). Caller row filters apply.'
AS
SELECT g.id, replace(t.title, '-', ' ') AS item, g.metric, g.value_cents, g.lo_cents, g.hi_cents,
       g.basis_count, g.basis_level, g.as_of, g.data, t.price_cents AS sold_cents, t.at AS sold_at
FROM secondhand.core.guarded_number g
JOIN secondhand.market.comp t ON t.comp_id = g.item_id
WHERE g.state = 'shown' AND g.metric LIKE 'valuation.%';

CREATE OR REPLACE VIEW secondhand.measures.price_basis
COMMENT 'Each shown valuation with every earlier sale it rests on and whether its basis hash rebuilt exactly (recompute_check). The rows behind measures.why(id), readable where table functions are not. Caller row filters apply.'
AS
SELECT g.id, replace(t.title, '-', ' ') AS item, g.metric, g.value_cents, g.lo_cents, g.hi_cents,
       g.basis_count, g.basis_level, g.as_of, g.data, t.price_cents AS sold_cents,
       b.basis_id, s.price_cents AS basis_price_cents, s.at AS basis_at, s.source AS basis_source,
       s.url_ref AS source_url, s.may_model, s.may_show, r.equal AS rebuilt_exactly
FROM secondhand.core.guarded_number g
JOIN (SELECT id, basis_id FROM secondhand.core.citation LATERAL VIEW explode(basis_ids) e AS basis_id) b ON b.id = g.citation_id
JOIN secondhand.market.comp t ON t.comp_id = g.item_id
LEFT JOIN secondhand.market.comp s ON s.comp_id = b.basis_id
LEFT JOIN secondhand.measures.recompute_check r ON r.citation_id = g.citation_id
WHERE g.state = 'shown' AND g.metric LIKE 'valuation.%';
