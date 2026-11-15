-- Run: node databricks/run-sql.mjs databricks/sql/09_guard.sql
CREATE OR REPLACE VIEW secondhand.measures.guard_violations
COMMENT 'The platform refuses CHECK on row-filtered tables, so the rule is checked here on every run.'
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

SELECT assert_true((SELECT count(*) FROM secondhand.measures.guard_violations) = 0, 'guard violations: see secondhand.measures.guard_violations') AS guard_ok;
