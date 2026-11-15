// Check: node --test --test-concurrency=1 scripts/realtime-proof.test.mjs
import assert from 'node:assert/strict';
import { test, before } from 'node:test';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runProof, withoutNetwork } from './realtime-proof.mjs';

let report;
before(async () => { report = await runProof(); });
const row = n => report.links.find(r => r.link === n);

test('1: a stored item reaches valuate, check and the named thin product fallback', () => {
  const { before, thin } = report.observed;
  assert.equal(row(1).state, 'works');
  assert.equal(before.product_id, 'pr_realtime');
  assert.equal(before.as_of, report.as_of);
  assert.equal(before.n_eff, 1);
  assert.equal(before.basis_level, 'product');
  assert.deepEqual(before.notes, ['too_few']);
  assert.equal(thin.state, 'too_few');
  assert.equal(before.range.q50, 1900);
  assert.notEqual(before.range.state, 'hidden');
});

test('2: the valuation route gathers within its deadline and values again', () => {
  assert.equal(row(2).state, 'works');
  const o = report.observed;
  assert.ok(o.gather_events_from_valuation.length);
  assert.deepEqual(o.route_valuate_counts, [2, 2, 2, 2, 2], 'each thin valuation must value again after gather');
  assert.equal(Date.parse(o.before.gather.request.deadline) - Date.parse(report.as_of), 120000);
  assert.ok(o.before.gather.records.some(r => r.n === 1));
  assert.equal(o.before.basis_level, 'product');
});

test('3 and 4: gather reaches the real search reader and reconciler through person-owned jobs', () => {
  assert.equal(row(3).state, 'works'); assert.equal(row(4).state, 'works');
  const o = report.observed;
  assert.ok(o.route_search_jobs.length);
  assert.ok(o.route_search_jobs.every(j => j.user_id === 'usr_proof'));
  assert.equal(o.route_search.results.length, 12);
  assert.equal(o.route_search.found.results_used, 12);
  assert.deepEqual(o.route_search.identity, { by: 'default', model_ok: false });
  assert.ok(o.route_search.results.every(r => r.relation === 'unresolved'));
  assert.ok(o.judgement_requests.length);
  assert.deepEqual(o.search_replay.unrecorded_requests, []);
  assert.equal(o.network_attempts, undefined);
  for (const fixture of report.fixtures) assert.equal(
    readFileSync(new URL(`../${fixture.path}`, import.meta.url), 'utf8'),
    readFileSync(new URL(`../${fixture.source}`, import.meta.url), 'utf8'));
});

test('5: route writes retain SV7 evidence and shown-only rights', () => {
  assert.equal(row(5).state, 'works');
  const o = report.observed;
  assert.ok(o.observation_writes > 0);
  for (const observed of o.observations) {
    assert.equal(observed.use_scope, 'hackathon_demo');
    assert.equal(observed.may_model, false);
    assert.equal(observed.may_store, true);
    assert.equal(observed.evidence.rights.may_share, false);
    assert.ok(observed.evidence.source_url && observed.evidence.fingerprint && observed.evidence.read_at);
  }
});

test('6: the next route call grows its basis from stored sales; asking offers never enter it', () => {
  assert.equal(row(6).state, 'works');
  const o = report.observed;
  assert.ok(o.after.n_eff > o.before.n_eff);
  assert.ok(o.after.comps.some(c => o.before.comps.some(b => c.comp_id === b.comp_id)));
  assert.ok(o.after.comps.every(c => c.kind === 'sold'));
  assert.equal(o.person_b.n_eff, 0, 'B must not read A observations');
  const weights = o.after.comps.map(c => c.w);
  const kish = weights.reduce((a, b) => a + b, 0) ** 2 / weights.reduce((a, b) => a + b * b, 0);
  assert.ok(Math.abs(o.after.n_eff - kish) < 1e-12);
});

test('7: route answer and per-site citations resolve to stored observation ids', () => {
  assert.equal(row(7).state, 'works');
  const o = report.observed;
  assert.ok(o.citation_resolution.resolved.length > 1);
  assert.deepEqual(o.citation_resolution.missing, []);
  // A listing-dated comp is never a last sale (sold.ts dated_by), so last_sale is null when every comp is dated by its listing.
  if (o.after.comps?.every(c => c.dated_by === 'listed')) assert.equal(o.after.last_sale, null);
  for (const citation of [o.after.citation, ...(o.after.last_sale ? [o.after.last_sale.citation] : []), ...o.after.per_site.map(s => s.citation)])
    assert.ok(citation.basis_ids.every(id => o.observations.some(obs => obs.id === id)));
});

test('8: the route learns agreement only from model-permitted synthetic control observations', () => {
  assert.equal(row(8).state, 'works');
  const c = report.observed.learning_control;
  assert.equal(c.data, 'synthetic');
  assert.equal(c.signal, 'agent proposal: observed comp agreement, not a sale outcome');
  assert.equal(c.mean_before, .5);
  assert.ok(c.mean_after > c.mean_before);
  assert.ok(c.observe_calls.some(call => call.scope.segment === 'public.depop'));
  assert.ok(c.observe_calls.every(call => call.scope.person === 'usr_learning'));
  assert.equal(c.repeat_version, c.first_version, 'identical evidence must not learn twice');
  assert.equal(c.dataset_observe_calls, 0, 'shown-only dataset rows cannot fit a weight');
});

test('9: a weight moved by the route changes the next route gather source order', () => {
  assert.equal(row(9).state, 'works');
  const c = report.observed.learning_control;
  assert.equal(c.order_before[0], 'public.poshmark');
  assert.equal(c.order_after[0], 'public.depop');
  assert.ok(c.reads.some(read => read.name === 'intel_contribution' && read.version > 0));
});

test('10: every state is earned from two deterministic offline route replays', () => {
  assert.equal(row(10).state, 'works');
  assert.equal(report.determinism.identical, true);
  assert.equal(report.determinism.first_sha256, report.determinism.second_sha256);
  assert.equal(report.works, 10);
  assert.equal(report.works, report.links.filter(r => r.state === 'works').length);
  for (const link of report.links) {
    assert.ok(link.function && link.evidence && link.line > 0);
    assert.ok(readFileSync(new URL(`../${link.file}`, import.meta.url), 'utf8').split('\n')[link.line - 1].trim());
    if (link.state !== 'works') assert.ok(link.reason);
  }
  assert.deepEqual(report.observed.log.problems, []);
});

test('network attempts remain counted when product code catches them, and fetch is restored', async () => {
  assert.equal(report.network_attempts, 0);
  const original = globalThis.fetch;
  const planted = await withoutNetwork(async () => {
    await assert.rejects(async () => fetch('https://network-must-not-run.invalid'), /network forbidden/);
  });
  assert.equal(planted.attempts, 1);
  assert.equal(globalThis.fetch, original);
  await assert.rejects(withoutNetwork(async () => { throw new Error('planted failure'); }), /planted failure/);
  assert.equal(globalThis.fetch, original);
});

test('CLI prints the observed link count and writes the same evidence', () => {
  const script = fileURLToPath(new URL('./realtime-proof.mjs', import.meta.url));
  const cli = spawnSync(process.execPath, [script], { encoding: 'utf8', timeout: 15000 });
  assert.ifError(cli.error); assert.equal(cli.status, 0, cli.stderr);
  const written = JSON.parse(readFileSync(new URL('./out/realtime-proof.json', import.meta.url), 'utf8'));
  assert.deepEqual(written.observed, report.observed);
  assert.match(cli.stdout, new RegExp(`${report.works}/10 works`));
  for (const link of written.links) assert.ok(cli.stdout.includes(`${link.link} | ${link.state} | ${link.function} | ${link.file}:${link.line} | ${link.evidence}`));
});
