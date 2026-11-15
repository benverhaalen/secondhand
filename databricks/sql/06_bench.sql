-- spec/benchmark.md rows 1, 2, 3 and 8; one record per question and item.
CREATE TABLE IF NOT EXISTS secondhand.measures.bench_record (
  run_id STRING COMMENT 'Benchmark run identifier.',
  tool STRING COMMENT 'Tool asked.',
  item_id STRING COMMENT 'Item asked about.',
  question STRING COMMENT 'Question asked.',
  data STRING COMMENT 'Dataset identifier derived from the manifest hash.',
  manifest_sha256 STRING COMMENT 'SHA-256 of the fixed item manifest.',
  asked_at TIMESTAMP COMMENT 'Time the question was asked.',
  first_at TIMESTAMP COMMENT 'Time of first answer, or null.',
  full_at TIMESTAMP COMMENT 'Time of full answer, or null.',
  first_ms DOUBLE COMMENT 'Milliseconds from question to first answer, or null.',
  full_ms DOUBLE COMMENT 'Milliseconds from question to full answer, or null.',
  ok BOOLEAN COMMENT 'Whether an answer was returned.',
  error STRING COMMENT 'Recorded error, or null.',
  range_json STRING COMMENT 'Recorded range as JSON, or null.',
  delist_json STRING COMMENT 'Recorded delist entries as JSON, or null.',
  raw_ref STRING COMMENT 'Reference to the saved raw answer.'
) COMMENT 'Benchmark answer records.';

CREATE TABLE IF NOT EXISTS secondhand.measures.bench_number (
  run_id STRING COMMENT 'Benchmark run identifier.',
  tool STRING COMMENT 'Tool asked.',
  item_id STRING COMMENT 'Item asked about.',
  question STRING COMMENT 'Question asked.',
  data STRING COMMENT 'Dataset identifier derived from the manifest hash.',
  position INT COMMENT 'Zero-based position in the numbers array.',
  name STRING COMMENT 'Name of the displayed number.',
  value_cents BIGINT COMMENT 'Number in integer cents.',
  citation_id STRING COMMENT 'Citation identifier, or null.',
  evidence ARRAY<STRING> COMMENT 'References to saved evidence.'
) COMMENT 'Numbers in benchmark answers.';

CREATE TABLE IF NOT EXISTS secondhand.measures.bench_fact (
  run_id STRING COMMENT 'Benchmark run identifier.',
  tool STRING COMMENT 'Tool asked.',
  item_id STRING COMMENT 'Item asked about.',
  question STRING COMMENT 'Question asked.',
  data STRING COMMENT 'Dataset identifier derived from the manifest hash.',
  position INT COMMENT 'Zero-based position in the facts array.',
  kind STRING COMMENT 'Kind of fact returned.',
  count BIGINT COMMENT 'Number of facts of this kind.'
) COMMENT 'Fact counts in benchmark answers.';

CREATE TABLE IF NOT EXISTS secondhand.measures.bench_site (
  run_id STRING COMMENT 'Benchmark run identifier.',
  tool STRING COMMENT 'Tool asked.',
  item_id STRING COMMENT 'Item asked about.',
  question STRING COMMENT 'Question asked.',
  data STRING COMMENT 'Dataset identifier derived from the manifest hash.',
  position INT COMMENT 'Zero-based position in the sites array.',
  site STRING COMMENT 'Site used by the answer.'
) COMMENT 'Sites used by benchmark answers.';

CREATE TABLE IF NOT EXISTS secondhand.measures.bench_load_report (
  run_id STRING COMMENT 'Benchmark run identifier from the folder.',
  data STRING COMMENT 'Dataset identifier, null when no valid records were loaded.',
  file STRING COMMENT 'Volume path of the input file.',
  lines BIGINT COMMENT 'All input lines.',
  loaded BIGINT COMMENT 'Valid records loaded.',
  rejected BIGINT COMMENT 'Invalid records rejected.',
  reasons STRING COMMENT 'JSON object of rejection reason to count.'
) COMMENT 'Latest load report for each benchmark run.';

CREATE OR REPLACE VIEW secondhand.measures.bench_coverage
COMMENT 'Answers and answer share per run and tool.' AS
SELECT run_id, tool, min(asked_at) AS asked_at, count(*) AS asked, count_if(ok) AS ok,
       count_if(ok) / nullif(count(*), 0) AS ok_share
FROM secondhand.measures.bench_record
GROUP BY run_id, tool;

CREATE OR REPLACE VIEW secondhand.measures.bench_speed
COMMENT 'First and full answer times in milliseconds, with the number asked.' AS
SELECT run_id, tool, min(asked_at) AS asked_at, count(*) AS n,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY first_ms) AS first_p50_ms,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY first_ms) AS first_p95_ms,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY full_ms) AS full_p50_ms,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY full_ms) AS full_p95_ms
FROM secondhand.measures.bench_record
GROUP BY run_id, tool;

CREATE OR REPLACE VIEW secondhand.measures.bench_breadth
COMMENT 'Median sites and fact kinds per answered question, including zero.' AS
WITH site_counts AS (
  SELECT run_id, tool, item_id, question, count(DISTINCT site) AS sites
  FROM secondhand.measures.bench_site GROUP BY run_id, tool, item_id, question
), fact_counts AS (
  SELECT run_id, tool, item_id, question, count(DISTINCT CASE WHEN count > 0 THEN kind END) AS facts
  FROM secondhand.measures.bench_fact GROUP BY run_id, tool, item_id, question
), answers AS (
  SELECT r.run_id, r.tool, r.asked_at, r.ok, CASE WHEN r.ok THEN coalesce(s.sites, 0) END AS sites, CASE WHEN r.ok THEN coalesce(f.facts, 0) END AS facts
  FROM secondhand.measures.bench_record r
  LEFT JOIN site_counts s ON r.run_id = s.run_id AND r.tool = s.tool AND r.item_id = s.item_id AND r.question = s.question
  LEFT JOIN fact_counts f ON r.run_id = f.run_id AND r.tool = f.tool AND r.item_id = f.item_id AND r.question = f.question
)
SELECT run_id, tool, min(asked_at) AS asked_at, count_if(ok) AS n,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY sites) AS median_sites,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY facts) AS median_facts
FROM answers GROUP BY run_id, tool;

CREATE OR REPLACE VIEW secondhand.measures.bench_cited
COMMENT 'Numbers shown and the share with a citation identifier.' AS
SELECT r.run_id, r.tool, min(r.asked_at) AS asked_at, count(n.name) AS numbers_shown,
       count_if(n.citation_id IS NOT NULL AND length(trim(n.citation_id)) > 0) AS with_citation,
       count_if(n.citation_id IS NOT NULL AND length(trim(n.citation_id)) > 0) / nullif(count(n.name), 0) AS share
FROM secondhand.measures.bench_record r
LEFT JOIN secondhand.measures.bench_number n ON r.run_id = n.run_id AND r.tool = n.tool AND r.item_id = n.item_id AND r.question = n.question
GROUP BY r.run_id, r.tool;

CREATE OR REPLACE VIEW secondhand.measures.bench_runs
COMMENT 'Each run and tool with its answer share and median times.' AS
SELECT run_id, tool, count(*) AS records, min(asked_at) AS asked_at,
       count_if(ok) / nullif(count(*), 0) AS ok_share,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY first_ms) AS first_p50_ms,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY full_ms) AS full_p50_ms
FROM secondhand.measures.bench_record
GROUP BY run_id, tool;
