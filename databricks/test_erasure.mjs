import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { statements } from './run-sql.mjs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('erasure SQL splits into complete statements accepted by the SQL runner', () => {
  const sql = read('sql/12_erasure.sql')
  const parts = statements(sql)
  assert.equal(parts.length, 5, 'expected tombstone table, three revokes and grants view')
  assert.ok(sql.trim().endsWith(';'))
  for (const part of parts) {
    assert.match(part, /^(CREATE|REVOKE) /)
    assert.doesNotMatch(part.replace(/'(?:''|[^'])*'/g, ''), /;/, 'statement was not split')
  }
  const table = parts.find(s => s.startsWith('CREATE TABLE IF NOT EXISTS secondhand.governance.erasure'))
  for (const [column, type] of [['user_id', 'STRING'], ['requested_at', 'TIMESTAMP'], ['purged_at', 'TIMESTAMP'],
    ['tables', 'STRING'], ['files_rewritten', 'INT'], ['vacuum_due_at', 'TIMESTAMP'], ['vacuumed_at', 'TIMESTAMP']]) {
    assert.match(table, new RegExp(`\\b${column} ${type}\\b`), `missing erasure.${column}`)
  }
  assert.match(sql, /tombstone every loader reads/i)
  assert.match(sql, /never written again/i)
  assert.match(table, /tables STRING[^\n]*JSON/i)
})

test('only the owner writes principal mappings, break-glass windows and erasure tombstones', () => {
  const parts = statements(read('sql/12_erasure.sql'))
  for (const table of ['principal_map', 'break_glass', 'erasure']) {
    assert.ok(parts.includes(`REVOKE ALL PRIVILEGES ON TABLE secondhand.governance.${table} FROM \`account users\``),
      `${table}: account users must not gain mapping or tombstone privileges`)
  }
  const view = parts.find(s => s.startsWith('CREATE OR REPLACE VIEW secondhand.measures.governance_grants'))
  assert.match(view, /SELECT grantor, grantee, table_schema, table_name, privilege_type/)
  assert.match(view, /FROM secondhand\.information_schema\.table_privileges/)
  assert.match(view, /table_schema = 'governance'/)
  for (const table of ['principal_map', 'break_glass', 'erasure']) assert.ok(view.includes(`'${table}'`))
})

test('daily serverless vacuum stays unpaused in dev and prod and receives the synced root', () => {
  const yaml = read('../deploy/resources/erasure.yml')
  assert.match(yaml, /vacuum_core:\s+name: secondhand-vacuum-core/)
  assert.match(yaml, /quartz_cron_expression: "0 0 4 \* \* \?"/)
  assert.match(yaml, /timezone_id: America\/Chicago\s+pause_status: UNPAUSED/)
  assert.match(yaml, /max_concurrent_runs: 1/)
  assert.match(yaml, /environment_key: erasure\s+spec:\s+environment_version: "3"/)
  assert.match(yaml, /spark_python_task:\s+python_file: ..\/tasks\/purge.py/)
  assert.ok(yaml.includes('parameters: ["--vacuum", "--catalog", "${var.catalog}", "--root", "${workspace.file_path}"]'),
    'scheduled vacuum must use the same catalog as purge_user')
  assert.doesNotMatch(yaml, /new_cluster:|existing_cluster_id:/)
  assert.match(yaml, /dev:[\s\S]*vacuum_core:[\s\S]*pause_status: UNPAUSED/)
  assert.match(yaml, /prod[^\n]*UNPAUSED[^\n]*deletion depends on it/i)
  assert.ok(yaml.includes('../../databricks/sql/12_erasure.sql'), 'setup must be runnable before purge and loaders')
})

test('purge writes the decision after completing the tombstone, inside break glass', () => {
  const source = read('../deploy/tasks/purge.py')
  const body = source.slice(source.indexOf('def run_purge('), source.indexOf('\ndef delete_captures('))
  assert.ok(body.includes('with break_glass('))
  const update = body.indexOf('UPDATE {governance}.`erasure`')
  const decision = body.indexOf('sql(*decision_statement(')
  assert.ok(update >= 0 && decision > update, 'completion update must precede the durable decision')
  assert.match(body, /loader[^\n]*MERGE[^\n]*non-log/i)
  assert.doesNotMatch(source, /retentionDurationCheck|RETAIN (?:0|1|24) HOURS/)
})
