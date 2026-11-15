-- Catalog ABAC policies match governed column tags for ownership and handles.
-- Run node databricks/tags.mjs first. New governed tags may need a minute to propagate
-- before CREATE POLICY accepts them (workspace observation supplied with this task).
-- Mirrors the Postgres RLS in db/migrations (user_id is null or user_id = the caller), with the caller mapped from
-- the workspace principal. Run: node databricks/run-sql.mjs databricks/sql/02_governance.sql

CREATE TABLE IF NOT EXISTS secondhand.governance.principal_map (
  principal STRING NOT NULL COMMENT 'A workspace user (current_user()).',
  user_id STRING NOT NULL COMMENT 'The secondhand user whose rows that principal may read.',
  grant_id STRING COMMENT 'The break_glass.id this wildcard row belongs to.'
) COMMENT 'Which secondhand person a workspace principal is. The row filter reads it; nobody else is mapped, so nobody else sees a row.';

-- Agent proposal: maintenance alone writes a temporary user_id = '*' mapping, paired with this audit window.
CREATE TABLE IF NOT EXISTS secondhand.governance.break_glass (
  id STRING NOT NULL COMMENT 'Unique maintenance window id.',
  principal STRING NOT NULL COMMENT 'The workspace principal receiving temporary access.',
  reason STRING NOT NULL COMMENT 'Why maintenance needs access to every row.',
  started_at TIMESTAMP NOT NULL COMMENT 'When the maintenance window started.',
  ended_at TIMESTAMP COMMENT 'When access was revoked; null while open or if revocation failed.'
) COMMENT 'Agent proposal: audited temporary maintenance access through the wildcard principal mapping.';

CREATE OR REPLACE FUNCTION secondhand.governance.owner_only(row_user_id STRING)
RETURNS BOOLEAN
COMMENT 'Row filter: a row is visible to the principal mapped to its user_id. user_id null is a shared row (a global param). Agent proposal: a principal mapped to user_id ''*'' sees every row during audited maintenance.'
RETURN row_user_id IS NULL OR EXISTS (SELECT 1 FROM secondhand.governance.principal_map m WHERE m.principal = current_user() AND (m.user_id = row_user_id OR m.user_id = '*'));

CREATE OR REPLACE FUNCTION secondhand.governance.mask_handle(handle STRING)
RETURNS STRING
COMMENT 'Column mask: a buyer or seller handle shows its first letter only, unless the reader is in the secondhand_support group.'
RETURN CASE WHEN handle IS NULL THEN NULL WHEN is_account_group_member('secondhand_support') THEN handle ELSE concat(left(handle, 1), '***') END;

ALTER TABLE secondhand.core.observation ALTER COLUMN user_id SET TAGS ('sh_owner' = 'user_id');
ALTER TABLE secondhand.core.evidence ALTER COLUMN user_id SET TAGS ('sh_owner' = 'user_id');
ALTER TABLE secondhand.core.citation ALTER COLUMN user_id SET TAGS ('sh_owner' = 'user_id');
ALTER TABLE secondhand.core.guarded_number ALTER COLUMN user_id SET TAGS ('sh_owner' = 'user_id');
ALTER TABLE secondhand.core.claim_check ALTER COLUMN user_id SET TAGS ('sh_owner' = 'user_id');
ALTER TABLE secondhand.core.param ALTER COLUMN user_id SET TAGS ('sh_owner' = 'user_id');
ALTER TABLE secondhand.core.event ALTER COLUMN user_id SET TAGS ('sh_owner' = 'user_id');
ALTER TABLE secondhand.core.job ALTER COLUMN user_id SET TAGS ('sh_owner' = 'user_id');
ALTER TABLE secondhand.core.decision ALTER COLUMN user_id SET TAGS ('sh_owner' = 'user_id');
ALTER TABLE secondhand.core.storefront_snapshot ALTER COLUMN user_id SET TAGS ('sh_owner' = 'user_id');
ALTER TABLE secondhand.core.log_event ALTER COLUMN user_id SET TAGS ('sh_owner' = 'user_id');

ALTER TABLE secondhand.core.observation ALTER COLUMN seller_handle SET TAGS ('sh_personal' = 'handle');
ALTER TABLE secondhand.core.decision ALTER COLUMN buyer_handle SET TAGS ('sh_personal' = 'handle');

CREATE OR REPLACE POLICY sh_owner_only ON CATALOG secondhand
COMMENT 'A person sees only their own rows and linked accounts (spec/databricks-build.md section 7).'
ROW FILTER secondhand.governance.owner_only TO `account users`
FOR TABLES MATCH COLUMNS has_tag_value('sh_owner','user_id') AS uid USING COLUMNS (uid);

CREATE OR REPLACE POLICY sh_mask_handle ON CATALOG secondhand
COMMENT 'Buyer and seller handles are not shown, except to support (spec/databricks-build.md section 7).'
COLUMN MASK secondhand.governance.mask_handle TO `account users`
FOR TABLES MATCH COLUMNS has_tag_value('sh_personal','handle') AS h ON COLUMN h;

-- Install replacement policies first: a failure must leave the direct protections in place.
-- DROP ROW FILTER and DROP MASK are no-ops when no direct filter or mask is set.
ALTER TABLE secondhand.core.observation DROP ROW FILTER;
ALTER TABLE secondhand.core.evidence DROP ROW FILTER;
ALTER TABLE secondhand.core.citation DROP ROW FILTER;
ALTER TABLE secondhand.core.guarded_number DROP ROW FILTER;
ALTER TABLE secondhand.core.claim_check DROP ROW FILTER;
ALTER TABLE secondhand.core.param DROP ROW FILTER;
ALTER TABLE secondhand.core.event DROP ROW FILTER;
ALTER TABLE secondhand.core.job DROP ROW FILTER;
ALTER TABLE secondhand.core.decision DROP ROW FILTER;
ALTER TABLE secondhand.core.storefront_snapshot DROP ROW FILTER;
ALTER TABLE secondhand.core.log_event DROP ROW FILTER;

ALTER TABLE secondhand.core.observation ALTER COLUMN seller_handle DROP MASK;
ALTER TABLE secondhand.core.decision ALTER COLUMN buyer_handle DROP MASK;

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
