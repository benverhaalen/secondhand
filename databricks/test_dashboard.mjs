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

function checkWidget(widget) {
  if (widget.multilineTextboxSpec) {
    assert.equal(widget.spec, undefined, `${widget.name}: text must not have a spec`);
    return;
  }
  const { spec } = widget;
  assert.equal(spec.version, { counter: 2, table: 2, bar: 3, line: 3 }[spec.widgetType],
    `${widget.name}: wrong widget version`);
  const fields = widget.queries.flatMap(q => q.query.fields.map(f => f.name));
  assert.deepEqual([...new Set(fields)].sort(), [...new Set(encodedFields(spec.encodings))].sort(),
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
  const clean = query.replace(/'([^']|'')*'/g, "''").replace(/--[^\n]*/g, '').replaceAll('`', '');
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
  assert.equal(d.pages.length, 7);
  assert.deepEqual(d.uiSettings.theme.visualizationColors, ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#D55E00']);
  const names = new Set();
  for (const w of widgets(d)) {
    assert.match(w.name, /^[\w-]{1,60}$/);
    assert.ok(!names.has(w.name), `duplicate widget: ${w.name}`); names.add(w.name);
    checkWidget(w);
    for (const q of w.queries ?? []) assert.ok(d.datasets.some(s => s.name === q.query.datasetName), `${w.name}: missing dataset`);
  }
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

test('percent datasets execute as fractions, weight citation counts, and leave missing evidence null', () => {
  const d = dashboard();
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE headline_latest (run_id TEXT, source TEXT, started_at TEXT, contestant TEXT, within_20 REAL, coverage REAL);
      CREATE TABLE citation_coverage (data TEXT, shown_numbers INT, shown_with_citation INT, share REAL);
      CREATE TABLE recompute_check (equal BOOLEAN);
      CREATE TABLE parity_check (equal BOOLEAN);`);
    const percent = widgets(d).filter(w => w.spec?.encodings.value?.format?.type === 'number-percent');
    assert.equal(percent.length, 7);
    for (const w of percent) {
      const query = sql(d, w.queries[0].query.datasetName);
      for (const row of db.prepare(query).all()) checkPercent(row[w.spec.encodings.value.fieldName], w.name);
    }
    db.exec(`INSERT INTO headline_latest VALUES
      ('old', 'a', '2025-01-01', 'model', .1, .2),
      ('new', 'b', '2026-01-01', 'product_90d_median', .6, .7),
      ('new', 'b', '2026-01-01', 'model', .8, .9);
      INSERT INTO citation_coverage VALUES ('dataset:a', 10, 5, .5), ('live:b', 90, 90, 1), ('synthetic', 900, 0, 0);
      INSERT INTO recompute_check VALUES (1), (0);
      INSERT INTO parity_check VALUES (1), (1), (0), (0);`);
    const expected = { primary_within_20: .6, primary_coverage: .7, model_within_20: .8, model_coverage: .9, citation_share: .95, recompute_share: .5, parity_share: .5 };
    for (const w of percent) {
      const rows = db.prepare(sql(d, w.queries[0].query.datasetName)).all();
      assert.equal(rows.length, 1, `${w.name}: counter must have one row`);
      const value = rows[0][w.spec.encodings.value.fieldName];
      checkPercent(value, w.name);
      assert.equal(value, expected[w.name], `${w.name}: wrong denominator or backtest run`);
    }
  } finally { db.close(); }
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

test('accuracy compares common bands and exposes counts, coverage and error per cell', () => {
  const d = dashboard();
  const cell = sql(d, 'accuracy').match(/concat\((.*?)\) AS cell/s)?.[1];
  assert.ok(cell, 'accuracy needs a shared cell key');
  assert.doesNotMatch(cell, /priced|contestant/, 'counts must not split the contestant comparison');
  const details = widgets(d).find(w => w.name === 'accuracy_cells');
  assert.ok(details, 'per-cell accuracy details are missing');
  for (const field of ['source', 'kind', 'price_band', 'contestant', 'n', 'priced', 'within_20', 'coverage', 'median_ape']) {
    assert.ok(details.queries[0].query.fields.some(f => f.name === field), field);
    assert.ok(sql(d, 'accuracy').includes(field), field);
  }
  const gap = widgets(d).find(w => w.name === 'valuation_gaps').multilineTextboxSpec.lines.join('');
  for (const name of ['Depop', 'Poshmark', 'Mercari', 'Facebook', 'furniture', 'one-off', 'unbranded']) assert.ok(gap.includes(name), name);
});

test('thin cells, governance, proof and empty benchmark are represented honestly', () => {
  const d = dashboard();
  assert.match(sql(d, 'accuracy'), /WHERE NOT too_few/);
  assert.match(sql(d, 'accuracy'), /priced/);
  assert.match(sql(d, 'lineage'), /length\(trim\(target_table_full_name\)\) > 0/);
  assert.match(sql(d, 'guard'), /count\(\*\) AS violations FROM guard_violations/);
  for (const name of ['bench_coverage', 'bench_speed', 'bench_cited']) {
    assert.match(sql(d, name), new RegExp(`FROM ${name}`));
    assert.doesNotMatch(sql(d, name), /VALUES|UNION|coalesce/i);
  }
  assert.ok(widgets(d).some(w => w.name === 'valuation_claim' && w.queries[0].query.fields.some(f => f.name === 'claim')));
  const governance = widgets(d).find(w => w.name === 'governance_promises').multilineTextboxSpec.lines.join('');
  assert.match(governance, /Promise \| Databricks feature \| What we add/);
  assert.match(governance, /designed/i);
});

test('bundle declares the portable dashboard and both existing experiment paths', () => {
  const yml = read('../deploy/resources/dashboard.yml');
  for (const value of ['dashboards:', 'display_name: "secondhand: proof"', 'warehouse_id: ${var.warehouse_id}', 'dataset_catalog: secondhand', 'dataset_schema: measures', 'embed_credentials: false', 'experiments:', 'name: /Shared/secondhand/valuation-backtest', 'name: /Shared/secondhand/param-walk']) assert.ok(yml.includes(value), value);
  const file = yml.match(/file_path:\s*(\S+)/)?.[1];
  assert.equal(file, '../../databricks/dashboards/proof.lvdash.json');
  assert.deepEqual(JSON.parse(read(`../deploy/resources/${file}`)), dashboard());
});
