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
const gap = (n, state, reason) => {
  assert.equal(row(n).state, state, `link ${n} changed: rerun and update the record`);
  assert.equal(row(n).reason, reason, `link ${n} needs its reason reviewed`);
};

test('1: the Check loses the thin-basis level and note', () => {
  gap(1, 'wrong', 'check returns neither basis_level nor the too_few note computed by comparables.');
  const { before, thin } = report.observed;
  assert.equal(thin.state, 'too_few');
  assert.equal(before.n_eff, 1);
  assert.equal(before.basis_level, undefined);
  assert.equal(before.range.hide_reason, undefined);
  assert.equal(before.range.q50, 1900);
  assert.ok(row(1).spec_quote && row(1).code_quote);
});

test('2: valuation never starts the available gatherer; the direct probe has a deadline', () => {
  gap(2, 'built, not called', 'check and runPlan never call gather; the proof invokes it separately on a guarded diagnostic.');
  assert.deepEqual(report.observed.importers.gather, []);
  assert.deepEqual(report.observed.gather_events_from_valuation, []);
  assert.equal(report.observed.gather.request.product, 'pr_realtime');
  assert.equal(report.observed.gather.request.claim, 'sold_range');
  assert.equal(Date.parse(report.observed.gather.request.deadline) - Date.parse(report.as_of), 120000);
  assert.equal(report.observed.shown_thin_gather.stop, 'nothing_to_gather');
  assert.equal(report.observed.shown_thin_gather.request, null);
});

test('3: recorded pages reach two real readers only after a separate search request', () => {
  gap(3, 'built, not called', 'The proof starts POST /v1/search by hand; gather has no product-supplied widening steps.');
  const s = report.observed.search;
  assert.equal(s.found.results_found, 24);
  assert.equal(s.found.results_used, 24);
  assert.deepEqual(s.searched.filter(r => r.outcome === 'hit').map(r => r.site).sort(), ['depop', 'poshmark']);
  assert.deepEqual(report.observed.gather.records, [{ n: 6, n_eff: 0, ms: 0, added: 0, outcome: 'skipped' }]);
  for (const fixture of report.fixtures) {
    assert.equal(readFileSync(new URL(`../${fixture.path}`, import.meta.url), 'utf8'),
      readFileSync(new URL(`../${fixture.source}`, import.meta.url), 'utf8'), 'recorded inputs must be unchanged copies');
  }
});

test('4: the real reconciler refuses to invent a product relation without identity evidence', () => {
  gap(4, 'built, not called', 'Search calls sameProduct, but gathering never reaches search; recorded pages lack identifiers, pair scores and recorded model judgements.');
  assert.ok(report.observed.judgement_requests.length > 0, 'search stopped calling the reconciler');
  assert.ok(report.observed.search.results.every(r => r.relation === 'unresolved'));
  assert.deepEqual(report.observed.search.identity, { by: 'default', model_ok: false });
  assert.equal(report.observed.search.product, null);
});

test('5: no gathered observation or evidence is persisted', () => {
  gap(5, 'not built', 'No search-to-observation writer exists; the shared Store has no observation table. memoryProof is a separate in-memory store.');
  assert.ok(!report.observed.tables.includes('observation'));
  assert.deepEqual(report.observed.observations, []);
  assert.equal(report.observed.observation_writes, 0);
  assert.equal(report.observed.observation_import_in_search, false);
});

test('6: D1 arithmetic works on hand-fed sold comps, but no store read supplies gathered comps', () => {
  gap(6, 'built, not called', 'comparables accepts Comp arrays; no observation-store projection feeds the Check. The wider sold set is a separate direct diagnostic.');
  const d = report.observed.direct_basis;
  assert.ok(d.wider.n_eff > d.thin.n_eff);
  const w = d.wider.comps.map(c => c.w);
  const kish = w.reduce((a, b) => a + b, 0) ** 2 / w.reduce((a, b) => a + b * b, 0);
  assert.ok(Math.abs(d.wider.n_eff - kish) < 1e-12, 'D1 Kish effective sample size changed');
  assert.ok(d.match_weights.family < d.match_weights.product && d.match_weights.product < d.match_weights.variant);
  assert.notEqual(d.gather_measure.n_eff, d.wider.n_eff, 'gather.measure was fixed: update the discrepancy');
  assert.equal(report.observed.after.n_eff, report.observed.before.n_eff);
});

test('7: asking again is unchanged; a manually widened answer cites ids absent from observations', () => {
  gap(7, 'built, not called', 'The repeated valuation is unchanged; only hand-feeding sold comps changes it, and its citation ids resolve to no observation rows.');
  assert.deepEqual(report.observed.after, report.observed.before);
  assert.notDeepEqual(report.observed.direct_wider.range, report.observed.before.range);
  assert.ok(report.observed.direct_wider.citation.basis_ids.length > 1);
  assert.deepEqual(report.observed.citation_resolution.resolved, []);
  assert.deepEqual(report.observed.citation_resolution.missing, report.observed.direct_wider.citation.basis_ids);
});

test('8: only the explicit learning diagnostic moves a posterior; timestamps halve old counts', () => {
  gap(8, 'built, not called', 'No answer-settled caller invokes updateContribution; only the proof diagnostic calls it.');
  assert.deepEqual(report.observed.importers.learn, []);
  const p = report.observed.learning;
  assert.equal(p.product_observe_calls, null, 'a private diagnostic registry cannot count production calls');
  assert.match(p.product_observe_limitation, /diagnostic only/);
  assert.equal(p.prior.version, 0);
  assert.deepEqual(p.first.value, { alpha: 2, beta: 1 });
  assert.deepEqual(p.second.value, { alpha: 1, beta: 1.5 });
  assert.equal(p.second.version, 2);
  assert.equal(p.second.n_eff, 1.5);
  assert.equal(p.observe_calls.length, 4);
  assert.ok(p.observe_calls.slice(2).every(c => c.outcome.days_since_last === 30));
});

test('9: the next valuation ignores the moved contribution row and retains its supplied version', () => {
  gap(9, 'built, not called', 'contributionMean and cutOrder read learned weights only in the direct diagnostic; runPlan and valuation do not read them.');
  const p = report.observed.learning;
  assert.equal(p.mean_before, 0.5);
  assert.equal(p.mean_after, 0.4);
  assert.equal(p.second.version, 2);
  assert.deepEqual(report.observed.after_learning, report.observed.before);
  assert.equal(report.observed.after_learning.param_version, 1);
  assert.equal(report.observed.after_learning.citation.param_versions.valuation, 1);
});

test('the overridden valuation input port must be reviewed when its real wiring changes', () => {
  assert.equal(report.observed.input_port.source_sha256,
    'c53ce8e95aae3c9e4a30a6a0c9fac39326cd63b3f1d60e1e1605d6d6305552bb',
    'valuation.ports.read changed: inspect new store/param joins before updating links 1, 2, 6, 7 and 9');
  assert.match(report.observed.input_port.source, /warm_comps: \[\]/);
  assert.match(report.observed.input_port.source, /param_version: 1/);
});

test('10: two fresh stores produce byte-identical observed outputs', () => {
  assert.equal(row(10).state, 'works');
  assert.equal(report.determinism.identical, true);
  assert.equal(report.determinism.first_sha256, report.determinism.second_sha256);
  assert.equal(report.works, 1);
  assert.equal(report.total, 10);
  assert.deepEqual(report.links.map(r => r.link), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const r of report.links) {
    assert.ok(r.function && r.file && r.line > 0 && r.evidence);
    const source = readFileSync(new URL(`../${r.file}`, import.meta.url), 'utf8');
    assert.ok(source.split('\n')[r.line - 1].trim().length > 0, 'file:line must point to code');
    if (r.state !== 'works') assert.ok(r.reason);
  }
  const declaration = readFileSync(new URL('./realtime-proof.mjs', import.meta.url), 'utf8').split('\n')[row(10).line - 1];
  assert.match(declaration, /^export async function runProof/, 'link 10 must point to the declaration, not its anchor string');
  assert.ok(readFileSync(new URL('../spec/product.md', import.meta.url), 'utf8').includes(row(1).spec_quote));
  assert.ok(readFileSync(new URL(`../${row(1).file}`, import.meta.url), 'utf8').includes(row(1).code_quote));
});

test('network attempts are counted even when product code catches fetch failures; fetch is restored', async () => {
  assert.equal(report.network_attempts, 0);
  const original = globalThis.fetch;
  const planted = await withoutNetwork(async () => {
    await assert.rejects(async () => fetch('https://network-must-not-run.invalid'), /network forbidden/);
  });
  assert.equal(planted.attempts, 1, 'a swallowed network exception must still fail the proof');
  assert.equal(globalThis.fetch, original);
  await assert.rejects(withoutNetwork(async () => { throw new Error('planted failure'); }), /planted failure/);
  assert.equal(globalThis.fetch, original, 'fetch restoration must survive a failed proof');
});

test('CLI exits zero, prints all ten rows and writes the same evidence, count and date', () => {
  const script = fileURLToPath(new URL('./realtime-proof.mjs', import.meta.url));
  const cli = spawnSync(process.execPath, [script], { encoding: 'utf8', timeout: 10000 });
  assert.ifError(cli.error);
  assert.equal(cli.status, 0, cli.stderr);
  const written = JSON.parse(readFileSync(new URL('./out/realtime-proof.json', import.meta.url), 'utf8'));
  assert.deepEqual(written.observed, report.observed);
  assert.match(written.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(written.works, written.links.filter(r => r.state === 'works').length);
  for (const r of written.links) assert.ok(cli.stdout.includes(
    `${r.link} | ${r.state} | ${r.function} | ${r.file}:${r.line} | ${r.evidence}`), `missing printed link ${r.link}`);
  assert.match(cli.stdout, /1\/10 works/);
});
