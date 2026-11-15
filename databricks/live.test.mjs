import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatComps, formatOpened, formatBacktest, formatExcluded, formatWeights, formatNever, formatViolations, formatMlflow, main } from './live.mjs'

test('share is converted from a fraction to a percentage', () => {
  assert.equal(formatComps([{ total: '100', sources: '2', modelled: '75', share: '0.75', newest: '2019-01-01', age_days: '42' }]), 'comps: 100 from 2 public sold sets; 75 cleared for training (75.0%); newest dated comp 2019-01-01 (42 days old)')
})
test('money in cents must be an integer, not a float', () => {
  assert.throws(() => formatOpened([{ number_id: 'n', value_cents: '123.4', basis_count: '3', equal: 'true' }]), /integer cents/)
  assert.equal(formatOpened([{ number_id: 'n', value_cents: '1234', basis_count: '3', equal: 'true' }]), 'one number opened: n = $12.34 from 3 rows; recomputed hash equal: true')
})
test('a missing view produces a not-read line and later reads continue', () => {
  const lines = []
  const status = main({ query: () => { throw new Error('missing view') }, mlflow: () => 4, write: line => lines.push(line), now: () => '2026-01-01T00:00:00.000Z' })
  assert.equal(status, 1)
  assert.equal(lines.length, 9)
  assert.match(lines[1], /comps: not read \(missing view\)/)
  assert.match(lines[8], /MLflow: 4 runs/)
})
test('format remaining lines from returned rows', () => {
  assert.equal(formatExcluded([{ source: 'a', rows: '4' }]), 'sources excluded from training: a (4)')
  assert.equal(formatBacktest([{ sentence: 'claim', primary: 'product_median', primary_value: '0.2', model_value: '0.35', n_tests: '20' }]), 'backtest: claim; within 20%: product_median 20.0% vs model 35.0%; n 20')
  assert.equal(formatWeights([{ name: 'weight', promotions: '2', rollbacks: '1', months: '4', value: '30' }]), 'weights: weight moved 2 times and rolled back 1 times over 4 months; today 30')
  assert.equal(formatNever([{ n: '10', allowed: '0' }]), 'never automated: 10 actions asked, 0 allowed')
  assert.equal(formatViolations([{ n: '0' }]), 'guard violations: 0')
  assert.equal(formatMlflow(12), 'MLflow: 12 runs')
})
