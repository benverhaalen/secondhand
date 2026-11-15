import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { DatabaseSync } from 'node:sqlite'
import { statements } from './run-sql.mjs'

const root = new URL('./', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const coreTables = [...read('sql/01_tables.sql').matchAll(/CREATE TABLE IF NOT EXISTS secondhand\.core\.(\w+)/g)].map(m => m[1])
const withoutComments = sql => sql.split('\n').filter(line => !line.trim().startsWith('--')).join('\n')
function checkSplit(sql, file) {
  const source = withoutComments(sql).trim()
  assert.ok(source.endsWith(';'), `${file}: last statement needs a line-ending semicolon`)
  const starts = source.match(/^\s*(?:CREATE|ALTER|EXECUTE)\b/gm) ?? []
  const parsed = statements(sql)
  assert.equal(parsed.length, starts.length, `${file}: splitter merged statements; put each semicolon at line end`)
  for (const s of parsed) assert.doesNotMatch(s.replace(/'(?:''|[^'])*'/g, ''), /;/, `${file}: a statement contains an unsplit semicolon`)
}

test('every core table has an owner column tag before direct filters disappear', () => {
  const sql = read('sql/02_governance.sql')
  for (const table of coreTables) assert.match(sql,
    new RegExp(`ALTER TABLE secondhand\\.core\\.${table} ALTER COLUMN user_id SET TAGS \\('sh_owner' = 'user_id'\\)`),
    `${table}: missing sh_owner tag would expose its rows`)
})

test('owner filter allows the temporary maintenance mapping and records its window', () => {
  const sql = read('sql/02_governance.sql')
  const owner = statements(sql).find(s => s.startsWith('CREATE OR REPLACE FUNCTION secondhand.governance.owner_only('))
  const body = owner.slice(owner.indexOf('RETURN '))
  assert.match(body, /m\.principal = current_user\(\)/)
  assert.match(body, /m\.user_id = '\*'/)
  const mapping = statements(sql).find(s => s.startsWith('CREATE TABLE IF NOT EXISTS secondhand.governance.principal_map '))
  assert.match(mapping, /grant_id STRING COMMENT 'The break_glass\.id this wildcard row belongs to\.'/)
  const audit = statements(sql).find(s => s.startsWith('CREATE TABLE IF NOT EXISTS secondhand.governance.break_glass '))
  assert.ok(audit, 'maintenance windows need an audit table')
  for (const [column, type] of [['id', 'STRING'], ['principal', 'STRING'], ['reason', 'STRING'], ['started_at', 'TIMESTAMP'], ['ended_at', 'TIMESTAMP']]) {
    assert.match(audit, new RegExp(`\\b${column} ${type}(?: NOT NULL)? COMMENT '[^']+'`))
  }
})

test('only migration and loader may write a wildcard principal mapping', () => {
  const wildcardInsert = /(?:INSERT\s+INTO|MERGE\s+INTO)\s+secondhand\.governance\.principal_map\b[^;]*?['"]\*['"]/i
  assert.ok(wildcardInsert.test(['INSERT INTO', "secondhand.governance.principal_map VALUES (current_user(), '*')"].join(' ')))
  assert.ok(wildcardInsert.test(['MERGE INTO', "secondhand.governance.principal_map USING (SELECT '*' AS user_id) s"].join(' ')))
  function walk(dir, prefix = '') {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = prefix + entry.name
      if (entry.isDirectory()) {
        if (entry.name !== '__pycache__') walk(new URL(`${entry.name}/`, dir), `${file}/`)
      } else if (!['tasks/migrate_data.py', 'load/load.mjs'].includes(file)) {
        assert.doesNotMatch(read(file), wildcardInsert, `${file}: wildcard writes belong only to maintenance code`)
      }
    }
  }
  walk(root)
})

test('catalog policies match governed tags created by the tag script', async () => {
  const { wanted } = await import('./tags.mjs')
  const sql = read('sql/02_governance.sql')
  for (const [policy, kind, key, value] of [
    ['sh_owner_only', 'ROW FILTER', 'sh_owner', 'user_id'],
    ['sh_mask_handle', 'COLUMN MASK', 'sh_personal', 'handle'],
  ]) {
    const statement = statements(sql).find(s => s.startsWith(`CREATE OR REPLACE POLICY ${policy} `))
    assert.ok(statement, `${policy}: missing policy`)
    assert.match(statement, /ON CATALOG secondhand\s+COMMENT '[^']+'/)
    assert.ok(statement.includes(kind))
    assert.ok(statement.includes("TO `account users`"))
    assert.ok(statement.includes(`has_tag_value('${key}','${value}')`))
    assert.ok(wanted.some(t => t.tag_key === key && t.values.some(v => v.name === value)), `${policy}: tag script does not create ${key}=${value}`)
  }
  assert.match(sql, /AS uid USING COLUMNS \(uid\)/)
  assert.match(sql, /AS h ON COLUMN h/)
})

test('personal data and credential markers are absent throughout databricks', () => {
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir)
      if (entry.isDirectory()) walk(path)
      else {
        const content = readFileSync(path, 'utf8')
        assert.doesNotMatch(content, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, `${fileURLToPath(path)}: email address`)
        assert.ok(!content.includes(['da', 'pi'].join('')), `${fileURLToPath(path)}: credential marker`)
      }
    }
  }
  walk(root)
})

test('each SQL statement is separated for the real runner', () => {
  for (const file of ['sql/02_governance.sql', 'sql/05_audit.sql']) checkSplit(read(file), file)
  assert.throws(() => checkSplit('CREATE VIEW a AS SELECT 1; -- trailing text\nCREATE VIEW b AS SELECT 2;\n', 'broken'), /splitter merged/)
})

test('direct filters and masks are removed, with handle tags covering both columns', () => {
  const sql = read('sql/02_governance.sql')
  assert.doesNotMatch(sql, /SET ROW FILTER|SET MASK/i)
  for (const table of coreTables) assert.ok(sql.includes(`ALTER TABLE secondhand.core.${table} DROP ROW FILTER;`), `${table}: legacy filter remains`)
  for (const [table, column] of [['observation', 'seller_handle'], ['decision', 'buyer_handle']]) {
    assert.ok(sql.includes(`ALTER TABLE secondhand.core.${table} ALTER COLUMN ${column} DROP MASK;`))
    assert.ok(sql.includes(`ALTER TABLE secondhand.core.${table} ALTER COLUMN ${column} SET TAGS ('sh_personal' = 'handle');`))
  }
})

test('tag creation plan is pure and creates only missing tag keys', async () => {
  const { plan, wanted } = await import('./tags.mjs')
  const existing = [{ ...wanted[0], id: 'existing' }]
  const before = JSON.stringify({ existing, wanted })
  assert.deepEqual(plan([], wanted), wanted)
  assert.deepEqual(plan(existing, wanted), [wanted[1]])
  assert.deepEqual(plan(wanted, wanted), [])
  assert.deepEqual(plan([{ tag_key: 'unrelated' }], wanted), wanted)
  assert.equal(JSON.stringify({ existing, wanted }), before)
})

test('audit views expose rights, lineage, anonymized activity and tag coverage', () => {
  const sql = read('sql/05_audit.sql')
  for (const view of ['rights_audit', 'rights_audit_summary', 'lineage_edges', 'audit_activity', 'policies_in_force']) {
    assert.match(sql, new RegExp(`CREATE OR REPLACE VIEW secondhand\\.measures\\.${view}\\s+COMMENT '[^']+'`))
  }
  assert.match(sql, /explode\(c\.basis_ids\)/)
  assert.match(sql, /secondhand\.market\.comp/)
  assert.match(sql, /may_model = false/)
  for (const column of ['citations_checked', 'basis_rows_checked', 'violations']) assert.ok(sql.includes(column))
  assert.match(sql, /system\.access\.table_lineage/)
  assert.match(sql, /max\(event_time\) AS last_seen/i)
  assert.match(sql, /exists\(map_values\(request_params\)/)
  assert.match(sql, /user_identity\.email = current_user\(\)\) AS is_me/)
  assert.match(sql, /date_sub\(current_date\(\), 30\)/)
  assert.match(sql, /secondhand\.information_schema\.column_tags/)
  assert.match(sql, /secondhand\.information_schema\.table_tags/)
})

// Execute the audit's relational query locally, adapting only catalog names and array expansion.
function auditDatabase(t) {
  const db = new DatabaseSync(':memory:')
  t.after(() => db.close())
  db.exec(`
    CREATE TABLE citation (id STRING, metric STRING, basis_ids STRING, data STRING);
    CREATE TABLE comp (comp_id STRING, source STRING, may_model BOOLEAN, data STRING);
    CREATE TABLE observation (id STRING, site STRING, evidence_id STRING, data STRING);
    CREATE TABLE evidence (id STRING, may_model BOOLEAN);
  `)
  for (const name of ['rights_audit', 'rights_audit_summary']) {
    const view = statements(read('sql/05_audit.sql')).find(s => s.startsWith(`CREATE OR REPLACE VIEW secondhand.measures.${name}\n`))
    const local = view.replace('CREATE OR REPLACE VIEW', 'CREATE VIEW')
      .replace(/\nCOMMENT '(?:''|[^'])*'\nAS\n/, '\nAS\n')
      .replaceAll(/secondhand\.(?:core|market|measures)\./g, '')
      .replaceAll('explode(c.basis_ids)', 'json_each.value')
      .replaceAll('FROM citation c', 'FROM citation c, json_each(c.basis_ids)')
    db.exec(local)
  }
  const cite = (id, metric, ids, data = 'live:facebook') => db.prepare('INSERT INTO citation VALUES (?, ?, ?, ?)').run(id, metric, JSON.stringify(ids), data)
  return { db, cite, rows: () => db.prepare('SELECT * FROM rights_audit ORDER BY citation_id, basis, comp_id').all().map(r => ({ ...r })) }
}

test('rights audit preserves market violations and follows observation evidence rights', t => {
  const { db, cite, rows } = auditDatabase(t)
  db.exec(`
    INSERT INTO comp VALUES ('comp_denied', 'grailed_2021', false, 'dataset:grailed_2021'),
                            ('comp_allowed', 'stockx_2019', true, 'dataset:stockx_2019');
    INSERT INTO evidence VALUES ('ev_denied', false), ('ev_allowed', true);
    INSERT INTO observation VALUES ('obs_denied', 'ebay', 'ev_denied', 'live:ebay'),
                                   ('obs_allowed', 'facebook', 'ev_allowed', 'live:facebook');
  `)
  cite('cit_market', 'valuation.model.q50', ['comp_denied', 'comp_denied', 'comp_allowed'])
  cite('cit_observation', 'asking_p50_cents', ['obs_denied', 'obs_denied'])
  cite('cit_clean', 'asking_p50_cents', ['obs_allowed', 'missing'])
  assert.deepEqual(rows(), [
    { citation_id: 'cit_market', metric: 'valuation.model.q50', comp_id: 'comp_denied', source: 'grailed_2021', basis: 'market_comp' },
    { citation_id: 'cit_observation', metric: 'asking_p50_cents', comp_id: 'obs_denied', source: 'ebay', basis: 'observation' },
  ], 'forbidden observation evidence must be audited without changing existing market violations or duplicating repeated ids')
})

test('current-price metrics reject frozen comp and observation bases regardless of modelling permission', t => {
  const { db, cite, rows } = auditDatabase(t)
  db.exec(`
    INSERT INTO comp VALUES ('comp_frozen', 'mercari_kaggle', true, 'dataset:mercari_kaggle'),
                            ('comp_live', 'facebook', true, 'live:facebook');
    INSERT INTO observation VALUES ('obs_frozen', 'mercari', 'ev_allowed', 'dataset:mercari_kaggle'),
                                   ('obs_no_evidence', 'grailed', 'missing', 'dataset:grailed_2021'),
                                   ('obs_live', 'facebook', 'ev_allowed', 'live:facebook');
    INSERT INTO evidence VALUES ('ev_allowed', true);
  `)
  for (const metric of ['asking_p50_cents', 'sold_p50_cents']) {
    cite(`cit_${metric}`, metric, ['comp_frozen', 'comp_frozen', 'obs_frozen', 'obs_no_evidence', 'comp_live', 'obs_live'])
  }
  cite('cit_historical', 'valuation.model.q50', ['comp_frozen', 'obs_frozen'])
  cite('cit_clean', 'asking_p50_cents', ['comp_live', 'obs_live'], 'dataset:stockx_2019')
  assert.deepEqual(rows(), ['asking_p50_cents', 'sold_p50_cents'].flatMap(metric => [
    ['comp_frozen', 'mercari_kaggle'], ['obs_frozen', 'mercari'], ['obs_no_evidence', 'grailed'],
  ].map(([comp_id, source]) => ({ citation_id: `cit_${metric}`, metric, comp_id, source, basis: 'dataset_in_current_metric' }))),
  'inspect basis provenance, including observations without evidence, while allowing historical metrics and live bases')
})

test('audit columns remain additive and summary totals include each violation kind', t => {
  const { db, cite } = auditDatabase(t)
  assert.deepEqual(db.prepare('PRAGMA table_info(rights_audit)').all().map(c => [c.name, c.type]), [
    ['citation_id', 'STRING'], ['metric', 'STRING'], ['comp_id', 'STRING'], ['source', 'STRING'], ['basis', ''],
  ], 'existing rights audit column names, positions and source types must survive')
  const columns = ['citations_checked', 'basis_rows_checked', 'violations', 'observation_violations', 'dataset_current_violations']
  assert.deepEqual(db.prepare('PRAGMA table_info(rights_audit_summary)').all().map(c => c.name), columns)
  const summary = () => Object.values(db.prepare('SELECT * FROM rights_audit_summary').get())
  assert.deepEqual(summary(), [0, 0, 0, 0, 0], 'empty audit counts must be zero')
  db.exec(`
    INSERT INTO comp VALUES ('comp_denied', 'grailed_2021', false, 'dataset:grailed_2021');
    INSERT INTO evidence VALUES ('ev_denied', false);
    INSERT INTO observation VALUES ('obs_denied', 'ebay', 'ev_denied', 'live:ebay');
  `)
  cite('cit_mixed', 'asking_p50_cents', ['comp_denied', 'obs_denied', 'comp_denied'])
  cite('cit_empty', 'sold_p50_cents', [])
  assert.deepEqual(summary(), [2, 3, 3, 1, 1], 'total includes market rights, observation rights and dataset-current violations separately')
  assert.deepEqual(Object.values(db.prepare(`SELECT ${columns.map(c => `typeof(${c})`).join(', ')} FROM rights_audit_summary`).get()),
    columns.map(() => 'integer'))
})

test('audit SQL remains safe for tasks that split at every semicolon', () => {
  const sql = read('sql/05_audit.sql')
  for (const [literal] of withoutComments(sql).matchAll(/'(?:''|[^'])*'/g)) {
    assert.ok(!literal.includes(';'), 'no statement separators inside SQL strings')
  }
  assert.doesNotMatch(sql, /--[^\n]*;/, 'no statement separators inside SQL comments')
  assert.doesNotMatch(sql, /\bBEGIN\b/i, 'SQL file tasks cannot run compound blocks')
})

const loader = () => read('load/load.mjs')
function loaderFunction(name, next, context) {
  const source = loader()
  const start = source.indexOf(`function ${name}(`)
  return runInNewContext(`${source.slice(start, source.indexOf(next, start))}\n${name}`, context)
}

test('loader sold observations contain only completed sales', () => {
  const json = path => JSON.parse(readFileSync(new URL(`../${path}`, root), 'utf8'))
  const orders = json('spec/fixtures/orders/orders.json')
  const build = loaderFunction('build', '// --- numbers:', {
    manifest: [], orders, listings: json('spec/fixtures/orders/listings.json'), json,
    canon: (user, id) => ({ id, user_id: user }), NOW: '2026-11-15', h: s => s,
  })
  for (const user of ['usr_nate', 'usr_ben']) {
    const { obs } = build(user)
    assert.equal(obs.length, orders.filter(o => o.kind === 'sale' && ['delivered', 'handed_over'].includes(o.state)).length)
    assert.ok(obs.every(o => o.price_type === 'sold' && o.user_id === user && o.observed_at))
  }
})

test('every asking-price basis rejects sold rows, including title and empty-site cases', () => {
  const inputs = []
  const numbers = loaderFunction('numbers', '// --- decisions:', {
    min: { value: 1 }, age: { value: 30 }, T: 'secondhand.core', CODE: 'test', NOW: '2026-11-15',
    canon: (user, id) => ({ id, user_id: user }), weightedQuantile: () => 1,
    answer: (_range, basis, meta) => { inputs.push({ basis, meta }); return { ok: false } },
    guard: () => ({ basis_count: 0, state: 'hidden' }),
  })
  const obs = ['depop', 'poshmark', 'ebay', 'mercari', 'grailed'].flatMap(site => ['asking', 'sold'].map(price_type => ({
    id: `${site}_${price_type}`, site, price_type, kind: 'listing', title: 'vintage', price_cents: 100,
  })))
  numbers('usr_nate', obs, 1)
  for (const { basis, meta } of inputs.filter(i => i.meta.metric === 'asking_p50_cents')) {
    assert.ok(basis.every(r => r.id.endsWith('_asking')), `${JSON.stringify(meta.filters)}: sold row entered asking basis`)
  }
})

test('loader resolves principal at runtime and scopes temporary access and citation cleanup', () => {
  const source = loader()
  assert.match(source, /query\('SELECT current_user\(\) AS u'\)\[0\]\.u/)
  assert.match(source, /const gnCols = Object\.keys\(types\.guarded_number\)\.filter/)
  assert.match(source, /merge\('guarded_number', gn, \['id'\], gnCols\)/)
  assert.match(source, /DELETE FROM \$\{T\}\.citation WHERE user_id IN \('usr_nate', 'usr_ben'\)/)
  assert.match(source, /finally\s*\{[\s\S]*WHERE principal = \$\{str\(PRINCIPAL\)\} AND user_id = 'usr_ben'/)
  assert.match(source, /try\s*\{\s*query\(`MERGE INTO \$\{BEN\}/)
})

test('replacement catalog policies are installed before any direct protection is dropped', () => {
  const sql = withoutComments(read('sql/02_governance.sql'))
  const firstDrop = sql.search(/ALTER TABLE .* DROP (?:ROW FILTER|MASK)/)
  for (const name of ['sh_owner_only', 'sh_mask_handle']) {
    const policy = statements(sql).find(s => s.startsWith(`CREATE OR REPLACE POLICY ${name} `))
    assert.ok(policy && sql.indexOf(policy) < firstDrop, `${name}: install policy before drops so a propagation failure keeps legacy protection`)
  }
})

test('citation cleanup only deletes loader candidates without any core reference', () => {
  const sql = loader().slice(loader().indexOf('// a rerun that changed a basis'))
  assert.match(sql, /id IN \(\$\{\[\.\.\.citationCandidates\]/, 'cleanup must be bounded to citations from the example guards')
  assert.match(sql, /SELECT citation_id FROM \$\{T\}\.storefront_snapshot WHERE citation_id IS NOT NULL/, 'storefront citations must survive cleanup')
})
