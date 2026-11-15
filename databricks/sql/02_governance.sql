-- Governance on the canon tables: UC tags for retention and rights, a row filter on user_id, masks on handles.
-- Mirrors the Postgres RLS in db/migrations (user_id is null or user_id = the caller), with the caller mapped from
-- the workspace principal. Run: node databricks/run-sql.mjs databricks/sql/02_governance.sql

CREATE TABLE IF NOT EXISTS secondhand.governance.principal_map (
  principal STRING NOT NULL COMMENT 'A workspace user (current_user()).',
  user_id STRING NOT NULL COMMENT 'The secondhand user whose rows that principal may read.'
) COMMENT 'Which secondhand person a workspace principal is. The row filter reads it; nobody else is mapped, so nobody else sees a row.';

CREATE OR REPLACE FUNCTION secondhand.governance.owner_only(row_user_id STRING)
RETURNS BOOLEAN
COMMENT 'Row filter: a row is visible to the principal mapped to its user_id. user_id null is a shared row (a global param).'
RETURN row_user_id IS NULL OR EXISTS (SELECT 1 FROM secondhand.governance.principal_map m WHERE m.principal = current_user() AND m.user_id = row_user_id);

CREATE OR REPLACE FUNCTION secondhand.governance.mask_handle(handle STRING)
RETURNS STRING
COMMENT 'Column mask: a buyer or seller handle shows its first letter only, unless the reader is in the secondhand_support group.'
RETURN CASE WHEN handle IS NULL THEN NULL WHEN is_account_group_member('secondhand_support') THEN handle ELSE concat(left(handle, 1), '***') END;

ALTER TABLE secondhand.core.observation SET ROW FILTER secondhand.governance.owner_only ON (user_id);
ALTER TABLE secondhand.core.evidence SET ROW FILTER secondhand.governance.owner_only ON (user_id);
ALTER TABLE secondhand.core.citation SET ROW FILTER secondhand.governance.owner_only ON (user_id);
ALTER TABLE secondhand.core.guarded_number SET ROW FILTER secondhand.governance.owner_only ON (user_id);
ALTER TABLE secondhand.core.claim_check SET ROW FILTER secondhand.governance.owner_only ON (user_id);
ALTER TABLE secondhand.core.param SET ROW FILTER secondhand.governance.owner_only ON (user_id);
ALTER TABLE secondhand.core.event SET ROW FILTER secondhand.governance.owner_only ON (user_id);
ALTER TABLE secondhand.core.job SET ROW FILTER secondhand.governance.owner_only ON (user_id);
ALTER TABLE secondhand.core.decision SET ROW FILTER secondhand.governance.owner_only ON (user_id);
ALTER TABLE secondhand.core.storefront_snapshot SET ROW FILTER secondhand.governance.owner_only ON (user_id);
ALTER TABLE secondhand.core.log_event SET ROW FILTER secondhand.governance.owner_only ON (user_id);

ALTER TABLE secondhand.core.observation ALTER COLUMN seller_handle SET MASK secondhand.governance.mask_handle;
ALTER TABLE secondhand.core.decision ALTER COLUMN buyer_handle SET MASK secondhand.governance.mask_handle;

ALTER TABLE secondhand.core.observation SET TAGS ('retention_class' = 'source_ttl', 'rights_mode' = 'own_scope');
ALTER TABLE secondhand.core.evidence SET TAGS ('retention_class' = 'item_audit', 'rights_mode' = 'own_scope');
ALTER TABLE secondhand.core.citation SET TAGS ('retention_class' = 'item_audit', 'rights_mode' = 'own_scope');
ALTER TABLE secondhand.core.guarded_number SET TAGS ('retention_class' = 'item_audit', 'rights_mode' = 'own_scope');
ALTER TABLE secondhand.core.claim_check SET TAGS ('retention_class' = 'item_audit', 'rights_mode' = 'own_scope');
ALTER TABLE secondhand.core.param SET TAGS ('retention_class' = 'history', 'rights_mode' = 'internal');
ALTER TABLE secondhand.core.event SET TAGS ('retention_class' = 'history', 'rights_mode' = 'own_scope');
ALTER TABLE secondhand.core.job SET TAGS ('retention_class' = 'history', 'rights_mode' = 'own_scope');
ALTER TABLE secondhand.core.decision SET TAGS ('retention_class' = 'item_audit', 'rights_mode' = 'own_scope');
ALTER TABLE secondhand.core.storefront_snapshot SET TAGS ('retention_class' = 'history', 'rights_mode' = 'own_scope');
ALTER TABLE secondhand.core.log_event SET TAGS ('retention_class' = 'transient', 'rights_mode' = 'internal');
ALTER TABLE secondhand.core.observation ALTER COLUMN seller_handle SET TAGS ('personal' = 'handle');
ALTER TABLE secondhand.core.decision ALTER COLUMN buyer_handle SET TAGS ('personal' = 'handle');
ALTER TABLE secondhand.core.evidence ALTER COLUMN may_model SET TAGS ('rights' = 'may_model');
ALTER TABLE secondhand.core.evidence ALTER COLUMN may_show SET TAGS ('rights' = 'may_show');
ALTER TABLE secondhand.core.evidence ALTER COLUMN may_share SET TAGS ('rights' = 'may_share');
ALTER TABLE secondhand.core.evidence ALTER COLUMN may_store SET TAGS ('rights' = 'may_store');
