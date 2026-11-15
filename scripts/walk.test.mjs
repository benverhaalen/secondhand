import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const stages = ['capture', 'type', 'process', 'identify', 'valuate', 'draft', 'post',
  'watch', 'relink', 'accept_offer', 'answer_offer', 'listing.sold', 'poll_orders', 'delist', 'restart'];
const run = (...args) => spawnSync(process.execPath, ['scripts/walk.mjs', ...args], {
  cwd: root, encoding: 'utf8', timeout: 60000,
});
const lines = result => result.stdout.trim().split('\n').map(line => JSON.parse(line));

test('one fixture item runs all fifteen stages and finishes sold once with delists planned elsewhere', async t => {
  const result = run();
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  t.diagnostic(result.stdout.trim());
  const output = lines(result);
  assert.deepEqual(output.slice(0, -1).map(row => row.stage), stages);
  await t.test('stage modes agree with route and engine provenance and every gap has an owner', () => {
    for (const row of output.slice(0, -1)) {
      assert.ok(['real', 'fake'].includes(row.mode), row.stage);
      assert.ok(row.counts.in > 0 && row.counts.out > 0, `${row.stage}: zero rows`);
      assert.ok(Number.isFinite(row.ms) && row.ms >= 0, row.stage);
    }
    for (const row of output.slice(0, -1)) {
      assert.ok(Array.isArray(row.routes), `${row.stage}: missing measured routes`);
      assert.ok(row.engines.length > 0, `${row.stage}: missing engine provenance`);
      const measured = row.routes.every(route => route.real) && row.engines.every(engine => engine.real);
      assert.equal(row.mode, measured ? 'real' : 'fake', `${row.stage}: mode disagrees with execution`);
      if (row.mode === 'fake') assert.ok(row.missing.every(m => m.owner && m.reason) && row.missing.length,
        `${row.stage}: fake work has no missing owner`);
      for (const route of row.routes) {
        if (route.route_id.startsWith('fake.')) assert.equal(route.real, false);
        if (route.site === 'depop') assert.equal(route.real, true, `${row.stage}: Depop must use its adapter`);
      }
    }
  });
  const stage = name => output.find(row => row.stage === name);
  await t.test('post preserves approval, drafted price and photos in the Depop dry plan', () => {
    assert.equal(stage('post').mode, 'real');
    assert.equal(stage('post').state, 'planned');
    assert.equal(stage('post').plan.dry, true);
    assert.equal(stage('post').plan.request.price_amount * 100, stage('draft').price_cents);
    assert.deepEqual(stage('post').plan.request.pictures, stage('draft').photo_ids);
    assert.equal(stage('post').approval.actor, 'user');
    assert.equal(stage('post').approval.action, 'app.list');
    assert.ok(!stage('watch').routes.some(r => r.route_id.includes('.post.')), 'post call leaked into watch');
  });
  await t.test('watcher offer above always_accept receives a Depop dry accept plan', () => {
    assert.equal(stage('answer_offer').mode, 'real');
    assert.equal(stage('answer_offer').state, 'planned');
    assert.equal(stage('delist').state, 'planned');
    assert.equal(stage('answer_offer').plan.dry, true);
    assert.equal(stage('answer_offer').plan.request.action, 'accept');
    assert.equal(stage('answer_offer').event.action, 'offer.received');
    assert.equal(stage('answer_offer').event.source, 'watcher_signed_in');
    assert.ok(stage('answer_offer').event.payload.price_cents >= stage('answer_offer').event.payload.always_accept_cents);
  });
  await t.test('one-item week preserves all three sweep counts', () => {
    assert.deepEqual(stage('watch').sweeps, { depop: 3124, poshmark: 2648, ebay: 576 });
    assert.equal(stage('watch').item_count, 1);
    assert.ok(stage('watch').engines.some(e => e.name === 'pAccept' && !e.real), 'fixture acceptance model was hidden');
  });
  await t.test('expiry pauses one account, raises one decision and relink resumes without stale calls', () => {
    assert.equal(stage('relink').paused, 'account_stale');
    assert.equal(stage('relink').open_decisions, 1);
    assert.equal(stage('relink').resumed, true);
    assert.equal(stage('relink').calls_while_stale, 0);
  });
  await t.test('restart retains events, jobs, decisions and the confirmed order from the original fileStore', () => {
    assert.equal(stage('restart').from_start, true);
    assert.ok(stage('restart').events > 0 && stage('restart').jobs > 0 && stage('restart').decisions > 0);
    assert.equal(stage('restart').orders, 1);
  });
  await t.test('capture reads frames and runs the production type judge with an explicit quality gap', () => {
    assert.equal(stage('capture').frames_read, 3);
    assert.ok(stage('capture').engines.some(e => e.name === 'jobs.capture.judge_type.judge'));
    assert.equal(stage('capture').mode, 'fake');
    assert.equal(stage('capture').pixel_scored, false);
    assert.ok(stage('capture').missing.some(m => m.owner === 'capture lead'));
  });
  const total = output.at(-1);
  assert.equal(total.stage, 'total');
  assert.equal(total.ok, true);
  assert.equal(total.counts.stages, 15);
  assert.equal(total.item.state, 'sold');
  assert.deepEqual(total.sites, { poshmark: 'scripted_live', ebay: 'scripted_live', depop: 'observed_sold' });
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

test('route and engine provenance cannot turn scripted work into real work', async () => {
  const { executionReport } = await import('./walk-fixtures/report.mjs');
  const production = value => value;
  const fixtureOnly = value => value;
  const report = executionReport(new Map([[production, 'production.engine']]), new Map([
    ['poshmark.read_listings.script', { owner: 'Poshmark adapter lead', reason: 'No adapter' }],
  ]));
  const harness = report.harness({ async call(site) {
    return { ok: true, data: {}, meta: { route_id: site === 'depop' ? 'depop.read_listings' : 'poshmark.read_listings.script' } };
  } }, () => 'probe');
  await report.engine('probe', production, 1);
  await harness.call('depop', 'read_listings');
  assert.equal(report.stage('probe').mode, 'real');
  await harness.call('poshmark', 'read_listings');
  assert.equal(report.stage('probe').mode, 'fake', 'scripted routes without fake prefix still count');
  await report.engine('fixture', fixtureOnly, 1);
  assert.equal(report.stage('fixture').mode, 'fake', 'unregistered fixture engine cannot claim production provenance');
  assert.equal(report.stage('empty').mode, 'fake', 'an assertion alone is not a production engine');
  report.observed('prefix', production);
  report.call('prefix', 'ebay', 'end', { meta: { route_id: 'fake.ebay.end' } });
  assert.equal(report.stage('prefix').mode, 'fake', 'fake prefix was ignored');
});

test('a watch prefix reports its completed nested sale without claiming the whole walk finished', () => {
  const result = run('--stage', '8');
  assert.ifError(result.error);
  assert.notEqual(result.status, 0);
  const output = lines(result);
  assert.deepEqual(output.map(row => row.stage), ['watch', 'total']);
  assert.equal(output.at(-1).ok, false);
  assert.equal(output.at(-1).counts.sold, 1);
  assert.equal(output.at(-1).counts.ended, 0);
  assert.equal(output.at(-1).counts.planned, 2);
  assert.equal(output.at(-1).item.state, 'sold');
});
