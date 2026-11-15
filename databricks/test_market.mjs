// Offline DBX-A1 contracts. The lead runs 15_market_check.sql on the workspace.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { statements } from './run-sql.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const sql = () => read('databricks/sql/15_market.sql');
const parts = () => statements(sql());
const definition = (kind, name) => {
  const found = parts().find(s => s.startsWith(`CREATE OR REPLACE ${kind} secondhand.market.${name}`));
  assert.ok(found, `missing ${kind.toLowerCase()} ${name}`);
  return found;
};
const columns = text => text.split(',').map(s => s.trim().split(/\s+/)[0]);
const returns = {
  asks: ['site', 'n', 'p10_cents', 'p50_cents', 'p90_cents', 'likes_per_listing', 'sold_share', 'as_of'],
  term_trend: ['week', 'site', 'n', 'p50_cents', 'likes_per_listing', 'as_of'],
  top_terms: ['term', 'site', 'n', 'p50_cents', 'likes_per_listing', 'as_of'],
  sell_through: ['site', 'kind', 'n_listed', 'n_sold', 'sold_share', 'median_days_to_sell', 'as_of'],
  coverage_now: ['site', 'kind', 'rows', 'oldest_read', 'newest_read'],
};
const signatures = {
  asks: 'term STRING, site STRING, days INT', term_trend: 'term STRING, site STRING, weeks INT',
  top_terms: 'kind STRING, site STRING, days INT, k INT', sell_through: 'kind STRING, site STRING', coverage_now: '',
};

test('both views expose exactly packet 78 columns, in order', () => {
  for (const [name, expected] of Object.entries({
    listing_obs: ['site', 'kind', 'brand_norm', 'title_terms', 'condition', 'price_cents', 'likes', 'listed_at', 'sold', 'sold_at', 'read_at', 'observation_id'],
    coverage: ['site', 'kind', 'rows', 'oldest_read', 'newest_read'],
  })) {
    const body = definition('VIEW', name);
    assert.deepEqual(columns(body.match(/\(([^)]*)\)\s*COMMENT/s)?.[1] ?? ''), expected, name);
  }
});

for (const [name, expected] of Object.entries(returns)) test(`${name}: exact arguments, returned columns, count and freshness`, () => {
  const body = definition('FUNCTION', name);
  assert.equal(body.match(/\(([^)]*)\)\s*RETURNS/s)?.[1].trim(), signatures[name]);
  assert.deepEqual(columns(body.match(/RETURNS TABLE\s*\(([^)]*)\)/s)?.[1] ?? ''), expected);
  const selection = body.slice(body.lastIndexOf('\nSELECT ') + 8).split(/\bFROM\b/)[0];
  // coverage_now has its final SELECT on the RETURN line.
  const projection = name === 'coverage_now' ? body.split('RETURN SELECT ')[1].split(' FROM ')[0] : selection;
  assert.deepEqual(projection.split(',').map(field => field.trim().match(/\bAS (\w+)$/)?.[1] ?? field.trim()), expected, `${name}: output expressions changed column order`);
  const count = name === 'sell_through' ? 'n_listed' : name === 'coverage_now' ? 'rows' : 'n';
  const freshness = name === 'coverage_now' ? 'newest_read' : 'as_of';
  assert.ok(expected.includes(count) && expected.includes(freshness));
  assert.doesNotMatch(body, /secondhand\.core\.(?:observation|evidence|param)\b/i, 'functions must use governed views and the shared param reader');
  assert.match(body, /secondhand\.market\.(?:listing_obs|coverage)\b/);
  // Coverage has counts and read timestamps only, so it inherits the coverage view guard.
  if (name !== 'coverage_now') assert.match(body, /secondhand\.market\.market_min_n\(\)/);
});

test('listing admission joins evidence and excludes denied rights, Dupe, examples and expired reads', () => {
  const body = definition('VIEW', 'listing_obs');
  for (const rule of [/JOIN secondhand\.core\.evidence e ON o\.evidence_id = e\.id/, /e\.may_model = true/, /o\.site <> 'dupe'/, /o\.data LIKE 'live:%'/, /o\.kind = 'listing'/, /o\.keep_until IS NULL OR o\.keep_until > current_timestamp\(\)/]) assert.match(body, rule);
  assert.equal((sql().match(/FROM secondhand\.core\.observation\b/g) ?? []).length, 1);
  assert.match(definition('VIEW', 'coverage'), /FROM secondhand\.market\.listing_obs/);
});

test('payload extraction uses the real Row keys, with nullable typed fields and Unicode title words', () => {
  const body = definition('VIEW', 'listing_obs');
  for (const key of ['title', 'category', 'brand', 'condition', 'price_cents', 'likes', 'listed_at', 'sold', 'sold_date']) assert.ok(body.includes(`get_json_object(o.payload, '$.${key}')`), key);
  assert.doesNotMatch(body, /\$\.(?:price|sold_at|listed_date)'/);
  for (const [key, type] of [['price_cents', 'BIGINT'], ['likes', 'BIGINT'], ['listed_at', 'TIMESTAMP'], ['sold', 'BOOLEAN'], ['sold_date', 'TIMESTAMP']]) assert.ok(body.includes(`try_cast(get_json_object(o.payload, '$.${key}') AS ${type})`), key);
  assert.match(body, /filter\(split\(lower\(coalesce\(get_json_object\(o.payload, '\$\.title'\), ''\)\), r'\[\^\\p\{L\}\\p\{N\}\]\+'\), word -> word <> ''\)/);
  assert.match(body, /CASE WHEN get_json_object\(o.payload, '\$\.title'\) IS NULL THEN cast\(NULL AS ARRAY<STRING>\)/, 'missing title must remain NULL');
});

test('one global champion reader parses the JSON scalar and falls back to prior 8', () => {
  const body = definition('FUNCTION', 'market_min_n');
  assert.match(body, /RETURNS INT/);
  assert.match(body, /coalesce\(\(SELECT cast\(get_json_object\(value_or_hyperparams, '\$'\) AS INT\)/);
  for (const clause of ["name = 'market_min_n'", "scope = '{}'", "status = 'champion'", 'ORDER BY version DESC', 'LIMIT 1), 8)']) assert.ok(body.includes(clause), clause);
  assert.equal((sql().match(/FROM secondhand\.core\.param\b/g) ?? []).length, 2);
});

test('all figures are suppressed below the count guard while counts and as_of survive', () => {
  for (const [name, figures] of Object.entries({ asks: ['p10_cents', 'p50_cents', 'p90_cents', 'likes_per_listing', 'sold_share'], term_trend: ['p50_cents', 'likes_per_listing'], top_terms: ['p50_cents', 'likes_per_listing'], sell_through: ['n_sold', 'sold_share', 'median_days_to_sell'] })) {
    const body = definition('FUNCTION', name);
    const count = name === 'sell_through' ? 'n_listed' : 'n';
    for (const figure of figures) assert.match(body, new RegExp(`CASE WHEN ${count} < secondhand\\.market\\.market_min_n\\(\\) THEN NULL ELSE [^\\n]+ END AS ${figure}\\b`), `${name}.${figure}: missing min-n rule`);
    assert.doesNotMatch(body, new RegExp(`THEN NULL ELSE [^\\n]+ END AS (?:${count}|as_of)\\b`));
  }
  assert.match(definition('VIEW', 'coverage'), /CASE WHEN count\(\*\) < secondhand\.market\.market_min_n\(\) THEN NULL ELSE min\(read_at\) END AS oldest_read/);
  assert.match(definition('FUNCTION', 'coverage_now'), /SELECT site, kind, rows, oldest_read, newest_read FROM secondhand\.market\.coverage/);
});

test('exact percentiles, decimal likes, sold shares and elapsed sale days retain their units', () => {
  const asks = definition('FUNCTION', 'asks');
  for (const p of ['0.1', '0.5', '0.9']) assert.ok(asks.includes(`cast(round(percentile(price_cents, ${p})) AS BIGINT)`), p);
  for (const name of ['asks', 'term_trend', 'top_terms']) assert.match(definition('FUNCTION', name), /avg\(cast\(likes AS DOUBLE\)\)/);
  for (const name of ['asks', 'sell_through']) assert.match(definition('FUNCTION', name), /cast\(count_if\(sold = true\) AS DOUBLE\) \/ nullif\(count\(\*\), 0\)/);
  assert.match(definition('FUNCTION', 'sell_through'), /timestampdiff\(SECOND, listed_at, sold_at\) \/ 86400\.0/);
});

test('term matching needs every word and top_terms counts a repeated word once per listing', () => {
  for (const name of ['asks', 'term_trend']) {
    const body = definition('FUNCTION', name);
    assert.match(body, /size\(words\) > 0 AND forall\(words, word -> array_contains\(o\.title_terms, word\)\)/);
  }
  const top = definition('FUNCTION', 'top_terms');
  assert.match(top, /explode\(array_distinct\(o\.title_terms\)\)/);
  assert.match(top, /row_number\(\) OVER \(ORDER BY n DESC, term\)/);
  assert.match(top, /position <= top_terms\.k/);
});

test('all-site answers aggregate once, parameters are qualified, and windows use read time', () => {
  for (const name of ['asks', 'term_trend', 'top_terms', 'sell_through']) {
    const body = definition('FUNCTION', name);
    assert.ok(body.includes(`(${name}.site = 'all' OR o.site = ${name}.site)`), name);
    assert.ok(body.includes(`${name}.site AS site`), name);
    assert.doesNotMatch(body, /GROUP BY[^\n]*\bo\.site\b/);
    if (name !== 'sell_through') {
      assert.match(body, /o\.read_at >= timestampadd\(/);
      assert.match(body, /o\.read_at <= current_timestamp\(\)/);
    }
  }
  assert.match(definition('FUNCTION', 'term_trend'), /date_trunc\('WEEK', o\.read_at\) AS week/);
});

test('every view and function describes its question and rights rule', () => {
  for (const body of parts().filter(s => /^CREATE OR REPLACE (VIEW|FUNCTION)/.test(s))) {
    assert.match(body, /COMMENT '[^']+may_model[^']+Dupe[^']+live:/, body.split('\n')[0]);
  }
});

test('SQL files have no statement separators inside literals or comments', () => {
  for (const path of ['databricks/sql/15_market.sql', 'databricks/sql/15_market_check.sql']) {
    const text = read(path);
    for (const literal of text.matchAll(/(?:r)?'(?:''|[^'])*'/g)) assert.ok(!literal[0].includes(';'), `${path}: separator in literal`);
    for (const line of text.split('\n')) if (line.trim().startsWith('--')) assert.ok(!line.includes(';'), `${path}: separator in comment`);
    assert.equal(statements(text).length, text.split(';').length - 1, path);
  }
});

test('regeneration matches both committed SQL files and shares all function bodies', t => {
  const dir = mkdtempSync(join(tmpdir(), 'market-sql-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  execFileSync(process.execPath, ['databricks/market-sql.mjs', dir], { cwd: root });
  for (const file of ['15_market.sql', '15_market_check.sql']) assert.equal(readFileSync(join(dir, file), 'utf8'), read(`databricks/sql/${file}`), `${file}: regenerate with node databricks/market-sql.mjs`);
  const check = statements(read('databricks/sql/15_market_check.sql'));
  for (const body of parts().filter(s => s.startsWith('CREATE OR REPLACE FUNCTION'))) {
    const copy = body.replaceAll('secondhand.market.', 'secondhand.market_check.').replaceAll('secondhand.core.param', 'secondhand.market_check.param');
    assert.ok(check.includes(copy), `${body.split('\n')[0]}: scratch body differs`);
  }
});

test('seeded workspace check asserts high and low counts, exact prices, all sites, all functions and param changes', () => {
  const check = read('databricks/sql/15_market_check.sql');
  assert.match(check, /CREATE TABLE secondhand\.market_check\.listing_obs/);
  assert.match(check, /range\(1, 11\)/);
  assert.match(check, /range\(1, 4\)/);
  for (const name of Object.keys(returns)) assert.ok(check.includes(`FROM secondhand.market_check.${name}(`), `${name}: missing workspace assertion`);
  for (const clause of ["asks('vintage denim', 'A', 30)", "asks('vintage denim', 'B', 30)", "asks('vintage denim', 'all', 30)", 'n = 10 AND p50_cents = 550', 'n = 3 AND p50_cents IS NULL', 'raise_error(', "value_or_hyperparams = '11'", 'DROP SCHEMA secondhand.market_check CASCADE;']) assert.ok(check.includes(clause), clause);
  assert.doesNotMatch(check, /secondhand\.core\./, 'scratch check must not change or read production data');
});

test('governance market SQL task waits for sources and uses the existing workspace pattern', () => {
  const task = read('deploy/resources/governance.yml').match(/- task_key: market\n([\s\S]*?)(?=\n        - task_key:|$)/)?.[1] ?? '';
  for (const clause of ['depends_on: [{ task_key: sources }]', 'sql_task:', 'warehouse_id: ${var.warehouse_id}', 'path: ../../databricks/sql/15_market.sql', 'source: WORKSPACE']) assert.ok(task.includes(clause), `market: missing ${clause}`);
});

test('unknown API principal is called out without inventing broad EXECUTE grants', () => {
  assert.match(sql(), /-- Missing: API principal for GRANT EXECUTE ON FUNCTION/);
  assert.doesNotMatch(sql(), /^GRANT /m);
});

test('similar group filters kind and brand, counts distinct shared terms, guards and orders matches', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE listing_obs (site TEXT, kind TEXT, brand_norm TEXT, title_terms TEXT, read_at TEXT, observation_id TEXT)');
    let minimum = 2, countMinimum = 2;
    db.function('similar_min_shared_terms', () => minimum);
    db.function('market_min_n', () => countMinimum);
    db.function('array_intersect', (a, b) => a === null || b === null ? null : JSON.stringify([...new Set(JSON.parse(a))].filter(t => JSON.parse(b).includes(t))));
    db.function('size', a => a === null ? null : JSON.parse(a).length);
    const insert = db.prepare('INSERT INTO listing_obs VALUES (?, ?, ?, ?, ?, ?)');
    for (const [id, kind, brand, terms] of [
      ['off_two', 'clothes', 'beta', ['denim', 'jacket']], ['off_three', 'clothes', 'gamma', ['denim', 'jacket', 'blue']],
      ['same', 'clothes', ' ALPHA ', ['denim', 'jacket', 'blue']], ['other_kind', 'shoes', 'beta', ['denim', 'jacket', 'blue']],
      ['repeated', 'clothes', 'beta', ['denim', 'denim']], ['unknown', 'clothes', null, ['denim', 'jacket']],
      ['blank', 'clothes', ' ', ['denim', 'jacket']], ['no_title', 'clothes', 'beta', null],
    ]) insert.run('A', kind, brand, terms === null ? null : JSON.stringify(terms), '2026-11-15 00:00:00', id);
    const body = definition('FUNCTION', 'similar_group');
    assert.match(body, /COMMENT '[^']+may_model[^']+Dupe[^']+live:/);
    assert.doesNotMatch(body, /secondhand\.core\./);
    const query = body.split('\nRETURN\n')[1].replaceAll('secondhand.market.', '')
      .replaceAll('similar_group.kind', '$kind').replaceAll('similar_group.brand', '$brand').replaceAll('similar_group.title_terms', '$terms');
    const run = (brand = 'Alpha', terms = ['denim', 'jacket', 'blue', 'denim']) => db.prepare(query).all({ kind: 'clothes', brand, terms: terms === null ? null : JSON.stringify(terms) });
    assert.deepEqual(run().map(row => [row.observation_id, row.shared_terms, row.n, row.as_of]), [
      ['off_three', 3, 2, '2026-11-15 00:00:00'], ['off_two', 2, 2, '2026-11-15 00:00:00'],
    ]);
    assert.deepEqual(run(null), []);
    assert.deepEqual(run(' '), []);
    assert.deepEqual(run('Alpha', []), []);
    assert.deepEqual(run('Alpha', null), []);
    minimum = 3;
    assert.deepEqual(run(), [], 'the group of one is below market_min_n');
    countMinimum = 1;
    assert.deepEqual(run().map(row => row.observation_id), ['off_three'], 'shared-term champion changes membership');
  } finally { db.close(); }
});

test('term-list tokenizer is generated from the listing tokenizer and shared-term param uses global champions', () => {
  const tokenizer = definition('FUNCTION', 'title_terms');
  const expression = tokenizer.split('\nRETURN ')[1];
  assert.ok(definition('VIEW', 'listing_obs').includes(expression.replace('title_terms.title', "get_json_object(o.payload, '$.title')")));
  const minimum = definition('FUNCTION', 'similar_min_shared_terms');
  for (const clause of ["name = 'similar_min_shared_terms'", "scope = '{}'", "status = 'champion'", 'ORDER BY version DESC', 'LIMIT 1), 2)']) assert.ok(minimum.includes(clause), clause);
});

test('seeded similar-group proof admits off-brand rows and refuses same-brand and other-kind rows', () => {
  const check = read('databricks/sql/15_market_check.sql');
  for (const clause of ["similar_group('clothes', 'test', array('vintage', 'denim', 'denim'))", "'off_brand_'", "'same_brand'", "'other_kind'", 'shared_terms = 2 AND n = 8', "name = 'similar_min_shared_terms'", 'similar group shared-term champion']) assert.ok(check.includes(clause), clause);
});
