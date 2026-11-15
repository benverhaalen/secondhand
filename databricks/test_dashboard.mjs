// Run: zsh -lc 'node --test --test-concurrency=1 databricks/test_dashboard.mjs'
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { statements } from './run-sql.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const dashboard = () => JSON.parse(read('dashboards/proof.lvdash.json'));
const widgets = d => d.pages.flatMap(p => p.layout.map(l => l.widget));
const sql = (d, name) => d.datasets.find(s => s.name === name).queryLines.join('');
const encodedFields = value => !value || typeof value !== 'object' ? [] :
  Object.entries(value).flatMap(([key, v]) => key === 'fieldName' ? [v] : encodedFields(v));

function checkResourceKeys(files) {
  const keys = new Map();
  for (const [file, content] of files) {
    let inResources = false, type;
    for (const line of content.split('\n')) {
      if (/^resources:\s*(?:#.*)?$/.test(line)) { inResources = true; continue; }
      if (!line.trim() || /^\s*#/.test(line)) continue;
      if (/^\S/.test(line)) { inResources = false; continue; }
      if (!inResources) continue;
      const typeMatch = line.match(/^  ([\w-]+):\s*(?:#.*)?$/);
      if (typeMatch) { type = typeMatch[1]; continue; }
      const keyMatch = line.match(/^    ([\w-]+):\s*(?:#.*)?$/);
      if (!keyMatch) continue;
      const key = keyMatch[1], previous = keys.get(key);
      assert.ok(!previous || previous.type === type,
        `duplicate resource key ${key}: ${previous?.file} (${previous?.type}) and ${file} (${type})`);
      keys.set(key, { type, file });
    }
  }
}

function checkWidget(widget) {
  if (widget.multilineTextboxSpec) {
    assert.equal(widget.spec, undefined, `${widget.name}: text must not have a spec`);
    return;
  }
  const { spec } = widget;
  assert.equal(spec.version, { counter: 2, table: 2, bar: 3, line: 3, 'filter-single-select': 2, 'custom-vega-viz': 1 }[spec.widgetType],
    `${widget.name}: wrong widget version`);
  const fields = widget.queries.flatMap(q => q.query.fields.map(f => f.name));
  const templated = [...JSON.stringify(spec.encodings).matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);
  assert.deepEqual([...new Set(fields)].sort(), [...new Set([...encodedFields(spec.encodings), ...templated])].sort(),
    `${widget.name}: field-name mismatch (no selected fields)`);
}

function knownRelations() {
  const relations = new Set();
  for (const dir of ['sql/', 'pipelines/market/']) {
    for (const file of readdirSync(new URL(dir, import.meta.url)).filter(f => f.endsWith('.sql'))) {
      for (const m of read(dir + file).matchAll(/CREATE\s+(?:OR\s+(?:REPLACE|REFRESH)\s+)?(?:STREAMING\s+TABLE|MATERIALIZED\s+VIEW|TABLE|VIEW|FUNCTION)\s+(?:IF NOT EXISTS\s+)?([\w.]+)/gi)) {
        const name = m[1].toLowerCase();
        relations.add(name.includes('.') ? name : `secondhand.market.${name}`);
      }
    }
  }
  return relations;
}

function checkRelations(query, relations) {
  const clean = query.replace(/'([^']|'')*'/g, "''").replace(/--[^\n]*/g, '').replace(/`[^`]*`/g, 'x');
  const ctes = new Set([...clean.matchAll(/(?:WITH|,)\s*(\w+)\s+AS\s*\(/gi)].map(m => m[1].toLowerCase()));
  for (const m of clean.matchAll(/\b(?:FROM|JOIN)\s+(?:LATERAL\s+)?([\w.]+)/gi)) {
    const name = m[1].toLowerCase();
    if (ctes.has(name)) continue;
    assert.ok(relations.has(name.includes('.') ? name : `secondhand.measures.${name}`),
      `unknown relation: ${name}`);
    assert.ok(!name.includes('.') || /^secondhand\.(market|core|governance)\./.test(name),
      `dataset relation must use a bare measures name: ${name}`);
  }
}

function checkPercent(value, label) {
  assert.ok(value === null || (Number.isFinite(value) && value >= 0 && value <= 1),
    `${label}: percent counter requires 0-1, not 0-100`);
}

const counterFixture = () => ({ name: 'fixture', queries: [{ query: { fields: [{ name: 'share' }] } }],
  spec: { widgetType: 'counter', version: 2, encodings: { value: { fieldName: 'share' } } } });

test('rejects a field-name mismatch before it renders no selected fields', () => {
  const w = counterFixture(); w.spec.encodings.value.fieldName = 'sum(share)';
  assert.throws(() => checkWidget(w), /field-name mismatch/);
});
test('rejects the wrong widget version', () => {
  const w = counterFixture(); w.spec.version = 3;
  assert.throws(() => checkWidget(w), /wrong widget version/);
});
test('rejects a dataset over a nonexistent view, including inside a CTE', () => {
  assert.throws(() => checkRelations('WITH x AS (SELECT * FROM absent_view) SELECT * FROM x', knownRelations()), /unknown relation: absent_view/);
});
test('rejects 0-100 percentages while allowing empty and fractional results', () => {
  assert.throws(() => checkPercent(86.5, 'fixture'), /requires 0-1/);
  checkPercent(0.865, 'fixture'); checkPercent(null, 'empty');
});

test('dashboard parses and every widget has matching fields and supported versions', () => {
  const d = dashboard();
  assert.equal(d.pages.length, 2, 'the story on one page and the data on a second');
  assert.equal(d.uiSettings.genieSpace.enablementMode, 'ENABLED');
  const names = new Set();
  for (const w of widgets(d)) {
    assert.match(w.name, /^[\w-]{1,60}$/);
    assert.ok(!names.has(w.name), `duplicate widget: ${w.name}`); names.add(w.name);
    checkWidget(w);
    for (const q of w.queries ?? []) assert.ok(d.datasets.some(s => s.name === q.query.datasetName), `${w.name}: missing dataset`);
  }
});

test('every figure says where it comes from, and every headline figure carries its count', () => {
  const d = dashboard();
  for (const w of widgets(d).filter(w => w.spec)) {
    if (w.spec.widgetType.startsWith('filter')) continue;
    assert.ok(w.spec.frame?.title && w.spec.frame?.description, `${w.name}: title and description name the data`);
    assert.doesNotMatch(JSON.stringify(w.spec.frame), /—|n=|p50|accuracy on live/i, `${w.name}: plain words`);
    assert.equal(w.spec.encodings.value?.formatTemplate, undefined, `${w.name}: the counter truncates a template; use the stat widget`);
    if (w.spec.widgetType === 'custom-vega-viz') assert.deepEqual(w.spec.encodings.fields.map(f => f.fieldName), ['value_label', 'sub_label'], w.name);
  }
  const stats = sql(d, 'stats');
  for (const key of ['cited', 'rebuilt', 'ours_range', 'locked', 'refused', 'held_back', 'allowed'])
    assert.match(stats, new RegExp(`'${key}'.*concat\\('of `), `${key}: its count reads "of N"`);
  assert.match(stats, /coalesce\(concat\(format_number\(within_20 \* 100, 1\), '%'\), 'Too few'\)/, 'a null rate reads Too few, never 0%');
});

test('the metric view guards every rate the way the app does: null under 30 shown', () => {
  const view = read('sql/13_metrics.sql');
  assert.match(view, /CREATE OR REPLACE VIEW secondhand\.measures\.valuation_metrics\s+WITH METRICS\s+LANGUAGE YAML/);
  assert.match(view, /PARTITION BY source ORDER BY started_at DESC, run_id DESC/);
  const rates = [...view.matchAll(/- name: (Within 20 percent|Median error|Range held the sale)\n\s+expr: (.+)/g)];
  assert.equal(rates.length, 3);
  for (const [, name, expr] of rates) assert.match(expr, /^CASE WHEN COUNT_IF\(shown\) >= 30 THEN .+ END$/, name);
  const d = dashboard();
  for (const name of ['stats', 'price_band', 'price_range', 'price_week']) assert.match(sql(d, name), /FROM valuation_metrics/);
});

test('every dataset references existing relations and queryLines concatenate safely', () => {
  const relations = knownRelations();
  for (const ds of dashboard().datasets) {
    assert.ok(ds.queryLines.length > 0, ds.name);
    for (const line of ds.queryLines) assert.match(line, /[ \n]$/, `${ds.name}: queryLines must end in whitespace`);
    assert.doesNotMatch(ds.queryLines.join(''), /secondhand\.measures\./i, ds.name);
    checkRelations(ds.queryLines.join(''), relations);
  }
});

test('GRID_V1 rows fill twelve columns without gaps or overlapping rows', () => {
  for (const page of dashboard().pages) {
    assert.equal(page.layoutVersion, 'GRID_V1');
    assert.equal(page.pageType, 'PAGE_TYPE_CANVAS');
    const rows = Map.groupBy(page.layout, l => l.position.y);
    let bottom = 0;
    for (const [y, row] of [...rows].sort((a, b) => a[0] - b[0])) {
      assert.equal(y, bottom, `${page.name}: vertical gap or overlap`);
      let x = 0;
      for (const { position: p, widget: w } of row.sort((a, b) => a.position.x - b.position.x)) {
        assert.equal(p.x, x, `${w.name}: horizontal gap or overlap`);
        assert.ok(p.height > 0 && p.width > 0);
        if (w.spec?.widgetType === 'counter') assert.ok(p.height >= 3);
        assert.equal(p.height, row[0].position.height, `${page.name}: unequal row heights`);
        x += p.width;
      }
      assert.equal(x, 12, `${page.name}: row widths must sum to 12`);
      bottom = y + row[0].position.height;
    }
  }
});

test('dashboard views keep lineage, latest runs, historical claims and CDF postimages', () => {
  const views = statements(read('sql/10_dashboard.sql'));
  for (const v of views) assert.match(v, /^CREATE OR REPLACE VIEW secondhand\.measures\.\w+\s+COMMENT '[\s\S]+?'\s+AS\s/i);
  const find = name => views.find(v => v.startsWith(`CREATE OR REPLACE VIEW secondhand.measures.${name}\n`)) ?? '';
  assert.match(find('pipeline_funnel'), /FROM secondhand\.market\.sold_raw/);
  assert.match(find('pipeline_funnel'), /AS dropped/);
  assert.match(find('pipeline_funnel'), /AS excluded_from_models/);
  assert.match(find('param_history'), /table_changes\('secondhand\.core\.param', 0\)/);
  assert.match(find('param_history'), /_change_type IN \('insert', 'update_postimage'\)/);
  const headline = find('headline_latest');
  assert.match(headline, /PARTITION BY source ORDER BY started_at DESC, run_id DESC/);
  for (const token of ['test_from', 'test_to', 'n_tests', 'collect_set(kind)', "not today''s market", 'r.data', 'r.rank = 1']) assert.ok(headline.includes(token), token);
  assert.match(find('recent_why'), /LATERAL secondhand\.measures\.why_summary\(g\.id\)/);
  assert.match(find('recent_why'), /WHERE state = 'shown'[\s\S]+ORDER BY created_at DESC, id DESC[\s\S]+LIMIT 5/);
});

test('funnel counts fully dropped sources as zero kept, not unknown', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.aggregate('count_if', { start: 0, step: (total, value) => total + (value ? 1 : 0) });
    db.exec(`CREATE TABLE sold_raw (source TEXT);
      CREATE TABLE comp (source TEXT, data TEXT, may_model BOOLEAN, at TEXT);
      INSERT INTO sold_raw VALUES ('dropped'), ('dropped'), ('kept'), ('kept'), ('kept');
      INSERT INTO comp VALUES ('kept', 'dataset:kept', 1, '2020-01-01'), ('kept', 'dataset:kept', 0, '2020-01-02');`);
    const statement = statements(read('sql/10_dashboard.sql')).find(s => s.includes('VIEW secondhand.measures.pipeline_funnel'));
    const query = statement.slice(statement.indexOf('WITH b AS')).replaceAll('secondhand.market.', '');
    const rows = db.prepare(query).all();
    const counts = Object.fromEntries(rows.map(r => [r.source, [r.bronze, r.dropped, r.kept, r.modelled, r.excluded_from_models]]));
    assert.deepEqual(counts, { dropped: [2, 2, 0, 0, 0], kept: [3, 1, 2, 1, 1] });
  } finally { db.close(); }
});

test('bundle declares the portable dashboard and both existing experiment paths', () => {
  const yml = read('../deploy/resources/dashboard.yml');
  for (const value of ['dashboards:', 'display_name: "secondhand: proof"', 'warehouse_id: ${var.warehouse_id}', 'dataset_catalog: secondhand', 'dataset_schema: measures', 'embed_credentials: false', 'experiments:', 'name: /Shared/secondhand/valuation-backtest', 'name: /Shared/secondhand/param-walk']) assert.ok(yml.includes(value), value);
  const file = yml.match(/file_path:\s*(\S+)/)?.[1];
  assert.equal(file, '../../databricks/dashboards/proof.lvdash.json');
  assert.deepEqual(JSON.parse(read(`../deploy/resources/${file}`)), dashboard());
});

test('bundle resource keys do not repeat across resource types', () => {
  assert.throws(() => checkResourceKeys([
    ['one.yml', 'resources:\n  jobs:\n    shared:\n'],
    ['two.yml', 'resources:\n  experiments:\n    shared:\n'],
  ]), /duplicate resource key shared/);
  const files = ['../deploy/databricks.yml', ...readdirSync(new URL('../deploy/resources/', import.meta.url))
    .filter(file => file.endsWith('.yml')).map(file => `../deploy/resources/${file}`)];
  checkResourceKeys(files.map(file => [file, read(file)]));
});
