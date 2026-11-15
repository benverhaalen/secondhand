import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const expectedTables = [
  'market.comp', 'market.product', 'market.comp_daily',
  'measures.valuation_accuracy', 'measures.backtest_headline', 'measures.backtest_run',
  'measures.param_moves', 'measures.param_timeline', 'measures.citation_coverage',
  'measures.hidden_numbers', 'measures.decisions_by_policy', 'measures.never_automated',
  'measures.rights_audit_summary', 'measures.locks_in_force', 'measures.price_basis', 'measures.guard_violations',
  'measures.bench_coverage', 'measures.bench_speed', 'measures.engine_ablation', 'measures.backtest_estimate', 'measures.shown_prices', 'measures.pipeline_funnel', 'governance.source_rights',
].map(name => `secondhand.${name}`).sort()
const categorical = ['source', 'site', 'kind', 'brand', 'category', 'condition'].sort()
const ddl = directory => readdirSync(new URL(directory, import.meta.url))
  .filter(file => file.endsWith('.sql')).map(file => read(`${directory}/${file}`)).join('\n')
const sqlDDL = ddl('sql')
const pipelineDDL = ddl('pipelines/market')
const creates = /\bCREATE\s+(?:(?:OR\s+(?:REPLACE|REFRESH)|STREAMING|MATERIALIZED)\s+)*(TABLE|VIEW|FUNCTION)\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w.]+)/gi
const registry = new Map()
for (const [text, prefix] of [[sqlDDL, ''], [pipelineDDL, 'secondhand.market.']]) {
  for (const [, kind, name] of text.matchAll(creates)) {
    registry.set(name.includes('.') ? name : prefix + name, kind.toUpperCase())
  }
}

function strings(value, path, nonempty = true) {
  assert.ok(Array.isArray(value) && value.every(s => typeof s === 'string'), `${path}: expected an array of strings`)
  if (nonempty) assert.ok(value.length > 0, `${path}: must not be empty`)
}

function sorted(items, key, path) {
  assert.ok(Array.isArray(items), `${path}: expected an array`)
  const keys = items.map(item => item[key])
  assert.deepEqual(keys, [...keys].sort(), `${path}: must be sorted by ${key}`)
  assert.equal(new Set(keys).size, keys.length, `${path}: duplicate ${key}`)
}

// Tokenize strings and comments away before inspecting relation positions. Commas
// in SELECT lists or function arguments must not be mistaken for table joins.
function checkSQL(sql, path, attached) {
  const tokens = sql.match(/--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|`[^`]+`|[A-Za-z_][\w]*|[^\s]/g)
    .filter(t => !t.startsWith('--') && !t.startsWith('/*'))
    .map(t => t.startsWith("'") || t.startsWith('"') ? '<literal>' : t.replaceAll('`', '').toLowerCase())
  assert.ok(['select', 'with'].includes(tokens[0]), `${path}: SQL must be read-only SELECT or WITH`)
  assert.ok(!tokens.some(t => ['insert', 'update', 'delete', 'merge', 'drop', 'alter', 'create', 'copy'].includes(t)), `${path}: SQL must be read-only`)
  const ctes = new Set()
  if (tokens[0] === 'with') {
    for (let i = 0; i < tokens.length - 2; i++) {
      if (tokens[i + 1] === 'as' && tokens[i + 2] === '(') ctes.add(tokens[i])
    }
  }
  const fromAt = new Set()
  let depth = 0
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token === '(') { depth++; continue }
    if (token === ')') { fromAt.delete(depth); depth--; continue }
    if (['where', 'group', 'order', 'having', 'qualify', 'union', 'limit'].includes(token)) fromAt.delete(depth)
    if (token !== 'from' && token !== 'join' && !(token === ',' && fromAt.has(depth))) continue
    fromAt.add(depth)
    if (tokens[i + 1] === '(') continue
    const lateral = tokens[i + 1] === 'lateral'
    if (lateral) i++
    let name = tokens[++i]
    while (tokens[i + 1] === '.') { name += '.' + tokens[i + 2]; i += 2 }
    if (ctes.has(name)) continue
    assert.match(name, /^\w+\.\w+\.\w+$/, `${path}: unqualified table ${name}`)
    assert.ok(registry.has(name), `${path}: unknown SQL relation ${name}`)
    assert.equal(registry.get(name) === 'FUNCTION', tokens[i + 1] === '(', `${path}: table/function call shape for ${name}`)
    if (name === 'secondhand.measures.why') {
      // A literal id, or under LATERAL one column of the row on its left; never a subquery.
      const column = lateral && /^\w+$/.test(tokens[i + 2]) && tokens[i + 3] === '.' && /^\w+$/.test(tokens[i + 4]) && tokens[i + 5] === ')'
      assert.ok(column || (tokens[i + 2] === '<literal>' && tokens[i + 3] === ')'), `${path}: why() needs a literal id or a LATERAL column; subqueries are not supported`)
    }
    if (attached) {
      assert.notEqual(registry.get(name), 'FUNCTION', `${path}: Genie cannot call table function ${name}`)
      assert.ok(attached.has(name), `${path}: SQL source is not attached: ${name}`)
    }
  }
}

function validate(space) {
  assert.equal(space.version, 2, 'version must be 2')
  assert.ok(Buffer.byteLength(JSON.stringify(space)) <= 3_500_000, 'serialized space exceeds 3.5 MB')
  const ids = new Set()
  const textFields = new Set(['question', 'sql', 'content', 'description', 'synonyms', 'usage_guidance', 'evaluation_note'])
  function walk(value, path = 'space') {
    if (typeof value === 'string') assert.ok(value.length <= 25_000, `${path}: string exceeds 25000 characters`)
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) {
      if (value.some(item => item && typeof item === 'object' && 'id' in item)) sorted(value, 'id', path)
      value.forEach((item, i) => walk(item, `${path}[${i}]`))
      return
    }
    if ('id' in value) {
      assert.match(value.id, /^[0-9a-f]{32}$/, `${path}: id must be 32 lowercase hex characters`)
      assert.ok(!ids.has(value.id), `${path}: duplicate id ${value.id}`)
      ids.add(value.id)
    }
    for (const [key, child] of Object.entries(value)) {
      if (textFields.has(key)) strings(child, `${path}.${key}`, key !== 'content')
      if (key === 'identifier') {
        assert.match(child, /^\w+\.\w+\.\w+$/, `${path}: identifier must be fully qualified`)
        assert.ok(['TABLE', 'VIEW'].includes(registry.get(child)), `${path}: unknown table identifier ${child}`)
      }
      walk(child, `${path}.${key}`)
    }
  }
  walk(space)
  const tables = space.data_sources.tables
  assert.ok(tables.length <= 30, 'data_sources.tables: exceeds 30 entries')
  sorted(tables, 'identifier', 'data_sources.tables')
  if (space.data_sources.metric_views) sorted(space.data_sources.metric_views, 'identifier', 'data_sources.metric_views')
  for (const table of tables) {
    if (table.column_configs) sorted(table.column_configs, 'column_name', `${table.identifier}.column_configs`)
  }
  const instructions = space.instructions
  assert.ok(!('benchmarks' in instructions), 'benchmarks must be top level')
  assert.ok(instructions.text_instructions.length <= 1, 'text_instructions: at most one item')
  for (const [path, items, fields] of [
    ['sample_questions', space.config.sample_questions, ['question']],
    ['text_instructions', instructions.text_instructions, ['content']],
    ['example_question_sqls', instructions.example_question_sqls, ['question', 'sql']],
    ['benchmarks.questions', space.benchmarks.questions, ['question', 'answer']],
  ]) {
    assert.ok(Array.isArray(items), `${path}: expected array`)
    for (const item of items) {
      assert.ok('id' in item, `${path}: missing id`)
      for (const key of fields) assert.ok(Array.isArray(item[key]) && item[key].length, `${path}: missing ${key}`)
    }
  }
  const attached = new Set([...tables, ...(space.data_sources.metric_views ?? [])].map(t => t.identifier))
  for (const item of instructions.example_question_sqls) checkSQL(item.sql.join('\n'), `example ${item.id}`, attached)
  for (const question of space.benchmarks.questions) {
    for (const answer of question.answer) {
      assert.equal(answer.format, 'SQL', `benchmark ${question.id}: format must be SQL`)
      strings(answer.content, `benchmark ${question.id}.content`, false)
      if (answer.content.length) checkSQL(answer.content.join('\n'), `benchmark ${question.id}`, attached)
      else strings(question.evaluation_note, `benchmark ${question.id}.evaluation_note`)
    }
  }
  for (const join of instructions.join_specs ?? []) {
    assert.ok(join.id && join.left?.identifier && join.right?.identifier, 'join_specs: missing id or sources')
    assert.equal(join.sql.length, 2, 'join_specs.sql: must have condition and relationship tag')
    assert.match(join.sql[1], /^--rt=FROM_RELATIONSHIP_TYPE_(?:ONE_TO_MANY|MANY_TO_ONE|ONE_TO_ONE|MANY_TO_MANY)--$/, 'join_specs.sql: relationship tag')
  }
  for (const items of Object.values(instructions.sql_snippets ?? {})) {
    for (const item of items) {
      assert.ok(item.id, 'sql_snippets: missing id')
      strings(item.sql, 'sql_snippets.sql')
    }
  }
}

const fixture = () => ({
  version: 2,
  config: { sample_questions: [{ id: '10000000000000000000000000000001', question: ['Question?'] }] },
  data_sources: { tables: [{ identifier: 'secondhand.market.comp' }] },
  instructions: {
    text_instructions: [{ id: '20000000000000000000000000000001', content: ['Rules.'] }],
    example_question_sqls: [1, 2].map(i => ({ id: `3000000000000000000000000000000${i}`, question: ['Count?'], sql: ['SELECT count(*) FROM secondhand.market.comp'] })),
  },
  benchmarks: { questions: [{ id: '40000000000000000000000000000001', question: ['Count?'], answer: [{ format: 'SQL', content: ['SELECT count(*) FROM secondhand.market.comp'] }] }] },
})

// Failure cases precede artifact checks so API rejections have specific causes.
for (const [name, change, error] of [
  ['unsorted id array', s => s.instructions.example_question_sqls.reverse(), /sorted by id/],
  ['string instead of text array', s => { s.config.sample_questions[0].question = 'Count?' }, /array of strings/],
  ['nonexistent table', s => { s.data_sources.tables[0].identifier = 'secondhand.market.missing' }, /unknown table identifier/],
  ['duplicate question id across samples and benchmarks', s => { s.benchmarks.questions[0].id = s.config.sample_questions[0].id }, /duplicate id/],
  ['duplicate instruction id', s => { s.instructions.text_instructions[0].id = s.instructions.example_question_sqls[0].id }, /duplicate id/],
  ['uppercase id', s => { s.config.sample_questions[0].id = 'A'.repeat(32) }, /32 lowercase hex/],
  ['missing id', s => { delete s.config.sample_questions[0].id }, /missing id/],
  ['multiple text instructions', s => { s.instructions.text_instructions.push({ id: '20000000000000000000000000000002', content: ['More.'] }) }, /at most one/],
  ['nested benchmarks', s => { s.instructions.benchmarks = s.benchmarks }, /duplicate id|top level/],
  ['unsorted tables', s => { s.data_sources.tables = [{ identifier: 'secondhand.market.product' }, { identifier: 'secondhand.market.comp' }] }, /sorted by identifier/],
  ['unsorted column configs', s => { s.data_sources.tables[0].column_configs = [{ column_name: 'source' }, { column_name: 'brand' }] }, /sorted by column_name/],
  ['too many tables', s => { s.data_sources.tables = Array(31).fill(s.data_sources.tables[0]) }, /exceeds 30/],
  ['oversized string', s => { s.config.sample_questions[0].question = ['x'.repeat(25_001)] }, /exceeds 25000/],
  ['oversized space', s => { s.config.sample_questions[0].question = Array(150).fill('x'.repeat(25_000)) }, /exceeds 3.5 MB/],
  ['non SQL benchmark', s => { s.benchmarks.questions[0].answer[0].format = 'TEXT' }, /format must be SQL/],
  ['empty benchmark without grading note', s => { s.benchmarks.questions[0].answer[0].content = [] }, /array of strings/],
  ['unqualified table', s => { s.instructions.example_question_sqls[0].sql = ['SELECT * FROM comp'] }, /unqualified table/],
  ['unqualified comma join', s => { s.instructions.example_question_sqls[0].sql = ['SELECT * FROM secondhand.market.comp c, product p'] }, /unqualified table/],
  ['nonexistent SQL relation', s => { s.instructions.example_question_sqls[0].sql = ['SELECT * FROM secondhand.market.missing'] }, /unknown SQL relation/],
  ['why subquery', s => { s.instructions.example_question_sqls[0].sql = ['SELECT * FROM secondhand.measures.why((SELECT id FROM secondhand.core.guarded_number))'] }, /literal id/],
]) {
  test(`rejects ${name}`, () => {
    const space = fixture()
    validate(space)
    change(space)
    assert.throws(() => validate(space), error)
  })
}

test('SQL relation check handles CTEs, quoted identifiers, nested joins, comments and literals', () => {
  checkSQL("WITH counts AS (SELECT count(*) n FROM `secondhand`.`market`.`comp`) SELECT 'FROM missing' FROM counts -- JOIN missing", 'CTE')
  assert.throws(() => checkSQL('SELECT * FROM (SELECT * FROM comp) c', 'nested'), /unqualified table/)
  assert.throws(() => checkSQL('SELECT * FROM secondhand.market.comp JOIN missing ON true', 'join'), /unqualified table/)
  assert.throws(() => checkSQL('DELETE FROM secondhand.market.comp', 'write'), /read-only/)
})

test('market space follows the serialized-space version 2 contract', () => validate(JSON.parse(read('genie/market.json'))))

test('Genie rejects known but unattached relations and table functions', () => {
  const attached = new Set(['secondhand.market.comp'])
  assert.throws(() => checkSQL('SELECT * FROM secondhand.market.product', 'unattached', attached), /not attached/)
  assert.throws(() => checkSQL("SELECT * FROM secondhand.measures.why('id')", 'function', attached), /cannot call table function/)
})

// Inspect the result projection, not a dataset/count hidden inside a CTE.
function resultProjection(sql) {
  const tokens = sql.match(/'(?:''|[^'])*'|`[^`]+`|\w+|[^\s]/g)
  let depth = 0
  let start = -1
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === '(') depth++
    if (tokens[i] === ')') depth--
    if (depth === 0 && tokens[i].toLowerCase() === 'select') start = i + 1
    if (depth === 0 && start >= 0 && tokens[i].toLowerCase() === 'from') return tokens.slice(start, i).join(' ')
  }
  assert.fail('missing final SELECT projection')
}

test('judge examples carry dataset, named counts and reading into the result and answer opening', async () => {
  const { QUESTIONS } = await import('./genie/ask.mjs')
  const examples = JSON.parse(read('genie/market.json')).instructions.example_question_sqls
  const counts = ['sales_cited', 'sales_tested', 'sales_tested', 'months_covered', 'sales_contributed', 'sales_counted', 'sales_counted', 'tables_checked']
  for (const [i, question] of QUESTIONS.entries()) {
    const matches = examples.filter(e => e.question.includes(question))
    assert.equal(matches.length, 1, `${question}: needs exactly one matching example`)
    const example = matches[0]
    const projection = resultProjection(example.sql.join('\n'))
    for (const column of ['dataset', counts[i], 'reading']) {
      assert.match(projection, new RegExp(`\\bAS ${column}\\b`, 'i'), `${question}: result must select ${column}`)
      assert.match(example.usage_guidance.join(' '), new RegExp(`\\b${column}\\b`), `${question}: guidance must quote ${column}`)
    }
    assert.match(example.usage_guidance[0], /^Start the answer with .*dataset.*(?:sales_|months_|tables_)/, `${question}: opening must name dataset and count columns`)
  }
  for (const example of examples) assert.match(example.usage_guidance[0], /^Start the answer with /, `example ${example.id}: answer opening`)
})

test('comparison selects exactly four labelled contestants from the same ablation with paired gaps only for served', () => {
  const examples = JSON.parse(read('genie/market.json')).instructions.example_question_sqls
  for (const suffix of ['20d', '20f']) {
    const example = examples.find(e => e.id.endsWith(suffix))
    assert.ok(example, `${suffix}: missing comparison example`)
    const sql = example.sql.join('\n')
    assert.match(sql, /a\.label AS contestant/i)
    const filter = sql.match(/a\.contestant IN \(([^)]+)\)/i)
    assert.ok(filter, `${suffix}: select contestants explicitly`)
    const contestants = [...filter[1].matchAll(/'([^']+)'/g)].map(m => m[1]).sort()
    assert.deepEqual(contestants, ['engine_all_on', 'last_sale', 'market_model', 'product_90d_median'])
    const rows = [...read('sql/14_engine.sql').matchAll(/\('([^']+)', '([^']+)', (true|false), 'dataset:stockx_2019'/g)]
      .filter(m => contestants.includes(m[1]))
    assert.equal(rows.length, 4, 'filter must yield four rows in the SQL fixture')
    assert.equal(new Set(rows.map(m => m[2])).size, 4, 'each contestant must have its own label')
    assert.doesNotMatch(sql, /UNION|valuation_metrics|backtest_headline/i)
    for (const [source, column] of [['within_20', 'within_20_percent'], ['median_error', 'median_error'], ['range_held', 'range_held_the_sale'], ['priced', 'share_priced']]) {
      assert.match(sql, new RegExp(`a\\.${source} AS ${column}\\b`, 'i'), `${suffix}: ${column} must come from this contestant's ${source}`)
    }
    for (const column of ['vs_last_sale_points', 'vs_last_sale_lo', 'vs_last_sale_hi', 'vs_last_sale_n']) {
      assert.match(sql, new RegExp(`CASE WHEN a\\.served THEN a\\.${column} END AS ${column}`, 'i'), `${suffix}: ${column} belongs only to served engine`)
      assert.match(example.usage_guidance.join(' '), new RegExp(column))
    }
  }
})

test('judge detail answers summarize citations, moves and governance without losing their evidence', () => {
  const examples = JSON.parse(read('genie/market.json')).instructions.example_question_sqls
  for (const [suffix, count, details] of [['20c', 'sales_cited', 'cited_sales'], ['205', 'months_covered', 'moves'], ['207', 'tables_checked', 'tables']]) {
    const sql = examples.find(e => e.id.endsWith(suffix)).sql.join('\n')
    assert.match(sql, new RegExp(`count\\([\\s\\S]+?AS ${count}`, 'i'), `${suffix}: compute summary count`)
    assert.match(sql, new RegExp(`collect_list\\(named_struct\\([\\s\\S]+?AS ${details}`, 'i'), `${suffix}: retain evidence in summary`)
  }
  const zebra = examples.find(e => e.id.endsWith('20c'))
  assert.match(zebra.sql.join('\n'), /count_if\(b\.rebuilt_exactly IS NULL\)[\s\S]+bool_and\(b\.rebuilt_exactly\)/i)
  assert.match(zebra.usage_guidance.join(' '), /never.*verified.*real/i)
  for (const suffix of ['20b', '210']) {
    const sql = examples.find(e => e.id.endsWith(suffix)).sql.join('\n')
    assert.match(sql, /count\(\*\) AS sales_counted/i)
    assert.match(sql, /CASE WHEN count\(\*\) < 30 THEN concat\('too few: '/i)
    assert.match(sql, /CASE WHEN count\(\*\) >= 30 THEN percentile_approx/i)
    assert.match(sql, /price_type = 'sold'/i)
  }
})

test('source contributions count sold sales separately from pipeline rows', () => {
  const example = JSON.parse(read('genie/market.json')).instructions.example_question_sqls.find(e => e.id.endsWith('20e'))
  const sql = example.sql.join('\n')
  assert.match(sql, /count\(\*\) AS sales_contributed[\s\S]*FROM secondhand\.market\.comp c[\s\S]*WHERE c\.price_type = 'sold'/i)
  assert.doesNotMatch(sql, /f\.(?:kept|modelled)\s+AS sales_|'sales_contributed', f\.kept/i)
  assert.match(sql, /'rows_kept', f\.kept/)
  assert.match(sql, /'model_eligible_rows', f\.modelled/)
  assert.match(sql, /collect_list\(named_struct\([\s\S]*AS sources/i)
})

test('market space attaches the requested tables and limits categorical assistance', () => {
  const space = JSON.parse(read('genie/market.json'))
  assert.deepEqual(space.data_sources.tables.map(t => t.identifier), expectedTables)
  const comp = space.data_sources.tables.find(t => t.identifier === 'secondhand.market.comp')
  for (const flag of ['enable_format_assistance', 'enable_entity_matching']) {
    assert.deepEqual(comp.column_configs.filter(c => c[flag]).map(c => c.column_name), categorical)
    for (const table of space.data_sources.tables) {
      for (const c of table.column_configs ?? []) if (c[flag]) assert.ok(categorical.includes(c.column_name), `${flag}: ${c.column_name}`)
    }
  }
  for (const [column, pattern] of [['price_cents', /integer.*US cents/], ['may_model', /the source allows training/], ['data', /provenance/]]) {
    assert.match(comp.column_configs.find(c => c.column_name === column).description.join(' '), pattern)
  }
  const compBody = pipelineDDL.match(/TABLE comp\s*\(([\s\S]*?)\n\)/)[1]
  const columns = [...compBody.matchAll(/^\s*(\w+)\s+(?:STRING|BIGINT|BOOLEAN|TIMESTAMP|ARRAY)/gm)].map(m => m[1])
  for (const c of comp.column_configs) assert.ok(columns.includes(c.column_name), `unknown comp column: ${c.column_name}`)
  for (const column of columns.filter(c => /seller.*(?:id|name|handle|email|phone)|^(?:seller|user_id|buyer_id)$/.test(c))) {
    assert.equal(comp.column_configs.find(c => c.column_name === column)?.exclude, true, `seller identity must be excluded: ${column}`)
  }
})

test('instructions keep cents, thin counts, historical scope, provenance, proof and training rights', () => {
  const rules = JSON.parse(read('genie/market.json')).instructions.text_instructions[0].content.join('\n')
  for (const pattern of [/integer.*cents/i, /divid\w* by 100/i, /fewer than 30/i, /too few: N sales/, /wider date range/, /parent kind/,
    /every accuracy answer/i, /dataset/, /families/, /backtest_run/, /backtest_headline/, /2017-09/, /2019-02/, /never.*today.s market/i,
    /synthetic/, /example/, /secondhand\.measures\.price_basis/, /SELECT \* FROM secondhand\.measures\.why\('<id>'\), which Genie does not call/, /rebuilds exactly from the sales it cites/, /never describe it as verified, real or confirmed/, /engine_ablation/, /does not serve/, /trails the last sale by about a point/, /Every answer names its dataset/, /may_model = true/, /secondhand\.market\.comp_for_model/]) assert.match(rules, pattern)
})

test('examples and benchmarks cover the required judge questions with guarded SQL shapes', () => {
  const space = JSON.parse(read('genie/market.json'))
  assert.equal(space.config.sample_questions.length, 5)
  assert.ok(space.instructions.example_question_sqls.length >= 8)
  const examples = space.instructions.example_question_sqls
  const sqls = examples.map(e => e.sql.join('\n'))
  for (const pattern of [/count_if\(.*may_model/i, /CASE WHEN count\(\*\) >= 30[\s\S]*percentile_approx/i,
    /backtest_headline[\s\S]*backtest_run[\s\S]*row_number\(\)/i, /product_90d_median/,
    /param_moves[\s\S]*ORDER BY/i, /never_automated[\s\S]*allow = true/i,
    /(?=[\s\S]*locks_in_force)(?=[\s\S]*has_owner_tag)/i, /secondhand\.measures\.price_basis[\s\S]*WHERE b\.id = '[^']+'/]) {
    assert.ok(sqls.some(sql => pattern.test(sql)), `missing example shape: ${pattern}`)
  }
  const why = examples.find(e => e.id.endsWith('208'))
  assert.match(why.usage_guidance.join(' '), /substitute.*id/i)
  assert.equal(space.benchmarks.questions.length, 10)
  const refusals = space.benchmarks.questions.filter(q => q.answer.every(a => a.content.length === 0))
  assert.equal(refusals.length, 2)
  for (const q of refusals) {
    assert.match(q.evaluation_note.join(' '), /must refuse.*count/i)
    assert.match(q.evaluation_note.join(' '), /too few: N sales/)
    assert.match(q.evaluation_note.join(' '), /SELECT count\(\*\)/i)
    const countSQL = q.evaluation_note.join(' ').match(/Count with (SELECT[\s\S]+?)\. Do not/)[1]
    checkSQL(countSQL, `refusal count ${q.id}`, new Set(space.data_sources.tables.map(t => t.identifier)))
  }
  const allSQL = [...sqls, ...space.benchmarks.questions.flatMap(q => q.answer.filter(a => a.content.length).map(a => a.content.join('\n')))]
  for (const sql of allSQL.filter(s => /backtest_headline|valuation_accuracy/.test(s))) {
    for (const pattern of [/backtest_run/, /backtest_headline/, /test_from/, /test_to/, /families/, /\.data/]) assert.match(sql, pattern)
  }
})

test('bundle declares secondhand market using a resource-relative JSON path and warehouse variable', () => {
  const resource = read('../deploy/resources/genie.yml')
  assert.match(resource, /^resources:\n  genie_spaces:\n    market:/)
  assert.match(resource, /title: ["']?secondhand market/)
  assert.match(resource, /description: .+/)
  assert.match(resource, /warehouse_id: \$\{var\.warehouse_id\}/)
  const path = resource.match(/file_path: ["']?([^\s"']+)/)[1]
  assert.equal(new URL(path, new URL('../deploy/resources/genie.yml', import.meta.url)).href, new URL('genie/market.json', import.meta.url).href)
  assert.doesNotMatch(resource, /serialized_space:/)
})

test('the answer recorder writes Genie words, its SQL and any error under the question', async () => {
  const { section, QUESTIONS } = await import('./genie/ask.mjs')
  const md = section('Q?', { status: 'COMPLETED', attachments: [{ text: { content: ' too few: 10 sales ' } }, { query: { query: 'SELECT 1' } }] })
  assert.equal(md, '## Q?\n\nStatus: COMPLETED\n\ntoo few: 10 sales\n\n```sql\nSELECT 1\n```')
  assert.match(section('Q?', { status: 'FAILED', error: { error: 'boom' } }), /Error: boom$/)
  const samples = JSON.parse(read('genie/market.json')).config.sample_questions.map(q => q.question[0])
  for (const q of samples) assert.ok(QUESTIONS.includes(q), `sample question not recorded: ${q}`)
})
