-- Catalog secondhand already exists on the workspace (spec/databricks-build.md §2).
CREATE SCHEMA IF NOT EXISTS secondhand.raw COMMENT 'landing files and app volumes';
CREATE SCHEMA IF NOT EXISTS secondhand.market COMMENT 'public sold and asking rows, owned by the secondhand-market pipeline';
CREATE SCHEMA IF NOT EXISTS secondhand.measures COMMENT 'Views a judge or a dashboard reads: citation coverage, hides and why, decisions by policy, weight moves.';

CREATE VOLUME IF NOT EXISTS secondhand.raw.landing COMMENT 'sold/<source>/rows.csv.gz with manifest.json, logs/*.jsonl';
CREATE VOLUME IF NOT EXISTS secondhand.raw.captures COMMENT 'captures/<user_id>/<capture_id>/, written only by the API';
CREATE VOLUME IF NOT EXISTS secondhand.raw.snapshots COMMENT 'stored pages behind evidence.snapshot_ref, so a read can be replayed';
CREATE VOLUME IF NOT EXISTS secondhand.raw.export COMMENT 'params/latest.json and dated copies the server reads on a timer';
