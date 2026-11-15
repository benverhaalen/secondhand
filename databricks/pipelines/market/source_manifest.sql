CREATE OR REFRESH MATERIALIZED VIEW source_manifest
COMMENT 'Frozen source rights, extractor version and output hash supplied alongside each CSV.'
AS SELECT source, licence, may_model, code_commit AS extractor_version,
          output.sha256 AS source_sha256, rows AS manifest_rows
FROM read_files(
  '/Volumes/secondhand/raw/landing/sold/*/manifest.json',
  format => 'json',
  multiLine => true
);
