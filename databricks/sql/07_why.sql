-- Per-number row lineage (spec/databricks-build.md section 7; sweep row 3).
-- Run: node databricks/run-sql.mjs databricks/sql/07_why.sql

-- The operator running setup reads system-written and backtest rows, never another person's.
INSERT INTO secondhand.governance.principal_map SELECT current_user(), u FROM (VALUES ('system'), ('usr_backtest')) v(u) WHERE NOT EXISTS (SELECT 1 FROM secondhand.governance.principal_map m WHERE m.principal = current_user() AND m.user_id = v.u);

SET TIME ZONE 'UTC';

CREATE OR REPLACE FUNCTION secondhand.measures.why(number_id STRING)
RETURNS TABLE (
  number_id STRING, metric STRING, value_cents BIGINT, state STRING, hide_reason STRING,
  citation_id STRING, basis_id STRING, basis_price_cents BIGINT, basis_source STRING,
  source_url STRING, source_sha256 STRING, may_model BOOLEAN, may_show BOOLEAN,
  stored_hash STRING, recomputed_hash STRING, equal BOOLEAN, reason STRING
)
COMMENT 'Each basis row behind a guarded number, with source evidence and rights. Market comp ids take precedence over observation ids. Recomputes proof.ts canonical JSON in id order with UTC millisecond timestamps and weight 1: citations do not store weights yet. A citation metric containing weighted returns equal=null with reason weights not stored. Missing rows or timestamps and values needing JSON escaping return a null recomputed hash, equal=false and a reason. Caller row filters apply.'
RETURN
WITH expected AS (
  SELECT g.id AS number_id, g.metric, g.value_cents, g.state, g.hide_reason,
         g.citation_id, c.basis_hash AS stored_hash, lower(c.metric) LIKE '%weighted%' AS weighted,
         explode(c.basis_ids) AS basis_id
  FROM secondhand.core.guarded_number g
  JOIN secondhand.core.citation c ON c.id = g.citation_id
  WHERE g.id = why.number_id
), basis AS (
  SELECT b.*,
         CASE WHEN m.comp_id IS NOT NULL THEN m.comp_id ELSE o.id END AS id,
         CASE WHEN m.comp_id IS NOT NULL THEN m.price_cents ELSE o.price_cents END AS price_cents,
         CASE WHEN m.comp_id IS NOT NULL THEN m.source ELSE o.site END AS basis_source,
         date_format(CASE WHEN m.comp_id IS NOT NULL THEN m.at ELSE o.observed_at END, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'") AS a,
         CASE WHEN m.comp_id IS NOT NULL THEN m.url_ref ELSE e.source_url END AS source_url,
         CASE WHEN m.comp_id IS NOT NULL THEN m.source_sha256 ELSE e.fingerprint END AS source_sha256,
         CASE WHEN m.comp_id IS NOT NULL THEN m.may_model ELSE e.may_model END AS may_model,
         CASE WHEN m.comp_id IS NOT NULL THEN m.may_show ELSE e.may_show END AS may_show
  FROM expected b
  LEFT JOIN secondhand.market.comp m ON m.comp_id = b.basis_id
  LEFT JOIN secondhand.core.observation o ON m.comp_id IS NULL AND o.id = b.basis_id
  LEFT JOIN secondhand.core.evidence e ON e.id = o.evidence_id
), lines AS (
  SELECT *, concat('{"at":"', a, '","id":"', id, '","price_cents":', coalesce(cast(price_cents AS STRING), 'null'), ',"source":"', basis_source, '","weight":1}') AS line
  FROM basis
), aggregate_basis AS (
  SELECT sha2(concat('[', array_join(transform(array_sort(collect_list(named_struct('id', id, 'line', line))), r -> r.line), ','), ']'), 256) AS digest,
         bool_or(weighted) AS weighted,
         count_if(id IS NULL) AS missing_basis,
         count_if(a IS NULL) AS missing_at,
         count_if(basis_source IS NULL) AS missing_source,
         count_if(instr(id, '"') > 0 OR instr(id, chr(92)) > 0
               OR instr(basis_source, '"') > 0 OR instr(basis_source, chr(92)) > 0
               OR instr(a, '"') > 0 OR instr(a, chr(92)) > 0) AS needs_escaping
  FROM lines
), validation AS (
  SELECT digest, CASE WHEN weighted THEN 'weights not stored'
                     WHEN missing_basis > 0 THEN 'missing basis rows'
                     WHEN missing_at > 0 THEN 'missing timestamp'
                     WHEN missing_source > 0 THEN 'missing source'
                     WHEN needs_escaping > 0 THEN 'needs json escaping' END AS reason
  FROM aggregate_basis
), hashes AS (
  SELECT CASE WHEN reason IS NULL THEN digest END AS recomputed_hash, reason
  FROM validation
)
SELECT b.number_id, b.metric, b.value_cents, b.state, b.hide_reason, b.citation_id,
       b.basis_id, b.price_cents AS basis_price_cents, b.basis_source, b.source_url,
       b.source_sha256, b.may_model, b.may_show, b.stored_hash, h.recomputed_hash,
       CASE WHEN h.reason = 'weights not stored' THEN CAST(NULL AS BOOLEAN)
            WHEN h.reason IS NOT NULL THEN false
            ELSE coalesce(b.stored_hash = h.recomputed_hash, false) END AS equal,
       coalesce(h.reason, CASE WHEN b.stored_hash <> h.recomputed_hash THEN 'hash mismatch' END) AS reason
FROM basis b CROSS JOIN hashes h;

CREATE OR REPLACE FUNCTION secondhand.measures.why_summary(number_id STRING)
RETURNS TABLE (number_id STRING, basis_count BIGINT, missing_basis BIGINT, equal BOOLEAN)
COMMENT 'One summary row for a guarded number: expected basis rows, unresolved ids and whole-basis hash equality. Unsupported weights preserve equal=null. An unknown number or an empty basis returns zero counts and equal=false.'
RETURN
SELECT why_summary.number_id AS number_id, count(*) AS basis_count,
       count_if(m.comp_id IS NULL AND o.id IS NULL) AS missing_basis,
       CASE WHEN count(*) = 0 THEN false ELSE bool_and(w.equal) END AS equal
FROM secondhand.measures.why(why_summary.number_id) w
LEFT JOIN secondhand.market.comp m ON m.comp_id = w.basis_id
LEFT JOIN secondhand.core.observation o ON m.comp_id IS NULL AND o.id = w.basis_id;
