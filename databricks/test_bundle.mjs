// Local contracts only; the lead validates and runs the bundle on the workspace.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { statements } from './run-sql.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const bundle = () => read('deploy/databricks.yml');
const market = (name) => read(`databricks/pipelines/market/${name}.sql`);
const resourceFiles = () => ['deploy/databricks.yml', ...readdirSync(join(root, 'deploy/resources')).filter(f => f.endsWith('.yml')).map(f => `deploy/resources/${f}`)];
const block = (text, key, indent) => text.match(new RegExp(`^${' '.repeat(indent)}${key}:\\n([\\s\\S]*?)(?=^ {0,${indent}}\\S|$(?![\\s\\S]))`, 'm'))?.[1] ?? '';

const validatePaths = (text, file, base = root) => {
  const pipelines = block(text, 'pipelines', 2);
  for (const match of pipelines.matchAll(/\b(?:path|include):\s*\[?["']?([^\s,"'\[\]}]+)/g)) {
    assert.doesNotMatch(match[1], /(^|[^*])\*(?!\*)/, `${file}: pipeline libraries require a double asterisk '**'`);
  }
  let paths = 0;
  // Minimal fallback when yaml is absent: inspect all supported path keys, including flow mappings.
  for (const match of text.matchAll(/\b(python_file|path|include):\s*\[?["']?([^\s,"'\[\]}]+)/g)) {
    const value = match[2];
    if (match[1] === 'include' && !value.includes('*')) continue;
    const target = resolve(base, dirname(file), value);
    if (value.includes('*')) {
      const folder = target.slice(0, target.indexOf('*')).replace(/[\\/]$/, '');
      assert.ok(existsSync(folder), `${file}: glob folder missing: ${value}`);
      const suffix = value.endsWith('/**') ? '.sql' : target.slice(target.lastIndexOf('*') + 1);
      assert.ok(readdirSync(folder, { withFileTypes: true }).some(f => f.isFile() && f.name.endsWith(suffix)), `${file}: empty glob: ${value}`);
    } else assert.ok(existsSync(target), `${file}: missing path: ${value}`);
    paths++;
  }
  return paths;
};

test('pipeline glob validation rejects single stars in every library and requires SQL', (t) => {
  const base = mkdtempSync(join(tmpdir(), 'pipeline-glob-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const pipeline = (value) => `resources:\n  pipelines:\n    first:\n      libraries:\n        - glob: { include: "./**" }\n    second:\n      libraries:\n        - glob: { include: "${value}" }\n`;
  writeFileSync(join(base, 'readme.txt'), 'no SQL');
  assert.throws(() => validatePaths(pipeline('./**'), 'pipeline.yml', base), /empty glob/);
  writeFileSync(join(base, 'source.sql'), 'SELECT 1;');
  assert.equal(validatePaths(pipeline('./**'), 'pipeline.yml', base), 2);
  for (const value of ['./*.sql', './**/*.sql', './*/**']) {
    assert.throws(() => validatePaths(pipeline(value), 'pipeline.yml', base), /double asterisk/);
  }
});

test('bundle uses secondhand and includes market resources and synced SQL', () => {
  assert.match(block(block(bundle(), 'variables', 0), 'catalog', 2), /default: secondhand\b/);
  assert.match(bundle(), /resources\/\*\.yml/);
  assert.match(bundle(), /- \.\.\/databricks/);
  assert.match(bundle(), /warehouse:\s*["']?Serverless Starter Warehouse/);
  assert.match(block(block(bundle(), 'variables', 0), 'market_schema', 2), /default: market\b/);
  assert.doesNotMatch(block(bundle(), 'resources', 0), /^  (schemas|volumes):/m);
});

test('all bundle task files and pipeline globs resolve relative to their declaring YAML', () => {
  const yamlDir = join(root, 'app/node_modules/yaml');
  const yaml = existsSync(yamlDir) ? createRequire(import.meta.url)(yamlDir) : null;
  let paths = 0;
  for (const file of resourceFiles()) {
    const text = read(file);
    if (yaml) assert.ok(yaml.parse(text), `${file}: invalid YAML`);
    paths += validatePaths(text, file);
  }
  assert.ok(paths >= 14, 'expected nine folds, purge, three SQL tasks and a pipeline glob');
});

test('nightly task DAG has no missing dependencies or cycles and is at most four wide', () => {
  const nightly = block(bundle(), 'nightly_fits', 4);
  const tasks = [...nightly.matchAll(/- task_key: (\w+)([\s\S]*?)(?=\n        - task_key:|$)/g)].map(m => ({ key: m[1], deps: [...m[2].matchAll(/task_key: (\w+)/g)].map(d => d[1]), text: m[2] }));
  assert.equal(tasks.length, 9);
  const done = new Set();
  while (done.size < tasks.length) {
    const ready = tasks.filter(t => !done.has(t.key) && t.deps.every(d => done.has(d)));
    assert.ok(ready.length, 'nightly_fits: cycle or unknown dependency');
    assert.ok(ready.length <= 4, `nightly_fits: ${ready.length} tasks ready together`);
    ready.forEach(t => done.add(t.key));
  }
  for (const t of tasks) assert.ok(t.text.includes(`parameters: [${t.key}, "--catalog", "\${var.catalog}", "--schema", "\${var.market_schema}"]`), `${t.key}: missing table location parameters`);
});

test('setup runs layout, tables, then governance on the existing warehouse', () => {
  const setup = read('deploy/resources/setup.yml');
  const tasks = [...setup.matchAll(/- task_key: (\w+)([\s\S]*?)(?=\n        - task_key:|$)/g)];
  assert.equal(tasks.length, 3);
  tasks.forEach((t, i) => {
    assert.ok(t[2].includes(['00_layout.sql', '01_tables.sql', '02_governance.sql'][i]));
    assert.match(t[2], /warehouse_id: \$\{var.warehouse_id\}/);
    assert.match(t[2], /source: WORKSPACE/);
    if (i) assert.ok(t[2].includes(`task_key: ${tasks[i - 1][1]}`));
  });
});

test('layout is idempotent, commented and split into exactly six complete statements', () => {
  const sql = read('databricks/sql/00_layout.sql');
  const parts = statements(sql);
  assert.equal(parts.length, 6);
  assert.equal((sql.match(/;\s*$/gm) ?? []).length, 6);
  for (const part of parts) {
    assert.match(part, /^CREATE (SCHEMA|VOLUME) IF NOT EXISTS secondhand\./);
    assert.match(part, /COMMENT\s+'[^']+'/);
    assert.doesNotMatch(part, /;/);
  }
  for (const name of ['raw', 'market', 'measures']) assert.ok(parts.some(p => p.startsWith(`CREATE SCHEMA IF NOT EXISTS secondhand.${name} `)), name);
  for (const name of ['landing', 'captures', 'snapshots']) assert.ok(parts.some(p => p.startsWith(`CREATE VOLUME IF NOT EXISTS secondhand.raw.${name} `)), name);
});

test('pipeline libraries use a recursive glob', () => {
  assert.match(read('deploy/resources/market.yml'), /include: \.\.\/\.\.\/databricks\/pipelines\/market\/\*\*\s*$/m);
});

test('pipeline uses only modern declarations and has one file per dataset', () => {
  const files = readdirSync(join(root, 'databricks/pipelines/market')).filter(f => f.endsWith('.sql'));
  assert.deepEqual(files.sort(), ['comp.sql', 'comp_daily.sql', 'comp_for_model.sql', 'product.sql', 'sold_raw.sql', 'source_manifest.sql']);
  for (const file of files) {
    const sql = market(file.slice(0, -4));
    assert.doesNotMatch(sql, /LIVE\.|CREATE LIVE|CREATE OR REPLACE STREAMING|input_file_name\s*\(/i, file);
    assert.equal(statements(sql).length, 1, file);
    assert.match(sql, /^(?:--[^\n]*\n)*CREATE (?:OR REFRESH (?:STREAMING TABLE|MATERIALIZED VIEW)|VIEW) /, file);
  }
  const yml = read('deploy/resources/market.yml');
  for (const pattern of [/catalog: \$\{var.catalog\}/, /schema: \$\{var.market_schema\}/, /serverless: true/, /continuous: false/, /channel: CURRENT/, /pipeline_id: \$\{resources.pipelines.secondhand_market.id\}/, /full_refresh: false/]) assert.match(yml, pattern);
});

test('bronze CSV schema matches every frozen manifest column in order', () => {
  const sql = market('sold_raw');
  const schema = sql.match(/schema\s*=>\s*'([^']+)'/i)?.[1];
  assert.ok(schema, 'sold_raw: explicit CSV schema required');
  const columns = schema.split(',').map(c => { assert.match(c.trim(), /^\w+ STRING$/); return c.trim().split(' ')[0]; });
  const dir = 'jobs/valuation/data/manifests';
  for (const file of readdirSync(join(root, dir)).filter(f => f.endsWith('.json'))) assert.deepEqual(columns, JSON.parse(read(`${dir}/${file}`)).output.columns, file);
  assert.match(sql, /FROM STREAM read_files\(/i);
  assert.ok(sql.includes('/Volumes/secondhand/raw/landing/sold/*/rows.csv.gz'));
  assert.match(sql, /_metadata.file_path AS source_file/);
  assert.match(sql, /current_timestamp\(\) AS ingested_at/);
  const manifest = market('source_manifest');
  assert.match(manifest, /multiLine => true/);
  for (const field of ['source', 'licence', 'may_model', 'code_commit AS extractor_version', 'output.sha256 AS source_sha256', 'rows AS manifest_rows']) assert.ok(manifest.includes(field), field);
});

test('silver preserves typed fields, fit aliases, manifest evidence and fail-closed rights', () => {
  const sql = market('comp');
  const fields = [...read('jobs/valuation/experiment.py').match(/FIELDS = \(([\s\S]*?)\)/)[1].matchAll(/"(\w+)"/g)].map(m => m[1]);
  const declared = new Map([...sql.matchAll(/^  (\w+) (STRING|BIGINT|BOOLEAN|TIMESTAMP|ARRAY<STRING>)/gm)].map(m => [m[1], m[2]]));
  const bigints = ['price_cents', 'buyer_shipping_cents', 'photo_count', 'seller_feedback', 'views', 'watchers', 'retail_cents'];
  const booleans = ['may_model', 'best_offer', 'at_ask', 'priced_from_our_number'];
  const timestamps = ['listed_at', 'at', 'released_at'];
  for (const field of [...fields, 'description', 'retail_cents', 'released_at', 'region']) {
    const type = bigints.includes(field) ? 'BIGINT' : booleans.includes(field) ? 'BOOLEAN' : timestamps.includes(field) ? 'TIMESTAMP' : 'STRING';
    assert.equal(declared.get(field), type, `comp.${field}: required source field type`);
  }
  assert.match(sql, /FROM STREAM\(sold_raw\)\s+(?:AS )?r\s+LEFT JOIN source_manifest\s+(?:AS )?m\s+ON r.source = m.source/i);
  for (const field of ['price_cents', 'buyer_shipping_cents', 'photo_count', 'seller_feedback', 'views', 'watchers', 'retail_cents']) assert.match(sql, new RegExp(`CAST\\(NULLIF\\(r\\.${field}, ''\\) AS BIGINT\\) AS ${field}`, 'i'));
  for (const field of ['listed_at', 'at', 'released_at']) assert.match(sql, new RegExp(`CAST\\(NULLIF\\(r\\.${field}, ''\\) AS TIMESTAMP\\) AS ${field}`, 'i'));
  for (const field of ['best_offer', 'at_ask', 'priced_from_our_number']) assert.match(sql, new RegExp(`CASE r\\.${field} WHEN 'True' THEN true WHEN 'False' THEN false END AS ${field}`));
  assert.match(sql, /coalesce\(CASE r.may_model WHEN 'True' THEN true WHEN 'False' THEN false END, m.may_model\) AS may_model/i);
  for (const expression of ['r.row_id AS comp_id', 'r.url AS url_ref', "CASE WHEN r.price_type = 'sold' THEN CAST(NULLIF(r.at, '') AS TIMESTAMP) END AS sold_at", "CAST(NULLIF(r.at, '') AS TIMESTAMP) AS observed_at", 'CAST(array() AS ARRAY<STRING>) AS lot_parts', 'm.source_sha256', 'm.extractor_version', 'true AS may_store', 'true AS may_show', 'false AS may_share']) assert.ok(sql.includes(expression), expression);
  for (const [condition, action] of [["price_cents > 0", 'DROP ROW'], ["price_type IN ('sold', 'asking', 'ended_unsold')", 'DROP ROW'], ['may_model IS NOT NULL', 'FAIL UPDATE'], ['row_id IS NOT NULL', 'FAIL UPDATE'], ['source_sha256 IS NOT NULL', 'FAIL UPDATE']]) assert.ok(sql.includes(`EXPECT (${condition}) ON VIOLATION ${action}`), condition);
  assert.match(market('comp_for_model'), /CREATE VIEW comp_for_model\s+COMMENT 'the only table a fit may read \(spec\/databricks-build.md §7\)'\s+AS SELECT \* FROM comp WHERE may_model = true;/);
});

test('product and daily summaries keep undated rows and the valuation product shape', () => {
  const product = market('product');
  for (const value of ['product_id', 'any_value(brand)', 'any_value(category)', 'any_value(kind)', "to_json(named_struct('size', any_value(size), 'era', any_value(era))) AS spec", 'AS n_rows', 'AS n_sold', 'AS first_at', 'AS last_at', 'collect_set(source) AS sources', 'FROM comp', 'GROUP BY product_id']) assert.ok(product.includes(value), value);
  const daily = market('comp_daily');
  for (const value of ['date(at) AS day', 'count(*) AS n', 'percentile_approx(price_cents, 0.5) AS median_cents', 'min(price_cents)', 'max(price_cents)', 'GROUP BY source, site, kind, price_type, date(at)']) assert.ok(daily.includes(value), value);
  assert.doesNotMatch(daily, /WHERE/i, 'undated rows must remain under day NULL');
});
