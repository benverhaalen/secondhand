import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const stages = ['capture', 'type', 'process', 'identify', 'valuate', 'draft', 'post',
  'accept_offer', 'answer_offer', 'listing.sold', 'poll_orders', 'delist'];
const run = (...args) => spawnSync(process.execPath, ['scripts/walk.mjs', ...args], {
  cwd: root, encoding: 'utf8', timeout: 15000,
});
const lines = result => result.stdout.trim().split('\n').map(line => JSON.parse(line));

test('one fixture item runs all twelve stages and finishes sold once and ended elsewhere', t => {
  const result = run();
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  t.diagnostic(result.stdout.trim());
  const output = lines(result);
  assert.deepEqual(output.slice(0, -1).map(row => row.stage), stages);
  for (const row of output.slice(0, -1)) {
    assert.ok(['real', 'fake'].includes(row.mode), row.stage);
    assert.ok(row.counts.in > 0 && row.counts.out > 0, `${row.stage}: zero rows`);
    assert.ok(Number.isFinite(row.ms) && row.ms >= 0, row.stage);
  }
  for (const stage of ['type', 'process', 'identify', 'valuate', 'draft', 'accept_offer', 'listing.sold', 'poll_orders', 'delist']) {
    assert.equal(output.find(row => row.stage === stage).mode, 'real', stage);
  }
  assert.equal(output.find(row => row.stage === 'post').mode, 'fake');
  const total = output.at(-1);
  assert.equal(total.stage, 'total');
  assert.equal(total.ok, true);
  assert.equal(total.counts.stages, 12);
  assert.equal(total.item.state, 'sold');
  assert.deepEqual(total.sites, { poshmark: 'sold', ebay: 'delisted', depop: 'delisted' });
  assert.ok(total.ms >= 0);
});

test('a planted throwing stage exits non-zero and names the cause', () => {
  const result = run('--fail-stage', 'identify');
  assert.ifError(result.error);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /identify: planted failure/);
  assert.equal(lines(result).at(-1).ok, false);
});

test('zero valuation rows are flagged at valuate instead of passing downstream', () => {
  const result = run('--empty-stage', 'valuate');
  assert.ifError(result.error);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /valuate: zero rows/);
});

test('a partial --stage diagnostic reports its stage and cannot claim a completed walk', () => {
  const result = run('--stage', '2');
  assert.ifError(result.error);
  assert.notEqual(result.status, 0);
  assert.deepEqual(lines(result).map(row => row.stage), ['type', 'total']);
  assert.match(result.stderr, /incomplete/);
});

test('an invalid stage is rejected instead of silently doing no work', () => {
  const result = run('--stage', '99');
  assert.ifError(result.error);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /stage/);
});
