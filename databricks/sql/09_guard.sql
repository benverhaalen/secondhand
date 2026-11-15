-- Run through tasks/guard_job.py; migrate_data.guard_setup_plan skips the existing column.
ALTER TABLE secondhand.governance.break_glass ADD COLUMNS (reason_closed STRING);
CREATE TABLE IF NOT EXISTS secondhand.measures.guard_refusals (
  refused_at TIMESTAMP NOT NULL COMMENT 'When the door refused the batch, before its destination write.',
  job STRING NOT NULL COMMENT 'Job whose batch was refused.',
  table_name STRING NOT NULL COMMENT 'Destination core table, without catalog or schema.',
  row_id STRING COMMENT 'Rejected id, or session:seq for log_event.',
  rule STRING NOT NULL COMMENT 'Rule name from databricks/guard.py.',
  data STRING COMMENT 'Writer provenance of the refused row, never its contents.'
) COMMENT 'Rows caught at the door. One row per violation, and the refused batch writes nothing to its destination.';

CREATE TABLE IF NOT EXISTS secondhand.measures.guard_snapshot (
  checked_at TIMESTAMP NOT NULL,
  violations BIGINT NOT NULL,
  by_rule STRING NOT NULL COMMENT 'JSON counts by rule.',
  data STRING NOT NULL
) COMMENT 'Completed cross-owner guard runs, published after the violation rows.';

CREATE TABLE IF NOT EXISTS secondhand.measures.guard_snapshot_rows (
  checked_at TIMESTAMP NOT NULL,
  table_name STRING NOT NULL,
  row_id STRING,
  rule STRING NOT NULL,
  data STRING
) COMMENT 'Violation rows from the guard run identified by checked_at.';

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
WHERE data NOT RLIKE '^(synthetic|example|captured|dataset:.+|live:.+)$'
UNION ALL
SELECT 'evidence' AS table_name, id AS row_id, 'evidence_data' AS rule, data
FROM secondhand.core.evidence
WHERE data NOT RLIKE '^(synthetic|example|captured|dataset:.+|live:.+)$'
UNION ALL
SELECT 'citation' AS table_name, id AS row_id, 'citation_data' AS rule, data
FROM secondhand.core.citation
WHERE data NOT RLIKE '^(synthetic|example|captured|dataset:.+|live:.+)$'
UNION ALL
SELECT 'guarded_number' AS table_name, id AS row_id, 'guarded_number_data' AS rule, data
FROM secondhand.core.guarded_number
WHERE data NOT RLIKE '^(synthetic|example|captured|dataset:.+|live:.+)$'
UNION ALL
SELECT 'claim_check' AS table_name, id AS row_id, 'claim_check_data' AS rule, data
FROM secondhand.core.claim_check
WHERE data NOT RLIKE '^(synthetic|example|captured|dataset:.+|live:.+)$'
UNION ALL
SELECT 'event' AS table_name, id AS row_id, 'event_data' AS rule, data
FROM secondhand.core.event
WHERE data NOT RLIKE '^(synthetic|example|captured|dataset:.+|live:.+)$'
UNION ALL
SELECT 'job' AS table_name, id AS row_id, 'job_data' AS rule, data
FROM secondhand.core.job
WHERE data NOT RLIKE '^(synthetic|example|captured|dataset:.+|live:.+)$'
UNION ALL
SELECT 'decision' AS table_name, id AS row_id, 'decision_data' AS rule, data
FROM secondhand.core.decision
WHERE data NOT RLIKE '^(synthetic|example|captured|dataset:.+|live:.+)$'
UNION ALL
SELECT 'storefront_snapshot' AS table_name, id AS row_id, 'storefront_snapshot_data' AS rule, data
FROM secondhand.core.storefront_snapshot
WHERE data NOT RLIKE '^(synthetic|example|captured|dataset:.+|live:.+)$'
UNION ALL
SELECT 'log_event' AS table_name, concat(session, ':', cast(seq AS STRING)) AS row_id, 'log_event_data' AS rule, data
FROM secondhand.core.log_event
WHERE data NOT RLIKE '^(synthetic|example|captured|dataset:.+|live:.+)$'
UNION ALL
SELECT 'observation' AS table_name, o.id AS row_id, 'observation_public_rights' AS rule, o.data
FROM secondhand.core.observation o
WHERE o.user_id IS NULL AND (o.rights_mode IS NULL OR o.rights_mode <> 'public')
UNION ALL
SELECT 'observation' AS table_name, o.id AS row_id, 'observation_dupe' AS rule, o.data
FROM secondhand.core.observation o
WHERE (o.site = 'dupe' OR o.data = 'live:dupe' OR o.source_route RLIKE '(^|[.])dupe([.]|$)')
UNION ALL
SELECT 'evidence' AS table_name, e.id AS row_id, 'evidence_dupe' AS rule, e.data
FROM secondhand.core.evidence e
WHERE (e.data = 'live:dupe' OR EXISTS (SELECT 1 FROM secondhand.core.observation o WHERE o.evidence_id = e.id AND (o.site = 'dupe' OR o.data = 'live:dupe' OR o.source_route RLIKE '(^|[.])dupe([.]|$)')))
UNION ALL
SELECT 'observation' AS table_name, o.id AS row_id, 'observation_ebay_model' AS rule, o.data
FROM secondhand.core.observation o
WHERE EXISTS (SELECT 1 FROM secondhand.core.evidence e WHERE e.id = o.evidence_id AND e.may_model = true AND ((o.site = 'ebay' OR o.data = 'live:ebay' OR o.source_route RLIKE '(^|[.])ebay([.]|$)') OR (e.data = 'live:ebay' OR e.source_url RLIKE r'(?i)^https?://([^/]+\.)?ebay\.[^/]+(/|$)')))
UNION ALL
SELECT 'evidence' AS table_name, e.id AS row_id, 'evidence_ebay_model' AS rule, e.data
FROM secondhand.core.evidence e
WHERE e.may_model = true AND ((e.data = 'live:ebay' OR e.source_url RLIKE r'(?i)^https?://([^/]+\.)?ebay\.[^/]+(/|$)') OR EXISTS (SELECT 1 FROM secondhand.core.observation o WHERE o.evidence_id = e.id AND (o.site = 'ebay' OR o.data = 'live:ebay' OR o.source_route RLIKE '(^|[.])ebay([.]|$)')))
UNION ALL
SELECT 'observation' AS table_name, o.id AS row_id, 'observation_apify_site' AS rule, o.data
FROM secondhand.core.observation o
WHERE o.via = 'apify' AND (o.site IS NULL OR o.site <> 'facebook')
UNION ALL
SELECT 'evidence' AS table_name, e.id AS row_id, 'evidence_apify_site' AS rule, e.data
FROM secondhand.core.evidence e
WHERE EXISTS (SELECT 1 FROM secondhand.core.observation o WHERE o.evidence_id = e.id AND o.via = 'apify' AND (o.site IS NULL OR o.site <> 'facebook'))
UNION ALL
SELECT 'log_event' AS table_name, concat(session, ':', cast(seq AS STRING)) AS row_id, 'log_event_message_text' AS rule, l.data
FROM secondhand.core.log_event l
WHERE body RLIKE r'(?i)"(?!(?:(?:[^"\\]|\\(?:["\\/bfnrt]|u[0-9a-f]{4}))*(?:[^a-z0-9"\\]|\\u00(?:5f|2d)|(?:(?-i:[a-z0-9])|\\u00(?:3[0-9]|6[1-9a-f]|7[0-9a]))(?=(?:(?-i:[A-Z])|\\u00(?:4[1-9a-f]|5[0-9a])))))?(?:(?:i|\\u0069|\\u0049)(?:d|\\u0064|\\u0044)(?:s|\\u0073|\\u0053)|(?:i|\\u0069|\\u0049)(?:d|\\u0064|\\u0044)|(?:c|\\u0063|\\u0043)(?:o|\\u006f|\\u004f)(?:u|\\u0075|\\u0055)(?:n|\\u006e|\\u004e)(?:t|\\u0074|\\u0054)|(?:t|\\u0074|\\u0054)(?:y|\\u0079|\\u0059)(?:p|\\u0070|\\u0050)(?:e|\\u0065|\\u0045)|(?:l|\\u006c|\\u004c)(?:e|\\u0065|\\u0045)(?:n|\\u006e|\\u004e)|(?:l|\\u006c|\\u004c)(?:e|\\u0065|\\u0045)(?:n|\\u006e|\\u004e)(?:g|\\u0067|\\u0047)(?:t|\\u0074|\\u0054)(?:h|\\u0068|\\u0048)|(?:a|\\u0061|\\u0041)(?:t|\\u0074|\\u0054)|(?:m|\\u006d|\\u004d)(?:s|\\u0073|\\u0053)|(?:i|\\u0069|\\u0049)(?:n|\\u006e|\\u004e)|(?:o|\\u006f|\\u004f)(?:u|\\u0075|\\u0055)(?:t|\\u0074|\\u0054)|(?:h|\\u0068|\\u0048)(?:a|\\u0061|\\u0041)(?:s|\\u0073|\\u0053)(?:h|\\u0068|\\u0048))")(?:[^"\\]|\\(?:["\\/bfnrt]|u[0-9a-f]{4}))*(?:(?:t|\\u0074|\\u0054)(?:e|\\u0065|\\u0045)(?:x|\\u0078|\\u0058)(?:t|\\u0074|\\u0054)|(?:m|\\u006d|\\u004d)(?:e|\\u0065|\\u0045)(?:s|\\u0073|\\u0053)(?:s|\\u0073|\\u0053)(?:a|\\u0061|\\u0041)(?:g|\\u0067|\\u0047)(?:e|\\u0065|\\u0045)|(?:b|\\u0062|\\u0042)(?:o|\\u006f|\\u004f)(?:d|\\u0064|\\u0044)(?:y|\\u0079|\\u0059)|(?:c|\\u0063|\\u0043)(?:o|\\u006f|\\u004f)(?:n|\\u006e|\\u004e)(?:t|\\u0074|\\u0054)(?:e|\\u0065|\\u0045)(?:n|\\u006e|\\u004e)(?:t|\\u0074|\\u0054)|(?:p|\\u0070|\\u0050)(?:r|\\u0072|\\u0052)(?:o|\\u006f|\\u004f)(?:m|\\u006d|\\u004d)(?:p|\\u0070|\\u0050)(?:t|\\u0074|\\u0054))(?:[^"\\]|\\(?:["\\/bfnrt]|u[0-9a-f]{4}))*"\s*:\s*(?!null\b|\{\s*"(?:m|\\u006d|\\u004d)(?:a|\\u0061|\\u0041)(?:s|\\u0073|\\u0053)(?:k|\\u006b|\\u004b)(?:e|\\u0065|\\u0045)(?:d|\\u0064|\\u0044)"\s*:\s*"(?:k|\\u006b|\\u004b)(?:e|\\u0065|\\u0045)(?:y|\\u0079|\\u0059)"\s*\})(?:"(?:[^"\\]|\\.)+"|\[|\{)'
UNION ALL
SELECT 'principal_map' AS table_name, m.principal AS row_id, 'principal_map_unlogged_wildcard' AS rule, CAST(NULL AS STRING) AS data
FROM secondhand.governance.principal_map m
WHERE m.user_id = '*' AND NOT EXISTS (SELECT 1 FROM secondhand.governance.break_glass b WHERE b.principal = m.principal AND b.ended_at IS NULL);

CREATE OR REPLACE VIEW secondhand.measures.guard_status
COMMENT 'Guard tile and alert: latest completed cross-owner snapshot, seven-day refusals and rule names.'
AS
SELECT violations AS violations_now,
       (SELECT count(*) FROM secondhand.measures.guard_refusals WHERE refused_at >= current_timestamp() - INTERVAL 7 DAYS) AS refusals_last_7_days,
       checked_at AS last_checked_at,
       array('guarded_number_state', 'guarded_number_shown_citation', 'guarded_number_hidden_reason',
             'guarded_number_citation_fk', 'guarded_number_basis_level', 'claim_check_verdict', 'decision_policy_mode',
             'observation_data', 'evidence_data', 'citation_data', 'guarded_number_data', 'claim_check_data',
             'event_data', 'job_data', 'decision_data', 'storefront_snapshot_data', 'log_event_data', 'observation_public_rights', 'observation_dupe', 'evidence_dupe', 'observation_ebay_model', 'evidence_ebay_model', 'observation_apify_site', 'evidence_apify_site', 'log_event_message_text', 'principal_map_unlogged_wildcard') AS rules
FROM secondhand.measures.guard_snapshot
ORDER BY checked_at DESC
LIMIT 1;
