import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { query as workspaceQuery } from './run-sql.mjs'

const row = rows => {
  if (!Array.isArray(rows) || !rows.length) throw new Error('no rows returned')
  return rows[0]
}
const field = (r, name) => {
  if (r[name] === null || r[name] === undefined || r[name] === '') throw new Error(`missing ${name}`)
  return String(r[name])
}
const percent = value => {
  const n = Number(value)
  if (value === null || value === undefined || value === '' || !Number.isFinite(n)) throw new Error('invalid percentage')
  return `${(n * 100).toFixed(1)}%`
}
export function formatComps(rows) {
  const r = row(rows)
  return `comps: ${field(r, 'total')} from ${field(r, 'sources')} public sold sets; ${field(r, 'modelled')} cleared for training (${percent(r.share)}); newest dated comp ${field(r, 'newest')} (${field(r, 'age_days')} days old)`
}
export function formatExcluded(rows) {
  if (!Array.isArray(rows)) throw new Error('invalid rows')
  return `sources excluded from training: ${rows.length ? rows.map(r => `${field(r, 'source')} (${field(r, 'rows')})`).join(', ') : 'none'}`
}
export function formatBacktest(rows) {
  const r = row(rows)
  return `backtest: ${field(r, 'sentence')}; within 20%: ${field(r, 'primary')} ${percent(r.primary_value)} vs model ${percent(r.model_value)}; n ${field(r, 'n_tests')}`
}
export function formatWeights(rows) {
  const r = row(rows)
  return `weights: ${field(r, 'name')} moved ${field(r, 'promotions')} times and rolled back ${field(r, 'rollbacks')} times over ${field(r, 'months')} months; today ${field(r, 'value')}`
}
export function formatOpened(rows) {
  const r = row(rows)
  const cents = field(r, 'value_cents')
  if (!/^-?\d+$/.test(cents) || !Number.isSafeInteger(Number(cents))) throw new Error('value must be integer cents')
  const equal = field(r, 'equal')
  if (!['true', 'false'].includes(equal)) throw new Error('hash equality unavailable')
  return `one number opened: ${field(r, 'number_id')} = $${(Number(cents) / 100).toFixed(2)} from ${field(r, 'basis_count')} rows; recomputed hash equal: ${equal}`
}
export function formatNever(rows) { const r = row(rows); return `never automated: ${field(r, 'n')} actions asked, ${field(r, 'allowed')} allowed` }
export function formatViolations(rows) { return `guard violations: ${field(row(rows), 'n')}` }
export function formatMlflow(n) {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('invalid run count')
  return `MLflow: ${n} runs`
}

const sql = {
  comps: `SELECT count(*) AS total, count(DISTINCT source) AS sources, count_if(may_model) AS modelled, count_if(may_model) / nullif(count(*), 0) AS share, cast(max(sold_at) AS DATE) AS newest, datediff(current_date(), cast(max(sold_at) AS DATE)) AS age_days FROM secondhand.market.comp`,
  excluded: `SELECT source, count(*) AS rows FROM secondhand.market.comp WHERE may_model = false GROUP BY source ORDER BY source`,
  backtest: `WITH latest AS (SELECT * FROM secondhand.measures.backtest_run ORDER BY started_at DESC, run_id DESC LIMIT 1) SELECT r.sentence, r.n_tests, p.contestant AS primary, p.within_20 AS primary_value, m.within_20 AS model_value FROM latest r JOIN secondhand.measures.backtest_headline p ON p.run_id = r.run_id AND p.contestant = 'product_90d_median' JOIN secondhand.measures.backtest_headline m ON m.run_id = r.run_id AND m.contestant = 'model'`,
  weights: `WITH latest AS (SELECT run_id, name, scope FROM secondhand.measures.param_moves ORDER BY month DESC, run_id DESC, name, scope LIMIT 1), moves AS (SELECT m.* FROM secondhand.measures.param_moves m JOIN latest l ON m.run_id = l.run_id AND m.name = l.name AND m.scope = l.scope), current_move AS (SELECT * FROM moves ORDER BY month DESC, CASE action WHEN 'hold' THEN 4 WHEN 'promote' THEN 3 WHEN 'propose' THEN 2 ELSE 1 END DESC, version DESC LIMIT 1) SELECT c.name, count_if(m.action = 'promote') AS promotions, count_if(m.action = 'rollback') AS rollbacks, count(DISTINCT m.month) AS months, p.value_or_hyperparams AS value FROM current_move c JOIN moves m ON true JOIN secondhand.core.param p ON p.name = c.name AND p.scope = c.scope AND p.version = c.champion_version GROUP BY c.name, p.value_or_hyperparams`,
  opened: `WITH latest AS (SELECT id, value_cents FROM secondhand.core.guarded_number WHERE state = 'shown' AND data LIKE 'dataset:%' ORDER BY created_at DESC, id DESC LIMIT 1) SELECT g.id AS number_id, g.value_cents, w.basis_count, w.equal FROM latest g, LATERAL secondhand.measures.why_summary(g.id) w`,
  never: `SELECT count(*) AS n, count_if(allow = true) AS allowed FROM secondhand.measures.never_automated`,
  violations: `SELECT count(*) AS n FROM secondhand.measures.guard_violations`
}

function readBacktest(query) {
  const rows = query(sql.backtest)
  const exists = row(query(`SELECT count(*) AS n FROM secondhand.information_schema.views WHERE table_schema = 'measures' AND table_name = 'headline_latest'`))
  if (field(exists, 'n') !== '0') {
    const headline = row(query('SELECT * FROM secondhand.measures.headline_latest LIMIT 1'))
    rows[0].sentence = field(headline, 'sentence')
  }
  return rows
}
function cli(args) {
  try {
    return JSON.parse(execFileSync('databricks', args, { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'] }))
  } catch (e) {
    throw new Error(String(e.stderr || e.message).trim())
  }
}
export function readMlflow() {
  const experiment = cli(['experiments', 'get-by-name', '/Shared/secondhand/valuation-backtest', '--profile', 'Nate', '-o', 'json'])
  const id = experiment.experiment?.experiment_id ?? experiment.experiment_id
  if (!id) throw new Error('experiment id missing')
  let count = 0, token
  do {
    const args = ['experiments', 'search-runs', '--experiment-ids', String(id), '--profile', 'Nate', '-o', 'json']
    if (token) args.push('--page-token', token)
    const page = cli(args)
    if (!Array.isArray(page.runs)) {
      if (page.runs == null && !page.next_page_token) return count
      throw new Error('invalid runs response')
    }
    count += page.runs.length
    token = page.next_page_token
  } while (token)
  return count
}
export function main({ query = workspaceQuery, mlflow = readMlflow, write = line => process.stdout.write(`${line}\n`), now = () => new Date().toISOString() } = {}) {
  write(`read at ${now()}, workspace profile Nate`)
  let failed = false
  const reads = [
    ['comps', () => formatComps(query(sql.comps))],
    ['sources excluded from training', () => formatExcluded(query(sql.excluded))],
    ['backtest', () => formatBacktest(readBacktest(query))],
    ['weights', () => formatWeights(query(sql.weights))],
    ['one number opened', () => formatOpened(query(sql.opened))],
    ['never automated', () => formatNever(query(sql.never))],
    ['guard violations', () => formatViolations(query(sql.violations))],
    ['MLflow', () => formatMlflow(mlflow())]
  ]
  for (const [label, read] of reads) {
    let line
    try { line = read() } catch (e) {
      failed = true
      const reason = String(e.message || e).split('\n').filter(Boolean).at(-1).slice(0, 80)
      line = `${label}: not read (${reason})`
    }
    write(`${line} (read at ${now()})`)
  }
  return failed ? 1 : 0
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main()
