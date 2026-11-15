// DBX-A1, packet 78. Regenerate: node databricks/market-sql.mjs [output-directory]
// Offline proof: node --test --test-concurrency=1 databricks/test_market.mjs
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createLog, consoleSink } from '../log/index.js';

const rights = 'Only may_model true evidence, never Dupe, live: reads within retention.';
const words = expression => String.raw`filter(split(lower(coalesce(${expression}, '')), r'[^\p{L}\p{N}]+'), word -> word <> '')`;
const listingColumns = 'site, kind, brand_norm, title_terms, condition, price_cents, likes, listed_at, sold, sold_at, read_at, observation_id';

const listing = `CREATE OR REPLACE VIEW secondhand.market.listing_obs
(${listingColumns})
COMMENT 'Stored listing reads with nullable page fields. ${rights}'
AS SELECT
  o.site AS site,
  get_json_object(o.payload, '$.category') AS kind,
  lower(trim(get_json_object(o.payload, '$.brand'))) AS brand_norm,
  CASE WHEN get_json_object(o.payload, '$.title') IS NULL THEN cast(NULL AS ARRAY<STRING>)
    ELSE ${words("get_json_object(o.payload, '$.title')")} END AS title_terms,
  get_json_object(o.payload, '$.condition') AS condition,
  try_cast(get_json_object(o.payload, '$.price_cents') AS BIGINT) AS price_cents,
  try_cast(get_json_object(o.payload, '$.likes') AS BIGINT) AS likes,
  try_cast(get_json_object(o.payload, '$.listed_at') AS TIMESTAMP) AS listed_at,
  try_cast(get_json_object(o.payload, '$.sold') AS BOOLEAN) AS sold,
  try_cast(get_json_object(o.payload, '$.sold_date') AS TIMESTAMP) AS sold_at,
  o.observed_at AS read_at,
  o.id AS observation_id
FROM secondhand.core.observation o
JOIN secondhand.core.evidence e ON o.evidence_id = e.id
WHERE e.may_model = true AND o.site <> 'dupe' AND o.data LIKE 'live:%'
  AND o.kind = 'listing'
  AND (o.keep_until IS NULL OR o.keep_until > current_timestamp());`;

const minimum = (schema, param) => `CREATE OR REPLACE FUNCTION ${schema}.market_min_n()
RETURNS INT
COMMENT 'Minimum count from the global champion scalar, or prior 8. ${rights}'
RETURN coalesce((SELECT cast(get_json_object(value_or_hyperparams, '$') AS INT)
  FROM ${param}
  WHERE name = 'market_min_n' AND scope = '{}' AND status = 'champion'
  ORDER BY version DESC
  LIMIT 1), 8);`;

const coverage = schema => `CREATE OR REPLACE VIEW ${schema}.coverage
(site, kind, rows, oldest_read, newest_read)
COMMENT 'Stored listing counts and read dates by site and page category. ${rights}'
AS SELECT site, kind, count(*) AS rows,
  CASE WHEN count(*) < ${schema}.market_min_n() THEN NULL ELSE min(read_at) END AS oldest_read,
  max(read_at) AS newest_read
FROM ${schema}.listing_obs
GROUP BY site, kind;`;

const figure = (schema, name, count = 'n') => `CASE WHEN ${count} < ${schema}.market_min_n() THEN NULL ELSE ${name} END AS ${name}`;
const figures = (schema, names, count) => names.map(name => `  ${figure(schema, name, count)}`).join(',\n');
const match = name => `(${name}.site = 'all' OR o.site = ${name}.site)
    AND size(words) > 0 AND forall(words, word -> array_contains(o.title_terms, word))`;
const window = (name, unit, size) => `o.read_at >= timestampadd(${unit}, -${name}.${size}, current_timestamp())
    AND o.read_at <= current_timestamp()`;

const functions = schema => `CREATE OR REPLACE FUNCTION ${schema}.asks(term STRING, site STRING, days INT)
RETURNS TABLE (site STRING, n BIGINT, p10_cents BIGINT, p50_cents BIGINT, p90_cents BIGINT, likes_per_listing DOUBLE, sold_share DOUBLE, as_of TIMESTAMP)
COMMENT 'Asking-price percentiles in whole cents, reported likes and sold share over listing reads in the day window. ${rights}'
RETURN
WITH terms AS (SELECT ${words('asks.term')} AS words),
stats AS (
  SELECT count(*) AS n,
    cast(round(percentile(price_cents, 0.1)) AS BIGINT) AS p10_cents,
    cast(round(percentile(price_cents, 0.5)) AS BIGINT) AS p50_cents,
    cast(round(percentile(price_cents, 0.9)) AS BIGINT) AS p90_cents,
    avg(cast(likes AS DOUBLE)) AS likes_per_listing,
    cast(count_if(sold = true) AS DOUBLE) / nullif(count(*), 0) AS sold_share,
    max(o.read_at) AS as_of
  FROM ${schema}.listing_obs o CROSS JOIN terms
  WHERE ${match('asks')}
    AND ${window('asks', 'DAY', 'days')}
)
SELECT asks.site AS site, n,
${figures(schema, ['p10_cents', 'p50_cents', 'p90_cents', 'likes_per_listing', 'sold_share'])},
  as_of
FROM stats;

CREATE OR REPLACE FUNCTION ${schema}.term_trend(term STRING, site STRING, weeks INT)
RETURNS TABLE (week TIMESTAMP, site STRING, n BIGINT, p50_cents BIGINT, likes_per_listing DOUBLE, as_of TIMESTAMP)
COMMENT 'Weekly median asks in whole cents and reported likes for a title term in the week window. ${rights}'
RETURN
WITH terms AS (SELECT ${words('term_trend.term')} AS words),
stats AS (
  SELECT date_trunc('WEEK', o.read_at) AS week, count(*) AS n,
    cast(round(percentile(price_cents, 0.5)) AS BIGINT) AS p50_cents,
    avg(cast(likes AS DOUBLE)) AS likes_per_listing,
    max(o.read_at) AS as_of
  FROM ${schema}.listing_obs o CROSS JOIN terms
  WHERE ${match('term_trend')}
    AND ${window('term_trend', 'WEEK', 'weeks')}
  GROUP BY date_trunc('WEEK', o.read_at)
)
SELECT week, term_trend.site AS site, n,
${figures(schema, ['p50_cents', 'likes_per_listing'])},
  as_of
FROM stats;

CREATE OR REPLACE FUNCTION ${schema}.top_terms(kind STRING, site STRING, days INT, k INT)
RETURNS TABLE (term STRING, site STRING, n BIGINT, p50_cents BIGINT, likes_per_listing DOUBLE, as_of TIMESTAMP)
COMMENT 'The k most frequent title words by listing count for a page category and day window, with median asks. ${rights}'
RETURN
WITH expanded AS (
  SELECT explode(array_distinct(o.title_terms)) AS term, o.price_cents, o.likes, o.read_at
  FROM ${schema}.listing_obs o
  WHERE (top_terms.site = 'all' OR o.site = top_terms.site)
    AND o.kind = top_terms.kind
    AND ${window('top_terms', 'DAY', 'days')}
),
stats AS (
  SELECT term, count(*) AS n,
    cast(round(percentile(price_cents, 0.5)) AS BIGINT) AS p50_cents,
    avg(cast(likes AS DOUBLE)) AS likes_per_listing,
    max(read_at) AS as_of
  FROM expanded GROUP BY term
),
ranked AS (SELECT *, row_number() OVER (ORDER BY n DESC, term) AS position FROM stats)
SELECT term, top_terms.site AS site, n,
${figures(schema, ['p50_cents', 'likes_per_listing'])},
  as_of
FROM ranked WHERE position <= top_terms.k
ORDER BY n DESC, term;

CREATE OR REPLACE FUNCTION ${schema}.sell_through(kind STRING, site STRING)
RETURNS TABLE (site STRING, kind STRING, n_listed BIGINT, n_sold BIGINT, sold_share DOUBLE, median_days_to_sell DOUBLE, as_of TIMESTAMP)
COMMENT 'Observed sold over listed reads for a page category, plus median elapsed days from listing to sale. n_listed is the guard count. ${rights}'
RETURN
WITH stats AS (
  SELECT count(*) AS n_listed, count_if(sold = true) AS n_sold,
    cast(count_if(sold = true) AS DOUBLE) / nullif(count(*), 0) AS sold_share,
    percentile(CASE WHEN sold = true AND sold_at >= listed_at
      THEN timestampdiff(SECOND, listed_at, sold_at) / 86400.0 END, 0.5) AS median_days_to_sell,
    max(o.read_at) AS as_of
  FROM ${schema}.listing_obs o
  WHERE (sell_through.site = 'all' OR o.site = sell_through.site)
    AND o.kind = sell_through.kind
)
SELECT sell_through.site AS site, sell_through.kind AS kind, n_listed,
${figures(schema, ['n_sold', 'sold_share', 'median_days_to_sell'], 'n_listed')},
  as_of
FROM stats;

CREATE OR REPLACE FUNCTION ${schema}.coverage_now()
RETURNS TABLE (site STRING, kind STRING, rows BIGINT, oldest_read TIMESTAMP, newest_read TIMESTAMP)
COMMENT 'Current coverage by site and page category, with rows as count and newest_read as freshness. ${rights}'
RETURN SELECT site, kind, rows, oldest_read, newest_read FROM ${schema}.coverage;`;

// count(*) also catches an accidentally empty table-function result.
const check = (label, from, predicate, count = 1) => `SELECT CASE WHEN count(*) = ${count} AND count_if(${predicate}) = ${count}
  THEN true ELSE raise_error('DBX-A1 ${label}') END AS passed
FROM secondhand.market_check.${from};`;

const seed = `CREATE SCHEMA secondhand.market_check COMMENT 'Disposable DBX-A1 seeded proof, removed on success.';

CREATE TABLE secondhand.market_check.param (name STRING, scope STRING, status STRING, value_or_hyperparams STRING, version INT);
INSERT INTO secondhand.market_check.param VALUES
  ('market_min_n', '{}', 'champion', '8', 1),
  ('market_min_n', '{}', 'challenger', '100', 2),
  ('market_min_n', '{"site":"A"}', 'champion', '100', 3);

CREATE TABLE secondhand.market_check.listing_obs (
  site STRING, kind STRING, brand_norm STRING, title_terms ARRAY<STRING>, condition STRING,
  price_cents BIGINT, likes BIGINT, listed_at TIMESTAMP, sold BOOLEAN, sold_at TIMESTAMP,
  read_at TIMESTAMP, observation_id STRING
);
INSERT INTO secondhand.market_check.listing_obs
SELECT 'A', 'clothes', 'test', array('vintage', 'denim', 'denim'), 'used', id * 100, id,
  timestampadd(DAY, -10, date_trunc('WEEK', current_timestamp())), id <= 4,
  CASE WHEN id <= 4 THEN timestampadd(DAY, -8, date_trunc('WEEK', current_timestamp())) END,
  date_trunc('WEEK', current_timestamp()), concat('check_A_', id)
FROM range(1, 11);
INSERT INTO secondhand.market_check.listing_obs
SELECT 'B', 'clothes', 'test', array('vintage', 'denim', 'denim'), 'used', id * 100, id,
  timestampadd(DAY, -10, date_trunc('WEEK', current_timestamp())), id = 1,
  CASE WHEN id = 1 THEN timestampadd(DAY, -8, date_trunc('WEEK', current_timestamp())) END,
  date_trunc('WEEK', current_timestamp()), concat('check_B_', id)
FROM range(1, 4);`;

const checks = () => [
  check('asks A count and figures', "asks('vintage denim', 'A', 30)", "site = 'A' AND n = 10 AND p50_cents = 550 AND p10_cents = 190 AND p90_cents = 910 AND likes_per_listing = 5.5 AND sold_share = 0.4 AND as_of IS NOT NULL"),
  check('asks B suppression preserves count', "asks('vintage denim', 'B', 30)", "site = 'B' AND n = 3 AND p50_cents IS NULL AND p10_cents IS NULL AND p90_cents IS NULL AND likes_per_listing IS NULL AND sold_share IS NULL AND as_of IS NOT NULL"),
  check('asks all combines sites', "asks('vintage denim', 'all', 30)", "site = 'all' AND n = 13 AND p50_cents = 400 AND as_of IS NOT NULL"),
  check('asks every word required', "asks('vintage missing', 'A', 30)", 'n = 0 AND p50_cents IS NULL AND as_of IS NULL'),
  check('asks empty term', "asks('', 'A', 30)", 'n = 0 AND p50_cents IS NULL'),
  check('trend A', "term_trend('vintage denim', 'A', 4)", "site = 'A' AND week = date_trunc('WEEK', current_timestamp()) AND n = 10 AND p50_cents = 550 AND likes_per_listing = 5.5 AND as_of IS NOT NULL"),
  check('trend B', "term_trend('vintage denim', 'B', 4)", 'n = 3 AND p50_cents IS NULL AND likes_per_listing IS NULL AND as_of IS NOT NULL'),
  check('trend all', "term_trend('vintage denim', 'all', 4)", "site = 'all' AND n = 13 AND p50_cents = 400"),
  check('top terms A counts repeated word once', "top_terms('clothes', 'A', 30, 1)", "term = 'denim' AND site = 'A' AND n = 10 AND p50_cents = 550 AND likes_per_listing = 5.5 AND as_of IS NOT NULL"),
  check('top terms B', "top_terms('clothes', 'B', 30, 1)", "term = 'denim' AND n = 3 AND p50_cents IS NULL AND likes_per_listing IS NULL"),
  check('top terms all', "top_terms('clothes', 'all', 30, 2)", "site = 'all' AND n = 13 AND p50_cents = 400", 2),
  check('sell through A', "sell_through('clothes', 'A')", "site = 'A' AND kind = 'clothes' AND n_listed = 10 AND n_sold = 4 AND sold_share = 0.4 AND median_days_to_sell = 2.0 AND as_of IS NOT NULL"),
  check('sell through B', "sell_through('clothes', 'B')", 'n_listed = 3 AND n_sold IS NULL AND sold_share IS NULL AND median_days_to_sell IS NULL AND as_of IS NOT NULL'),
  check('sell through all', "sell_through('clothes', 'all')", "site = 'all' AND n_listed = 13 AND n_sold = 5 AND abs(sold_share - 5.0 / 13) < 0.000001 AND median_days_to_sell = 2.0"),
  check('coverage preserves low counts and freshness', 'coverage_now()', "kind = 'clothes' AND newest_read IS NOT NULL AND ((site = 'A' AND rows = 10 AND oldest_read IS NOT NULL) OR (site = 'B' AND rows = 3 AND oldest_read IS NULL))", 2),
  "UPDATE secondhand.market_check.param SET value_or_hyperparams = '11' WHERE scope = '{}' AND status = 'champion';",
  check('champion update changes guard', "asks('vintage denim', 'A', 30)", 'n = 10 AND p50_cents IS NULL'),
  'DELETE FROM secondhand.market_check.param;',
  check('missing param uses prior', "asks('vintage denim', 'A', 30)", 'n = 10 AND p50_cents = 550'),
  'DROP SCHEMA secondhand.market_check CASCADE;',
].join('\n\n');

export function marketSql() {
  return {
    '15_market.sql': `-- Generated by databricks/market-sql.mjs from packet 78 DBX-A1 and spec/product.md section 3.
-- Missing: API principal for GRANT EXECUTE ON FUNCTION on these five table functions and market_min_n.

${listing}

${minimum('secondhand.market', 'secondhand.core.param')}

${coverage('secondhand.market')}

${functions('secondhand.market')}\n`,
    '15_market_check.sql': `-- Generated by databricks/market-sql.mjs, using the production function bodies.
-- Run on the workspace later, exclusively, with no existing secondhand.market_check schema.
-- A failure leaves the scratch schema for inspection. Success drops it.

${seed}

${minimum('secondhand.market_check', 'secondhand.market_check.param')}

${coverage('secondhand.market_check')}

${functions('secondhand.market_check')}

${checks()}\n`,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const log = createLog({ src: 'databricks.market-sql', build: 'DBX-A1', sink: consoleSink });
  try {
    const directory = process.argv[2] ?? fileURLToPath(new URL('./sql/', import.meta.url));
    log.note('Generate market SQL', { destination: process.argv[2] ? 'selected directory' : 'databricks/sql' });
    for (const [file, sql] of Object.entries(marketSql())) {
      writeFileSync(join(directory, file), sql);
      log.note('Generated SQL file', { file, bytes: Buffer.byteLength(sql) });
    }
    log.end();
  } catch (error) {
    log.error('market SQL generation failed', error);
    log.end();
    throw error;
  }
}
