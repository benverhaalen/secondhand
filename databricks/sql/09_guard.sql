-- Run: node databricks/run-sql.mjs databricks/sql/09_guard.sql
CREATE TABLE IF NOT EXISTS secondhand.measures.guard_refusals (
  refused_at TIMESTAMP NOT NULL COMMENT 'When the door refused the batch, before its destination write.',
  job STRING NOT NULL COMMENT 'Job whose batch was refused.',
  table_name STRING NOT NULL COMMENT 'Destination core table, without catalog or schema.',
  row_id STRING COMMENT 'Rejected id, or session:seq for log_event.',
  rule STRING NOT NULL COMMENT 'Rule name from databricks/guard.py.',
  data STRING COMMENT 'Writer provenance of the refused row, never its contents.'
) COMMENT 'Rows caught at the door. One row per violation, and the refused batch writes nothing to its destination.';

CREATE OR REPLACE VIEW secondhand.measures.guard_violations
COMMENT 'Rows written past the door, caught by the nightly net. guard_refusals records rows caught at the door. CHECK is unsupported on row-filtered tables. Rule names are owned by databricks/guard.py and checked for parity.'
AS
SELECT 'guarded_number' AS table_name, id AS row_id, 'guarded_number_state' AS rule, data
FROM secondhand.core.guarded_number
WHERE state NOT IN ('shown','hidden','not_found')
UNION ALL
SELECT 'guarded_number' AS table_name, id AS row_id, 'guarded_number_shown_citation' AS rule, data
FROM secondhand.core.guarded_number
WHERE state = 'shown' AND citation_id IS NULL
UNION ALL
SELECT 'guarded_number' AS table_name, id AS row_id, 'guarded_number_hidden_reason' AS rule, data
FROM secondhand.core.guarded_number
WHERE state = 'hidden' AND hide_reason IS NULL
UNION ALL
SELECT 'guarded_number' AS table_name, id AS row_id, 'guarded_number_citation_fk' AS rule, data
FROM secondhand.core.guarded_number g
WHERE g.state = 'shown' AND g.citation_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM secondhand.core.citation c WHERE c.id = g.citation_id)
UNION ALL
SELECT 'guarded_number' AS table_name, id AS row_id, 'guarded_number_basis_level' AS rule, data
FROM secondhand.core.guarded_number
WHERE metric LIKE 'valuation.%' AND (basis_level IS NULL OR basis_level NOT IN ('variant','product','family','kind','prior'))
UNION ALL
SELECT 'claim_check' AS table_name, id AS row_id, 'claim_check_verdict' AS rule, data
FROM secondhand.core.claim_check
WHERE verdict NOT IN ('pass','hold','abstain','contradicted')
UNION ALL
SELECT 'decision' AS table_name, id AS row_id, 'decision_policy_mode' AS rule, data
FROM secondhand.core.decision
WHERE policy_mode NOT IN ('auto','ask','locked','never')
UNION ALL
SELECT 'observation' AS table_name, id AS row_id, 'observation_data' AS rule, data
FROM secondhand.core.observation
WHERE data NOT RLIKE '^(synthetic|example|dataset:.+|live:.+)$'
UNION ALL
SELECT 'evidence' AS table_name, id AS row_id, 'evidence_data' AS rule, data
FROM secondhand.core.evidence
WHERE data NOT RLIKE '^(synthetic|example|dataset:.+|live:.+)$'
UNION ALL
SELECT 'citation' AS table_name, id AS row_id, 'citation_data' AS rule, data
FROM secondhand.core.citation
WHERE data NOT RLIKE '^(synthetic|example|dataset:.+|live:.+)$'
UNION ALL
SELECT 'guarded_number' AS table_name, id AS row_id, 'guarded_number_data' AS rule, data
FROM secondhand.core.guarded_number
WHERE data NOT RLIKE '^(synthetic|example|dataset:.+|live:.+)$'
UNION ALL
SELECT 'claim_check' AS table_name, id AS row_id, 'claim_check_data' AS rule, data
FROM secondhand.core.claim_check
WHERE data NOT RLIKE '^(synthetic|example|dataset:.+|live:.+)$'
UNION ALL
SELECT 'event' AS table_name, id AS row_id, 'event_data' AS rule, data
FROM secondhand.core.event
WHERE data NOT RLIKE '^(synthetic|example|dataset:.+|live:.+)$'
UNION ALL
SELECT 'job' AS table_name, id AS row_id, 'job_data' AS rule, data
FROM secondhand.core.job
WHERE data NOT RLIKE '^(synthetic|example|dataset:.+|live:.+)$'
UNION ALL
SELECT 'decision' AS table_name, id AS row_id, 'decision_data' AS rule, data
FROM secondhand.core.decision
WHERE data NOT RLIKE '^(synthetic|example|dataset:.+|live:.+)$'
UNION ALL
SELECT 'storefront_snapshot' AS table_name, id AS row_id, 'storefront_snapshot_data' AS rule, data
FROM secondhand.core.storefront_snapshot
WHERE data NOT RLIKE '^(synthetic|example|dataset:.+|live:.+)$'
UNION ALL
SELECT 'log_event' AS table_name, concat(session, ':', cast(seq AS STRING)) AS row_id, 'log_event_data' AS rule, data
FROM secondhand.core.log_event
WHERE data NOT RLIKE '^(synthetic|example|dataset:.+|live:.+)$';

CREATE OR REPLACE VIEW secondhand.measures.guard_status
COMMENT 'Guard tile and alert: rows past the door now, refusals at the door in seven days, query time and the rule names.'
AS
SELECT (SELECT count(*) FROM secondhand.measures.guard_violations) AS violations_now,
       (SELECT count(*) FROM secondhand.measures.guard_refusals WHERE refused_at >= current_timestamp() - INTERVAL 7 DAYS) AS refusals_last_7_days,
       current_timestamp() AS last_checked_at,
       array('guarded_number_state', 'guarded_number_shown_citation', 'guarded_number_hidden_reason',
             'guarded_number_citation_fk', 'guarded_number_basis_level', 'claim_check_verdict', 'decision_policy_mode',
             'observation_data', 'evidence_data', 'citation_data', 'guarded_number_data', 'claim_check_data',
             'event_data', 'job_data', 'decision_data', 'storefront_snapshot_data', 'log_event_data') AS rules;

SELECT assert_true((SELECT count(*) FROM secondhand.measures.guard_violations) = 0, 'guard violations: see secondhand.measures.guard_violations') AS guard_ok;
