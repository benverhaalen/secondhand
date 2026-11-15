-- secondhand proof and governance layer on Unity Catalog. Shapes from spec/product.md §3 (data model, sub-shapes).
-- Every row carries id, user_id, created_at, updated_at, version. JSON-valued canon fields are STRING holding JSON.
-- Run: node databricks/run-sql.mjs databricks/sql/01_tables.sql

CREATE CATALOG IF NOT EXISTS secondhand COMMENT 'secondhand: proof and governance. Every shown number traces to its evidence, every automated action to its policy decision, every learned weight to its version.';
CREATE SCHEMA IF NOT EXISTS secondhand.core COMMENT 'The canon rows (spec/product.md §3), one table per entity.';
CREATE SCHEMA IF NOT EXISTS secondhand.governance COMMENT 'Who may see which rows: the principal map, the row filter and the column masks.';
CREATE SCHEMA IF NOT EXISTS secondhand.measures COMMENT 'Views a judge or a dashboard reads: citation coverage, hides and why, decisions by policy, weight moves.';

CREATE TABLE IF NOT EXISTS secondhand.core.observation (
  data STRING NOT NULL COMMENT 'Writer provenance: synthetic, example, dataset:<name> or live:<site>; immutable (spec/product.md section 3).',
  id STRING NOT NULL COMMENT 'Prefixed id (obs_).',
  user_id STRING COMMENT 'Owner; null is a shared public read, never who asked',
  created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL, version INT NOT NULL COMMENT 'Bumped on each write.',
  kind STRING NOT NULL COMMENT 'listing, stats, price, rank, fact, trend, retail, rule.',
  site STRING COMMENT 'ebay, facebook, depop, poshmark, mercari, offerup, grailed.',
  product_id STRING,
  subject_ref STRING NOT NULL COMMENT 'A listing id, url_ref or query.',
  observed_at TIMESTAMP NOT NULL,
  price_cents BIGINT COMMENT 'Money amount in cents, with currency.', currency STRING,
  price_type STRING COMMENT 'sold or asking (the comp view).',
  seller_handle STRING COMMENT 'Buyer or seller handle on the site. Personal: masked by governance.mask_handle.',
  payload STRING COMMENT 'JSON payload as read.',
  evidence_id STRING NOT NULL COMMENT 'The evidence row this observation rests on.',
  source_route STRING,
  retention_class STRING NOT NULL COMMENT 'device, transient, thread, order, item_audit, source_ttl, history.',
  rights_mode STRING NOT NULL COMMENT 'own_scope, opt_in_shared, aggregate_only, public, internal, never_kept.',
  use_scope STRING COMMENT 'hackathon_demo or product: what this row may be used for; shown-only rows are hackathon_demo with may_model false on their evidence',
  keep_until TIMESTAMP COMMENT 'When this public read must stop being kept; null means no stated deadline.',
  channel STRING COMMENT 'official_retail or secondhand.',
  query STRING COMMENT 'Public search terms, never who asked.',
  via STRING COMMENT 'The provider used for this read, or null for a direct read.',
  job_id STRING COMMENT 'The finished search that landed this read.'
) COMMENT 'The one general row every protocol read and information-engine find writes. Append-only. comp and rank_observation are typed views over it.'
TBLPROPERTIES ('delta.appendOnly' = 'true');

CREATE TABLE IF NOT EXISTS secondhand.core.evidence (
  data STRING NOT NULL COMMENT 'Writer provenance: synthetic, example, dataset:<name> or live:<site>; immutable (spec/product.md section 3).',
  id STRING NOT NULL,
  user_id STRING COMMENT 'Owner; null is a shared public read, never who asked',
  created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL, version INT NOT NULL,
  shape STRING NOT NULL COMMENT 'attribute or comp (spec/product.md sub-shapes).',
  kind STRING COMMENT 'attribute shape: image_region, depth, label_text, lookup, owner.',
  ref STRING COMMENT 'attribute shape: what the fact rests on.',
  source_url STRING COMMENT 'comp shape: the page read.',
  read_at TIMESTAMP COMMENT 'comp shape: when it was read.',
  snapshot_ref STRING COMMENT 'comp shape: the stored page in a volume, so the read can be replayed.',
  fingerprint STRING COMMENT 'comp shape: hash of the page as read.',
  extractor_version STRING NOT NULL,
  may_store BOOLEAN COMMENT 'rights tag from the source terms.', may_model BOOLEAN COMMENT 'rights tag.', may_show BOOLEAN COMMENT 'rights tag.', may_share BOOLEAN COMMENT 'rights tag.',
  ttl_days INT COMMENT 'rights tag ttl.',
  use_scope STRING COMMENT 'hackathon_demo or product: what this evidence may be used for.'
) COMMENT 'What a fact rests on. Hackathon build: rights recorded, not enforced; public launch enforces the same tags.';

CREATE TABLE IF NOT EXISTS secondhand.core.citation (
  data STRING NOT NULL COMMENT 'Writer provenance: synthetic, example, dataset:<name> or live:<site>; immutable (spec/product.md section 3).',
  id STRING NOT NULL COMMENT 'cit_ plus the first 16 hex of basis_hash (app/src/engines/proof/proof.ts).',
  user_id STRING NOT NULL, created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL, version INT NOT NULL,
  metric STRING NOT NULL, filters STRING COMMENT 'JSON.',
  table_versions STRING COMMENT 'JSON array of Delta versions, read back with VERSION AS OF n.',
  definition_version STRING, code_version STRING,
  param_versions STRING COMMENT 'JSON: param name to version, so Why this price can name the weights.',
  model_version STRING, computed_at TIMESTAMP NOT NULL,
  basis_ids ARRAY<STRING> NOT NULL COMMENT 'The observation ids the number was computed from.',
  basis_hash STRING NOT NULL COMMENT 'SHA-256 of the sorted lines id:price_cents (M21).'
) COMMENT 'Enough to recompute a shown number as of its date.';

CREATE TABLE IF NOT EXISTS secondhand.core.guarded_number (
  data STRING NOT NULL COMMENT 'Writer provenance: synthetic, example, dataset:<name> or live:<site>; immutable (spec/product.md section 3).',
  id STRING NOT NULL, user_id STRING NOT NULL, created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL, version INT NOT NULL,
  item_id STRING NOT NULL, metric STRING NOT NULL,
  value_cents BIGINT, lo_cents BIGINT, hi_cents BIGINT, currency STRING,
  basis_count INT NOT NULL, n_eff DOUBLE, as_of TIMESTAMP NOT NULL,
  basis_level STRING COMMENT 'Fallback level that answered: variant, product, family, kind, prior, or an engine named level (spec/product.md section 3).',
  citation_id STRING COMMENT 'Set on every shown number.',
  state STRING NOT NULL COMMENT 'shown, hidden, not_found.',
  hide_reason STRING COMMENT 'too_few, too_wide, stale, mixed_types, source_gap, conflict, noise.'
) COMMENT 'Every number the app shows, as guarded by proof.ts answer(): a shown one carries citation_id, a hidden one says why.';

CREATE TABLE IF NOT EXISTS secondhand.core.claim_check (
  data STRING NOT NULL COMMENT 'Writer provenance: synthetic, example, dataset:<name> or live:<site>; immutable (spec/product.md section 3).',
  id STRING NOT NULL, user_id STRING NOT NULL, created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL, version INT NOT NULL,
  subject STRING NOT NULL COMMENT 'message_id draft or listing draft.',
  claims STRING NOT NULL COMMENT 'JSON array of {text, state backed or unbacked, attribute_id or evidence_ref}.',
  verdict STRING NOT NULL COMMENT 'pass, hold, abstain. A hold opens an unbacked_claim decision.',
  checker_version STRING NOT NULL
) COMMENT 'The evidence gate on anything leaving the system.';

CREATE TABLE IF NOT EXISTS secondhand.core.param (
  id STRING NOT NULL, user_id STRING COMMENT 'Set exactly when scope.person is set.', created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL,
  name STRING NOT NULL, scope STRING NOT NULL COMMENT 'scopeKey(scope) from app/src/engines/param/param.ts.',
  family STRING NOT NULL COMMENT 'scalar, beta, normal, gamma, model_ref.',
  value_or_hyperparams STRING NOT NULL COMMENT 'JSON.', prior STRING COMMENT 'JSON: the determination card number.',
  version INT NOT NULL, fitted_on_ids_hash STRING, n_eff DOUBLE NOT NULL, metric STRING,
  held_out_score DOUBLE COMMENT 'Required on a challenger written by a fit.', guard_lo DOUBLE, guard_hi DOUBLE,
  status STRING NOT NULL COMMENT 'champion, challenger, retired.', frozen BOOLEAN NOT NULL, promoted_at TIMESTAMP,
  moved_by STRING COMMENT 'What wrote this version: propose, promote, rollback, and the job run.'
) COMMENT 'Every learned weight, threshold and interval, one row per version. Promote on a held-out win; rollback restores the last promoted version. Delta history and the change feed keep every move.'
TBLPROPERTIES ('delta.enableChangeDataFeed' = 'true');

CREATE TABLE IF NOT EXISTS secondhand.core.event (
  data STRING NOT NULL COMMENT 'Writer provenance: synthetic, example, dataset:<name> or live:<site>; immutable (spec/product.md section 3).',
  id STRING NOT NULL, user_id STRING NOT NULL, created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL, version INT NOT NULL,
  item_id STRING, actor STRING NOT NULL COMMENT 'user, auto, site.', action STRING NOT NULL, why STRING,
  observed_at TIMESTAMP NOT NULL, effective_at TIMESTAMP, operation_id STRING, trace_id STRING,
  site STRING, source STRING COMMENT 'The event.received enum in spec/events.json.', dedupe_key STRING
) COMMENT 'The one log and the one why source, written through the logger.';

CREATE TABLE IF NOT EXISTS secondhand.core.job (
  data STRING NOT NULL COMMENT 'Writer provenance: synthetic, example, dataset:<name> or live:<site>; immutable (spec/product.md section 3).',
  id STRING NOT NULL, user_id STRING NOT NULL, created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL, version INT NOT NULL,
  kind STRING NOT NULL, item_id STRING, stages STRING COMMENT 'JSON array of {name, state, started_at, ended_at}.',
  state STRING NOT NULL, result STRING COMMENT 'JSON.', error STRING, trace_id STRING, event_id STRING COMMENT 'The event that started it.',
  idempotency_key STRING NOT NULL
) COMMENT 'A unit of work the system runs for a person.';

CREATE TABLE IF NOT EXISTS secondhand.core.decision (
  data STRING NOT NULL COMMENT 'Writer provenance: synthetic, example, dataset:<name> or live:<site>; immutable (spec/product.md section 3).',
  id STRING NOT NULL, user_id STRING NOT NULL, created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL, version INT NOT NULL,
  kind STRING NOT NULL COMMENT 'spec/product.md §5 decision kinds.', item_id STRING, action STRING NOT NULL, actor STRING NOT NULL,
  price_cents BIGINT, floor_cents BIGINT, site STRING,
  policy_mode STRING NOT NULL COMMENT 'What check() in app/src/edge/events/policy.ts answered: auto (allowed), ask, locked, never.',
  policy_result STRING NOT NULL COMMENT 'The check() result as JSON.',
  policy_version STRING NOT NULL, why STRING, state STRING NOT NULL, buyer_handle STRING COMMENT 'Personal: masked by governance.mask_handle.'
) COMMENT 'Every outward verb with the policy decision that allowed, asked or refused it. A model never decides it.';

CREATE TABLE IF NOT EXISTS secondhand.core.storefront_snapshot (
  data STRING NOT NULL COMMENT 'Writer provenance: synthetic, example, dataset:<name> or live:<site>; immutable (spec/product.md section 3).',
  id STRING NOT NULL, user_id STRING NOT NULL, created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL, version INT NOT NULL,
  account_id STRING NOT NULL, site STRING NOT NULL, as_of TIMESTAMP NOT NULL,
  shop STRING COMMENT 'JSON {followers, rating, active_count, sold_count, ...}.', totals STRING COMMENT 'JSON {views, likes, orders, gross_cents, ...}.',
  window_days INT, fields_missing ARRAY<STRING> COMMENT 'What this site does not show.', source STRING, citation_id STRING
) COMMENT 'What each linked storefront reports about itself, per person and site.';

CREATE TABLE IF NOT EXISTS secondhand.core.log_event (
  data STRING NOT NULL COMMENT 'Writer provenance: synthetic, example, dataset:<name> or live:<site>; immutable (spec/product.md section 3).',
  user_id STRING NOT NULL, ts TIMESTAMP NOT NULL, session STRING NOT NULL, seq INT NOT NULL, src STRING, level STRING,
  event STRING NOT NULL COMMENT 'spec/events.json names: call.start, call.end, job.state, decision.answer, event.received, ...',
  item STRING, job STRING, call STRING, trace STRING, body STRING COMMENT 'The rest of the envelope as JSON.'
) COMMENT 'The log/ envelope, one row per line, loaded from a walk log (logs/walk-*.jsonl).';
