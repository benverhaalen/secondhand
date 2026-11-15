-- Enforced guards and informational keys (spec/plans/sweep/databricks.md rows 1 and 4).
-- Run: node databricks/run-sql.mjs databricks/sql/08_constraints.sql
-- CHECK rules validate existing rows and every later write. PK/FK describe joins;
-- Unity Catalog does not enforce uniqueness or referential integrity for them.

CREATE TABLE IF NOT EXISTS secondhand.governance.break_glass (
  id STRING NOT NULL, principal STRING NOT NULL, reason STRING NOT NULL,
  started_at TIMESTAMP NOT NULL, ended_at TIMESTAMP
) COMMENT 'Temporary cross-user access: an open row accompanies the current principal wildcard mapping. ended_at is set only after its mapping is removed.';

-- Remove dependents before replacing referenced keys, including on the second run.
ALTER TABLE secondhand.core.guarded_number DROP CONSTRAINT IF EXISTS guarded_number_citation_fk;
ALTER TABLE secondhand.core.observation DROP CONSTRAINT IF EXISTS observation_evidence_fk;

ALTER TABLE secondhand.core.observation DROP CONSTRAINT IF EXISTS observation_pk;
ALTER TABLE secondhand.core.evidence DROP CONSTRAINT IF EXISTS evidence_pk;
ALTER TABLE secondhand.core.citation DROP CONSTRAINT IF EXISTS citation_pk;
ALTER TABLE secondhand.core.guarded_number DROP CONSTRAINT IF EXISTS guarded_number_pk;
ALTER TABLE secondhand.core.claim_check DROP CONSTRAINT IF EXISTS claim_check_pk;
ALTER TABLE secondhand.core.param DROP CONSTRAINT IF EXISTS param_pk;
ALTER TABLE secondhand.core.event DROP CONSTRAINT IF EXISTS event_pk;
ALTER TABLE secondhand.core.job DROP CONSTRAINT IF EXISTS job_pk;
ALTER TABLE secondhand.core.decision DROP CONSTRAINT IF EXISTS decision_pk;
ALTER TABLE secondhand.core.storefront_snapshot DROP CONSTRAINT IF EXISTS storefront_snapshot_pk;

ALTER TABLE secondhand.core.guarded_number DROP CONSTRAINT IF EXISTS guarded_number_state;
ALTER TABLE secondhand.core.guarded_number DROP CONSTRAINT IF EXISTS guarded_number_shown_citation;
ALTER TABLE secondhand.core.guarded_number DROP CONSTRAINT IF EXISTS guarded_number_hidden_reason;
ALTER TABLE secondhand.core.claim_check DROP CONSTRAINT IF EXISTS claim_check_verdict;
ALTER TABLE secondhand.core.decision DROP CONSTRAINT IF EXISTS decision_policy_mode;

ALTER TABLE secondhand.core.observation DROP CONSTRAINT IF EXISTS observation_data;
ALTER TABLE secondhand.core.evidence DROP CONSTRAINT IF EXISTS evidence_data;
ALTER TABLE secondhand.core.citation DROP CONSTRAINT IF EXISTS citation_data;
ALTER TABLE secondhand.core.guarded_number DROP CONSTRAINT IF EXISTS guarded_number_data;
ALTER TABLE secondhand.core.claim_check DROP CONSTRAINT IF EXISTS claim_check_data;
ALTER TABLE secondhand.core.event DROP CONSTRAINT IF EXISTS event_data;
ALTER TABLE secondhand.core.job DROP CONSTRAINT IF EXISTS job_data;
ALTER TABLE secondhand.core.decision DROP CONSTRAINT IF EXISTS decision_data;
ALTER TABLE secondhand.core.storefront_snapshot DROP CONSTRAINT IF EXISTS storefront_snapshot_data;
ALTER TABLE secondhand.core.log_event DROP CONSTRAINT IF EXISTS log_event_data;

ALTER TABLE secondhand.core.observation ADD CONSTRAINT observation_pk PRIMARY KEY (id);
ALTER TABLE secondhand.core.evidence ADD CONSTRAINT evidence_pk PRIMARY KEY (id);
ALTER TABLE secondhand.core.citation ADD CONSTRAINT citation_pk PRIMARY KEY (id);
ALTER TABLE secondhand.core.guarded_number ADD CONSTRAINT guarded_number_pk PRIMARY KEY (id);
ALTER TABLE secondhand.core.claim_check ADD CONSTRAINT claim_check_pk PRIMARY KEY (id);
ALTER TABLE secondhand.core.param ADD CONSTRAINT param_pk PRIMARY KEY (id);
ALTER TABLE secondhand.core.event ADD CONSTRAINT event_pk PRIMARY KEY (id);
ALTER TABLE secondhand.core.job ADD CONSTRAINT job_pk PRIMARY KEY (id);
ALTER TABLE secondhand.core.decision ADD CONSTRAINT decision_pk PRIMARY KEY (id);
ALTER TABLE secondhand.core.storefront_snapshot ADD CONSTRAINT storefront_snapshot_pk PRIMARY KEY (id);

ALTER TABLE secondhand.core.guarded_number ADD CONSTRAINT guarded_number_state CHECK (state IN ('shown','hidden','not_found'));
ALTER TABLE secondhand.core.guarded_number ADD CONSTRAINT guarded_number_shown_citation CHECK (state <> 'shown' OR citation_id IS NOT NULL);
ALTER TABLE secondhand.core.guarded_number ADD CONSTRAINT guarded_number_hidden_reason CHECK (state <> 'hidden' OR hide_reason IS NOT NULL);
ALTER TABLE secondhand.core.claim_check ADD CONSTRAINT claim_check_verdict CHECK (verdict IN ('pass','hold','abstain'));
ALTER TABLE secondhand.core.decision ADD CONSTRAINT decision_policy_mode CHECK (policy_mode IN ('auto','ask','locked','never'));

ALTER TABLE secondhand.core.observation ADD CONSTRAINT observation_data CHECK (data RLIKE '^(synthetic|example|dataset:.+|live:.+)$');
ALTER TABLE secondhand.core.evidence ADD CONSTRAINT evidence_data CHECK (data RLIKE '^(synthetic|example|dataset:.+|live:.+)$');
ALTER TABLE secondhand.core.citation ADD CONSTRAINT citation_data CHECK (data RLIKE '^(synthetic|example|dataset:.+|live:.+)$');
ALTER TABLE secondhand.core.guarded_number ADD CONSTRAINT guarded_number_data CHECK (data RLIKE '^(synthetic|example|dataset:.+|live:.+)$');
ALTER TABLE secondhand.core.claim_check ADD CONSTRAINT claim_check_data CHECK (data RLIKE '^(synthetic|example|dataset:.+|live:.+)$');
ALTER TABLE secondhand.core.event ADD CONSTRAINT event_data CHECK (data RLIKE '^(synthetic|example|dataset:.+|live:.+)$');
ALTER TABLE secondhand.core.job ADD CONSTRAINT job_data CHECK (data RLIKE '^(synthetic|example|dataset:.+|live:.+)$');
ALTER TABLE secondhand.core.decision ADD CONSTRAINT decision_data CHECK (data RLIKE '^(synthetic|example|dataset:.+|live:.+)$');
ALTER TABLE secondhand.core.storefront_snapshot ADD CONSTRAINT storefront_snapshot_data CHECK (data RLIKE '^(synthetic|example|dataset:.+|live:.+)$');
ALTER TABLE secondhand.core.log_event ADD CONSTRAINT log_event_data CHECK (data RLIKE '^(synthetic|example|dataset:.+|live:.+)$');

ALTER TABLE secondhand.core.guarded_number ADD CONSTRAINT guarded_number_citation_fk FOREIGN KEY (citation_id) REFERENCES secondhand.core.citation (id);
ALTER TABLE secondhand.core.observation ADD CONSTRAINT observation_evidence_fk FOREIGN KEY (evidence_id) REFERENCES secondhand.core.evidence (id);

-- Agent proposal: append-only is now kept by grants (only the writer identity gets
-- MODIFY), so a person can be deleted. DELETE and REORG remove current data;
-- old files remain until VACUUM after the retention window (default seven days).
ALTER TABLE secondhand.core.observation SET TBLPROPERTIES ('delta.appendOnly' = 'false', 'delta.enableDeletionVectors' = 'true');
