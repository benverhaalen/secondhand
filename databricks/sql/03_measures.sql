-- spec/databricks-build.md §§3–5,7: stored checks and the views opened by the proof dashboard.
CREATE TABLE IF NOT EXISTS secondhand.measures.term_list (
  kind STRING COMMENT 'Source kind shared by the counted rows.',
  term STRING COMMENT 'Distinct title word per source row; null for a brand count.',
  brand STRING COMMENT 'Normalised source brand; null for a title-word count.',
  n_rows BIGINT COMMENT 'Source rows containing this word or brand within this kind.',
  n_brands BIGINT COMMENT 'Distinct known brands for a word; one for a brand count.'
) COMMENT 'DB20 Mercari competition word lists and structure only; never a current-price claim. Counts below market_min_n are omitted.';

CREATE TABLE IF NOT EXISTS secondhand.measures.recompute_check (
  citation_id STRING COMMENT 'The core.citation row checked.',
  metric STRING COMMENT 'The number definition named by the citation.',
  basis_count INT COMMENT 'Number of basis ids stored on the citation, including missing rows.',
  stored_hash STRING COMMENT 'The citation basis_hash at read time.',
  recomputed_hash STRING COMMENT 'SHA-256 of the surviving basis id:price_cents lines, in UTF-16 order.',
  missing_ids ARRAY<STRING> COMMENT 'Basis ids absent from market.comp; any missing id forces unequal.',
  equal BOOLEAN COMMENT 'True only when no basis id is missing and the hashes match.',
  checked_at TIMESTAMP COMMENT 'UTC time of this recomputation.',
  code_sha STRING COMMENT 'SECONDHAND_BUILD, or dev for an unversioned run.'
) COMMENT 'Latest full recomputation of every stored citation against market.comp.';

CREATE TABLE IF NOT EXISTS secondhand.measures.parity_check (
  engine STRING COMMENT 'Engine whose Python twin was checked.',
  case STRING COMMENT 'Unique fixture case name within the engine.',
  ts_value STRING COMMENT 'Committed TypeScript result as JSON.',
  py_value STRING COMMENT 'Workspace Python result as JSON.',
  equal BOOLEAN COMMENT 'Exact strings and integers; floats compared after rounding to six places.',
  code_sha STRING COMMENT 'SECONDHAND_BUILD, or dev for an unversioned run.',
  checked_at TIMESTAMP COMMENT 'UTC comparison time.'
) COMMENT 'Latest cross-language parity results from committed fixtures and TypeScript outputs.';

CREATE TABLE IF NOT EXISTS secondhand.measures.load_report (
  file STRING COMMENT 'Volume path of the input JSONL file.',
  lines BIGINT COMMENT 'All input lines, including malformed and blank lines.',
  loaded BIGINT COMMENT 'Valid lines written to core.log_event.',
  rejected BIGINT COMMENT 'Invalid lines skipped with a reason; lines equals loaded plus rejected.',
  reasons STRING COMMENT 'JSON object of rejection reason to count; individual line numbers appear in the job log.'
) COMMENT 'Latest log load counts, one row per input file.';

CREATE OR REPLACE VIEW secondhand.measures.citation_coverage
COMMENT 'Per metric, shown numbers, shown numbers with citations, and their share; null when none are shown.' AS
SELECT metric, data,
       count_if(state = 'shown') AS shown_numbers,
       count_if(state = 'shown' AND citation_id IS NOT NULL AND length(trim(citation_id)) > 0) AS shown_with_citation,
       count_if(state = 'shown' AND citation_id IS NOT NULL AND length(trim(citation_id)) > 0)
         / nullif(count_if(state = 'shown'), 0) AS share
FROM secondhand.core.guarded_number
GROUP BY metric, data;

CREATE OR REPLACE VIEW secondhand.measures.hidden_numbers
COMMENT 'Hidden numbers grouped by metric and the reason the proof guard hid them.' AS
SELECT metric, hide_reason, data, count(*) AS count
FROM secondhand.core.guarded_number
WHERE state = 'hidden'
GROUP BY metric, hide_reason, data;

CREATE OR REPLACE VIEW secondhand.measures.decisions_by_policy
COMMENT 'Answered decisions counted by kind, policy mode and actor, including held and never actions.' AS
SELECT kind, policy_mode, actor, data, count(*) AS count
FROM secondhand.core.decision
GROUP BY kind, policy_mode, actor, data;

CREATE OR REPLACE VIEW secondhand.measures.never_automated
COMMENT 'Every never decision with its stored allow flag; allow true is a policy violation.' AS
SELECT id, kind, action, actor, site, policy_mode, data,
       cast(get_json_object(policy_result, '$.allow') AS BOOLEAN) AS allow,
       policy_version, why, created_at
FROM secondhand.core.decision
WHERE policy_mode = 'never';

-- Metadata column names measured on the workspace, 2026-11-15.
-- Direct assignments and policy-matching tags are reported separately as well as combined.
CREATE OR REPLACE VIEW secondhand.measures.governance_coverage
COMMENT 'Visible tables with direct filter and mask counts, coverage including catalog-policy tags, and all tags; metadata visibility follows caller grants.' AS
WITH filters AS (
  SELECT table_catalog AS catalog_name, table_schema AS schema_name, table_name, count(*) AS filter_count
  FROM secondhand.information_schema.row_filters
  GROUP BY table_catalog, table_schema, table_name
), masks AS (
  SELECT table_catalog AS catalog_name, table_schema AS schema_name, table_name, count(DISTINCT column_name) AS masked_columns
  FROM secondhand.information_schema.column_masks
  GROUP BY table_catalog, table_schema, table_name
), mask_columns AS (
  SELECT table_catalog AS catalog_name, table_schema AS schema_name, table_name, column_name
  FROM secondhand.information_schema.column_masks
  UNION
  SELECT catalog_name, schema_name, table_name, column_name
  FROM secondhand.information_schema.column_tags
  WHERE tag_name = 'sh_personal' AND tag_value = 'handle'
), covered_masks AS (
  SELECT catalog_name, schema_name, table_name, count(DISTINCT column_name) AS masked_columns
  FROM mask_columns
  GROUP BY catalog_name, schema_name, table_name
), owner_tags AS (
  SELECT catalog_name, schema_name, table_name, count(*) AS owner_tags
  FROM secondhand.information_schema.column_tags
  WHERE column_name = 'user_id' AND tag_name = 'sh_owner' AND tag_value = 'user_id'
  GROUP BY catalog_name, schema_name, table_name
), tag_rows AS (
  SELECT catalog_name, schema_name, table_name, concat('table:', tag_name, '=', tag_value) AS tag
  FROM secondhand.information_schema.table_tags
  UNION ALL
  SELECT catalog_name, schema_name, table_name, concat('column:', column_name, ':', tag_name, '=', tag_value) AS tag
  FROM secondhand.information_schema.column_tags
), tags AS (
  SELECT catalog_name, schema_name, table_name, sort_array(collect_set(tag)) AS tags
  FROM tag_rows
  GROUP BY catalog_name, schema_name, table_name
)
SELECT t.table_catalog, t.table_schema, t.table_name, t.table_type,
       coalesce(f.filter_count, 0) > 0 OR coalesce(o.owner_tags, 0) > 0 AS has_row_filter,
       coalesce(c.masked_columns, 0) AS masked_columns,
       coalesce(f.filter_count, 0) AS direct_filter_count,
       coalesce(m.masked_columns, 0) AS direct_masked_columns,
       coalesce(o.owner_tags, 0) > 0 AS has_owner_tag,
       coalesce(g.tags, cast(array() AS ARRAY<STRING>)) AS tags
FROM secondhand.information_schema.tables t
LEFT JOIN filters f ON t.table_catalog = f.catalog_name AND t.table_schema = f.schema_name AND t.table_name = f.table_name
LEFT JOIN masks m ON t.table_catalog = m.catalog_name AND t.table_schema = m.schema_name AND t.table_name = m.table_name
LEFT JOIN covered_masks c ON t.table_catalog = c.catalog_name AND t.table_schema = c.schema_name AND t.table_name = c.table_name
LEFT JOIN owner_tags o ON t.table_catalog = o.catalog_name AND t.table_schema = o.schema_name AND t.table_name = o.table_name
LEFT JOIN tags g ON t.table_catalog = g.catalog_name AND t.table_schema = g.schema_name AND t.table_name = g.table_name
WHERE t.table_catalog = 'secondhand' AND t.table_schema IN ('core', 'market', 'measures');
