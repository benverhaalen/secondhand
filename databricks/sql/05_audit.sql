-- Dashboard evidence for spec/databricks-build.md section 7. Run after market.comp exists.
-- Run: node databricks/run-sql.mjs databricks/sql/05_audit.sql

CREATE OR REPLACE VIEW secondhand.measures.rights_audit
COMMENT 'Citation basis violations: forbidden market comps, forbidden observation evidence, or frozen datasets used for current prices.'
AS
WITH basis AS (
  SELECT c.id AS citation_id, c.metric, explode(c.basis_ids) AS comp_id
  FROM secondhand.core.citation c
)
SELECT DISTINCT b.citation_id, b.metric, m.comp_id, m.source, 'market_comp' AS basis
FROM basis b
JOIN secondhand.market.comp m ON b.comp_id = m.comp_id
WHERE m.may_model = false
UNION ALL
SELECT DISTINCT b.citation_id, b.metric, o.id AS comp_id, o.site AS source, 'observation' AS basis
FROM basis b
JOIN secondhand.core.observation o ON b.comp_id = o.id
JOIN secondhand.core.evidence e ON o.evidence_id = e.id
WHERE e.may_model = false
UNION ALL
-- Live asking and sold series: spec/determinations/market-insight.md M3.
-- Metric names: databricks/load/load.mjs numbers(), no exact-name list in spec/.
SELECT DISTINCT b.citation_id, b.metric, d.comp_id, d.source, 'dataset_in_current_metric' AS basis
FROM basis b
JOIN (
  SELECT comp_id, source FROM secondhand.market.comp WHERE data LIKE 'dataset:%'
  UNION
  SELECT id AS comp_id, site AS source FROM secondhand.core.observation WHERE data LIKE 'dataset:%'
) d ON b.comp_id = d.comp_id
WHERE b.metric IN ('asking_p50_cents', 'sold_p50_cents');

CREATE OR REPLACE VIEW secondhand.measures.rights_audit_summary
COMMENT 'Citations and exploded basis rows checked. Total violations include market-comp rights, observation evidence rights and frozen datasets in current-price metrics.'
AS
SELECT
  (SELECT count(*) FROM secondhand.core.citation) AS citations_checked,
  (SELECT count(*) FROM (SELECT explode(c.basis_ids) AS comp_id FROM secondhand.core.citation c) basis) AS basis_rows_checked,
  (SELECT count(*) FROM secondhand.measures.rights_audit) AS violations,
  (SELECT count(*) FROM secondhand.measures.rights_audit WHERE basis = 'observation') AS observation_violations,
  (SELECT count(*) FROM secondhand.measures.rights_audit WHERE basis = 'dataset_in_current_metric') AS dataset_current_violations;

CREATE OR REPLACE VIEW secondhand.measures.lineage_edges
COMMENT 'Unity Catalog table lineage touching secondhand, with the latest observation of each directed edge. Citation basis_ids supply row lineage.'
AS
SELECT source_table_full_name, target_table_full_name, entity_type, max(event_time) AS last_seen
FROM system.access.table_lineage
WHERE source_table_full_name LIKE 'secondhand.%' OR target_table_full_name LIKE 'secondhand.%'
GROUP BY source_table_full_name, target_table_full_name, entity_type;

CREATE OR REPLACE VIEW secondhand.measures.audit_activity
COMMENT 'Audit event counts touching secondhand over the last 30 days. Identity is only whether the event belongs to the current reader.'
AS
SELECT event_date, action_name, service_name, (user_identity.email = current_user()) AS is_me, count(*) AS events
FROM system.access.audit
WHERE event_date >= date_sub(current_date(), 30)
  AND exists(map_values(request_params), value -> value LIKE '%secondhand.%')
GROUP BY event_date, action_name, service_name, (user_identity.email = current_user());

CREATE OR REPLACE VIEW secondhand.measures.policies_in_force
COMMENT 'Core table tag coverage: owner tag, handle-mask columns, retention and rights. Tags describe policy matches, not proof that an ABAC policy is installed.'
AS
WITH columns AS (
  SELECT catalog_name, schema_name, table_name,
    max(CASE WHEN column_name = 'user_id' AND tag_name = 'sh_owner' AND tag_value = 'user_id' THEN 1 ELSE 0 END) = 1 AS has_owner_tag,
    sort_array(collect_set(CASE WHEN tag_name = 'sh_personal' AND tag_value = 'handle' THEN column_name END)) AS masked_columns
  FROM secondhand.information_schema.column_tags
  WHERE catalog_name = 'secondhand' AND schema_name = 'core'
  GROUP BY catalog_name, schema_name, table_name
), tables AS (
  SELECT catalog_name, schema_name, table_name,
    max(CASE WHEN tag_name = 'retention_class' THEN tag_value END) AS retention_class,
    max(CASE WHEN tag_name = 'rights_mode' THEN tag_value END) AS rights_mode
  FROM secondhand.information_schema.table_tags
  WHERE catalog_name = 'secondhand' AND schema_name = 'core'
  GROUP BY catalog_name, schema_name, table_name
)
SELECT t.table_catalog AS catalog_name, t.table_schema AS schema_name, t.table_name,
  coalesce(c.has_owner_tag, false) AS has_owner_tag,
  coalesce(c.masked_columns, CAST(array() AS ARRAY<STRING>)) AS masked_columns,
  g.retention_class, g.rights_mode
FROM secondhand.information_schema.tables t
LEFT JOIN columns c ON t.table_catalog = c.catalog_name AND t.table_schema = c.schema_name AND t.table_name = c.table_name
LEFT JOIN tables g ON t.table_catalog = g.catalog_name AND t.table_schema = g.schema_name AND t.table_name = g.table_name
WHERE t.table_catalog = 'secondhand' AND t.table_schema = 'core' AND t.table_type <> 'VIEW';

-- Lead: discover whether this workspace exposes ABAC policy metadata before relying on it.
-- SELECT table_name FROM secondhand.information_schema.tables WHERE table_schema = 'information_schema' AND lower(table_name) LIKE '%polic%'
