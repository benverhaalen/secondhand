-- The tombstone every loader reads: a user_id here is never written again.
-- Run after 02_governance.sql and before loaders or purge_user.
CREATE TABLE IF NOT EXISTS secondhand.governance.erasure (
  user_id STRING NOT NULL COMMENT 'The person whose writes are permanently refused.',
  requested_at TIMESTAMP NOT NULL COMMENT 'When erasure was first requested, before any deletion.',
  purged_at TIMESTAMP COMMENT 'When current rows, mappings and source files were removed.',
  tables STRING COMMENT 'JSON object of core table names and verified remaining row counts.',
  files_rewritten INT COMMENT 'Landing JSONL files rewritten by the completed purge.',
  vacuum_due_at TIMESTAMP COMMENT 'Seven days after purged_at, when retained core files become eligible.',
  vacuumed_at TIMESTAMP COMMENT 'Set after a successful core VACUUM covering this due date.'
) COMMENT 'Permanent erasure tombstones and physical deletion progress.';

-- Only the owner writes mappings, maintenance windows and erasure tombstones.
-- Schema and catalog grants must also be owner-only: table REVOKE cannot remove inherited grants.
REVOKE ALL PRIVILEGES ON TABLE secondhand.governance.principal_map FROM `account users`;
REVOKE ALL PRIVILEGES ON TABLE secondhand.governance.break_glass FROM `account users`;
REVOKE ALL PRIVILEGES ON TABLE secondhand.governance.erasure FROM `account users`;

-- SHOW-GRANTS-equivalent rows, including inherited privileges visible to the owner.
CREATE OR REPLACE VIEW secondhand.measures.governance_grants
COMMENT 'Governance table privileges: the owner checks for unexpected principal mapping or tombstone writers.'
AS SELECT grantor, grantee, table_schema, table_name, privilege_type
FROM secondhand.information_schema.table_privileges
WHERE table_schema = 'governance'
  AND table_name IN ('principal_map', 'break_glass', 'erasure');
