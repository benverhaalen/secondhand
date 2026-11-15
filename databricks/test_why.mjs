import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { statements } from './run-sql.mjs'
import { basisHash } from '../app/src/engines/proof/proof.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const tables = [...read('sql/01_tables.sql').matchAll(/CREATE TABLE IF NOT EXISTS secondhand\.core\.(\w+) \(([\s\S]*?)\n\)/g)]

test('SQL canonical JSON agrees with basisHash for unsorted ASCII ids, three sources and a null price', () => {
  const rows = [
    { id: 'obs_z', price_cents: 0, source: 'ebay', at: '2026-11-15T00:00:00.000Z' },
    { id: 'comp_A', price_cents: 12345, source: 'stockx_2019', at: '2026-11-14T12:34:56.789Z' },
    { id: 'obs_a', source: 'depop', at: '2026-11-15T00:00:00.000Z' },
    { id: 'comp_10', price_cents: 200, source: 'ebay', at: '2026-11-15T00:00:00.000Z' },
  ]
  const sqlHash = input => createHash('sha256').update('[' + input
    .map(r => ({ id: r.id, line: '{"at":"' + r.at + '","id":"' + r.id + '","price_cents":' + (r.price_cents ?? 'null') + ',"source":"' + r.source + '","weight":1}' }))
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    .map(r => r.line).join(',') + ']').digest('hex')
  assert.equal(sqlHash(rows), basisHash(rows))
  assert.equal(sqlHash([...rows].reverse()), basisHash(rows))
  for (const change of [{ price_cents: 12346 }, { source: 'depop' }, { at: '2026-11-13T00:00:00.000Z' }]) {
    const changed = rows.map(r => r.id === 'comp_A' ? { ...r, ...change } : r)
    assert.equal(sqlHash(changed), basisHash(changed))
    assert.notEqual(sqlHash(changed), basisHash(rows))
  }
  assert.notEqual(sqlHash(rows), basisHash(rows.map(r => ({ ...r, weight: 2 }))))
})

test('the SQL runner keeps both table functions and every constraint statement intact', () => {
  for (const file of ['sql/07_why.sql', 'sql/08_constraints.sql']) {
    const sql = read(file)
    const parsed = statements(sql)
    assert.ok(sql.trimEnd().endsWith(';'), `${file}: missing final line-ending semicolon`)
    const starts = sql.match(/^(?:INSERT|SET|CREATE|ALTER)\b/gm) ?? []
    assert.equal(parsed.length, starts.length, `${file}: statements merged by the real runner`)
    for (const statement of parsed) assert.doesNotMatch(statement.replace(/'(?:''|[^'])*'/g, ''), /;/)
  }
  const functions = statements(read('sql/07_why.sql')).filter(s => s.startsWith('CREATE'))
  assert.equal(functions.length, 2)
  for (const [i, name] of ['why', 'why_summary'].entries()) {
    assert.match(functions[i], new RegExp(`^CREATE OR REPLACE FUNCTION secondhand\\.measures\\.${name}\\(number_id STRING\\)`))
    assert.match(functions[i], /RETURNS TABLE\s*\([\s\S]+COMMENT '[^']+'\s+RETURN\s+(?:WITH|SELECT)/)
  }
})

test('setup maps only system and backtest rows to the current operator before creating functions', () => {
  const [mapping, timezone] = statements(read('sql/07_why.sql'))
  assert.equal(mapping, "INSERT INTO secondhand.governance.principal_map SELECT current_user(), u FROM (VALUES ('system'), ('usr_backtest')) v(u) WHERE NOT EXISTS (SELECT 1 FROM secondhand.governance.principal_map m WHERE m.principal = current_user() AND m.user_id = v.u)")
  assert.equal(timezone, "SET TIME ZONE 'UTC'")
})

test('why resolves market comps first and exposes the whole-basis hash, evidence and rights', () => {
  const functions = statements(read('sql/07_why.sql')).filter(s => s.startsWith('CREATE'))
  const sql = functions[0]
  for (const column of ['number_id', 'metric', 'value_cents', 'state', 'hide_reason', 'citation_id', 'basis_id',
    'basis_price_cents', 'basis_source', 'source_url', 'source_sha256', 'may_model', 'may_show', 'stored_hash', 'recomputed_hash', 'equal', 'reason']) {
    assert.match(sql, new RegExp(`\\b${column}\\b`), `why: missing ${column}`)
  }
  assert.match(sql, /explode\(c\.basis_ids\)/)
  assert.match(sql, /m\.comp_id IS NULL AND o\.id =/)
  assert.match(sql, /secondhand\.core\.evidence/)
  assert.match(sql, /e\.fingerprint/)
  assert.ok(sql.includes(`concat('{"at":"', a, '","id":"', id, '","price_cents":', coalesce(cast(price_cents AS STRING), 'null'), ',"source":"', basis_source, '","weight":1}')`))
  assert.match(sql, /array_sort\(collect_list\(named_struct\('id', id, 'line', line\)\)\)/)
  assert.match(sql, /sha2\(concat\('\[', array_join\(transform\([\s\S]*?r -> r\.line\), ','\), '\]'\), 256\)/)
  assert.ok(sql.includes(`date_format(CASE WHEN m.comp_id IS NOT NULL THEN m.at ELSE o.observed_at END, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")`))
  assert.doesNotMatch(sql, /to_json\s*\(/i)
  const summary = functions[1]
  assert.match(summary, /count\(\*\)/i)
  assert.match(summary, /missing_basis/)
  assert.match(summary, /CASE WHEN count\(\*\) = 0 THEN false ELSE bool_and\(w\.equal\) END/i)
  assert.doesNotMatch(summary, /GROUP BY/i, 'summary must return one aggregate row even for an unknown number')
})

test('why refuses unsupported weights, absent timestamps and values needing JSON escaping', () => {
  const sql = statements(read('sql/07_why.sql')).find(s => s.startsWith('CREATE'))
  assert.match(sql, /COMMENT '[^']*citations do not store weights/i)
  assert.match(sql, /lower\(c\.metric\) LIKE '%weighted%'/)
  for (const name of ['id', 'basis_source', 'a']) {
    assert.ok(sql.includes(`instr(${name}, '"') > 0 OR instr(${name}, chr(92)) > 0`))
  }
  assert.match(sql, /count_if\(id IS NULL\) AS missing_basis/)
  assert.match(sql, /count_if\(a IS NULL\) AS missing_at/)
  assert.match(sql, /WHEN missing_at > 0 THEN 'missing timestamp'/)
  assert.match(sql, /WHEN needs_escaping > 0 THEN 'needs json escaping'/)
  assert.match(sql, /WHEN weighted THEN 'weights not stored'/)
  assert.match(sql, /CASE WHEN reason IS NULL THEN digest END AS recomputed_hash/)
  assert.match(sql, /CASE WHEN h\.reason = 'weights not stored' THEN CAST\(NULL AS BOOLEAN\)/)
  assert.match(sql, /WHEN h\.reason IS NOT NULL THEN false/)
})

test('all data columns have provenance checks and only non-null ids get primary keys', () => {
  const parsed = statements(read('sql/08_constraints.sql'))
  for (const [, table, body] of tables) {
    if (/\bdata STRING/.test(body)) assert.ok(parsed.some(s => s.startsWith(`ALTER TABLE secondhand.core.${table} ADD CONSTRAINT `)
      && s.includes("CHECK (data RLIKE '^(synthetic|example|dataset:.+|live:.+)$')")), `${table}: missing data provenance check`)
    const primary = parsed.filter(s => s.startsWith(`ALTER TABLE secondhand.core.${table} ADD CONSTRAINT `) && s.includes('PRIMARY KEY'))
    assert.equal(primary.length, /\bid STRING NOT NULL/.test(body) ? 1 : 0, `${table}: primary key needs a NOT NULL id`)
  }
})

test('guard constraints enforce states and shown/hidden reasons; observation can be purged', () => {
  const sql = read('sql/08_constraints.sql')
  for (const expression of ["state IN ('shown','hidden','not_found')", "state <> 'shown' OR citation_id IS NOT NULL",
    "state <> 'hidden' OR hide_reason IS NOT NULL", "verdict IN ('pass','hold','abstain')", "policy_mode IN ('auto','ask','locked','never')"]) {
    assert.ok(sql.includes(`CHECK (${expression})`), `missing enforced guard: ${expression}`)
  }
  assert.match(sql, /FOREIGN KEY \(citation_id\) REFERENCES secondhand\.core\.citation \(id\)/)
  assert.match(sql, /FOREIGN KEY \(evidence_id\) REFERENCES secondhand\.core\.evidence \(id\)/)
  assert.match(sql, /ALTER TABLE secondhand\.core\.observation SET TBLPROPERTIES \('delta.appendOnly' = 'false', 'delta.enableDeletionVectors' = 'true'\)/)
  assert.match(sql, /agent proposal/i)
})

test('constraint reruns drop existing foreign keys before primary keys, then re-add everything', () => {
  const parsed = statements(read('sql/08_constraints.sql'))
  const constraints = new Map()
  for (let run = 0; run < 2; run++) for (const s of parsed) {
    const drop = s.match(/^ALTER TABLE (\S+) DROP CONSTRAINT IF EXISTS (\w+)$/)
    if (drop) {
      const key = `${drop[1]}.${drop[2]}`
      if (constraints.get(key)?.primary) assert.ok(![...constraints.values()].some(c => c.references === drop[1]), `rerun: ${key} still has dependent foreign keys`)
      constraints.delete(key)
    }
    const add = s.match(/^ALTER TABLE (\S+) ADD CONSTRAINT (\w+) (.+)$/s)
    if (!add) continue
    const key = `${add[1]}.${add[2]}`
    assert.ok(!constraints.has(key), `rerun: ${key} already exists`)
    const reference = add[3].match(/REFERENCES (\S+) \(id\)/)?.[1]
    if (reference) assert.ok([...constraints.values()].some(c => c.table === reference && c.primary), `${key}: referenced primary key is absent`)
    constraints.set(key, { table: add[1], primary: add[3].includes('PRIMARY KEY'), references: reference })
  }
  assert.ok(constraints.size >= 26, 'constraint file is incomplete')
})

test('the setup resource runs why then constraints on the warehouse; purge receives catalog and root', () => {
  const resource = read('../deploy/resources/governance.yml')
  assert.match(resource, /governance_setup:\s+name: secondhand-governance-setup/)
  const tasks = [...resource.matchAll(/- task_key: (\w+)([\s\S]*?)(?=\n        - task_key:|$)/g)]
  assert.equal(tasks.length, 2)
  tasks.forEach((t, i) => {
    assert.match(t[2], /sql_task:/)
    assert.ok(t[2].includes('warehouse_id: ${var.warehouse_id}'))
    const path = t[2].match(/path: (\S+)/)?.[1]
    assert.equal(path, `../../databricks/sql/${['07_why.sql', '08_constraints.sql'][i]}`)
    readFileSync(new URL(path, new URL('../deploy/resources/governance.yml', import.meta.url)), 'utf8')
  })
  assert.ok(tasks[1][2].includes(`task_key: ${tasks[0][1]}`), 'constraints must depend on why')
  const purge = read('../deploy/databricks.yml').split('    purge_user:')[1].split('\ntargets:')[0]
  assert.ok(purge.includes('parameters: ["{{job.parameters.user_id}}", "${var.catalog}", "--root", "${workspace.file_path}"]'))
})
