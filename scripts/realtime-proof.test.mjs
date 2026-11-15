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

test('1: the Check retains the thin-basis level and note', () => {
  assert.equal(row(1).state, 'works');
  assert.equal(row(1).reason, null);
  const { before, thin } = report.observed;
  assert.equal(thin.state, 'too_few');
  assert.equal(thin.level, 'product'); // the blended fallback names the level its one product comp supports (valuation.md §3)
  assert.equal(before.n_eff, 1);
  assert.equal(before.basis_level, 'product');
  assert.deepEqual(before.notes, ['too_few']);
  assert.deepEqual(before.range.notes, ['too_few']);
  assert.notEqual(before.range.state, 'hidden');
  assert.equal(before.range.hide_reason, undefined);
  assert.equal(before.range.q50, 1900);
  assert.ok(row(1).spec_quote && row(1).code_quote);
});

test('2: shown thin facts start gathering when called, but the route never starts gather', () => {
  gap(2, 'built, not called', 'check and runPlan never call gather; the proof invokes it separately on a guarded diagnostic.');
  assert.deepEqual(report.observed.importers.gather, []);
  assert.deepEqual(report.observed.gather_events_from_valuation, []);
  const g = report.observed.gather;
  assert.equal(g.answer.facts[0].guarded.state, 'shown');
  assert.deepEqual(g.answer.facts[0].guarded.notes, ['too_few']);
  assert.equal(g.stop, 'exhausted');
  assert.equal(g.request.product, 'pr_realtime');
  assert.equal(g.request.claim, 'sold_range');
  assert.equal(Date.parse(g.request.deadline) - Date.parse(report.as_of), 120000);
  const hidden = report.observed.no_basis_gather;
  assert.deepEqual(hidden.answer.facts[0].guarded, { state: 'hidden', hide_reason: 'source_gap', basis_count: 0 });
  assert.equal(hidden.request.product, 'pr_realtime');
  assert.equal(hidden.request.claim, 'sold_range');
  assert.equal(Date.parse(hidden.request.deadline) - Date.parse(report.as_of), 120000);
  assert.equal(hidden.stop, 'exhausted');
  assert.equal(report.observed.shown_thin_gather.stop, 'exhausted');
  assert.equal(report.observed.shown_thin_gather.request.claim, 'sold_range');
  assert.equal(Date.parse(report.observed.shown_thin_gather.request.deadline) - Date.parse(report.as_of), 120000);
});

test('3: the configured recorded source reaches the real reader only after a separate search request', () => {
  gap(3, 'built, not called', 'The proof starts POST /v1/search by hand; gather has no product-supplied widening steps.');
  const s = report.observed.search;
  assert.equal(s.found.sources_searched, 1);
  assert.equal(s.found.results_found, 12);
  assert.equal(s.found.results_used, 12);
  assert.deepEqual(s.searched.map(r => [r.site, r.outcome]), [['poshmark', 'hit']]);
  const config = report.observed.search_replay;
  assert.deepEqual(config.selected, ['poshmark']);
  assert.deepEqual(config.excluded.map(s => s.id), ['dupe', 'depop', 'mercari', 'facebook', 'ebay']);
  assert.ok(config.excluded.every(s => s.reason));
  assert.deepEqual(config.sources.map(s => [s.id, s.lane, s.on, s.needs_ask]), [
    ['dupe', 'mcp', true, false], ['depop', 'harness', true, false],
    ['poshmark', 'public_page', true, false], ['mercari', 'harness', true, true],
    ['facebook', 'apify', true, false], ['ebay', 'harness', true, false],
  ], 'source rows changed: review the replay coverage before updating this pin');
  assert.equal(config.sources.find(s => s.id === 'facebook').person_only, true);
  assert.deepEqual(config.reads.map(r => r.fixture), ['poshmark', 'poshmark-empty']);
  assert.deepEqual(config.unrecorded_requests, []);
  assert.deepEqual(report.observed.learning.empty_search.searched.map(r => [r.site, r.outcome]), [['poshmark', 'empty']]);
  assert.deepEqual(report.observed.gather.records, [{ n: 6, n_eff: 0, ms: 0, added: 0, outcome: 'skipped' }]);
  assert.deepEqual(report.observed.no_basis_gather.records, [{ n: 6, n_eff: 0, ms: 0, added: 0, outcome: 'skipped' }]);
  for (const fixture of report.fixtures) {
    assert.equal(readFileSync(new URL(`../${fixture.path}`, import.meta.url), 'utf8'),
      readFileSync(new URL(`../${fixture.source}`, import.meta.url), 'utf8'), 'recorded inputs must be unchanged copies');
  }
});

test('4: the real reconciler refuses to invent a product relation without identity evidence', () => {
  gap(4, 'built, not called', 'Search calls sameProduct, but gathering never reaches search; recorded pages lack identifiers, pair scores and recorded model judgements.');
  assert.ok(report.observed.judgement_requests.length > 0, 'search stopped calling the reconciler');
  assert.ok(report.observed.search.results.every(r => r.relation === 'unresolved'));
  assert.equal(report.observed.search.results.length, report.observed.search.found.results_found, 'unresolved rows must remain visible');
  assert.deepEqual(report.observed.search.identity, { by: 'default', model_ok: false });
  assert.equal(report.observed.search.product, null);
});

test('5: no gathered observation or evidence is persisted', () => {
  gap(5, 'built, not called', 'the Store has an observation table and writer (SV7, events/observations.ts); neither search nor valuate calls it yet.');
  assert.ok(report.observed.tables.includes('observation'));
  assert.deepEqual(report.observed.observations, []);
  assert.equal(report.observed.observation_writes, 0);
  assert.equal(report.observed.observation_import_in_search, false);
});

test('6: D1 arithmetic works on hand-fed sold comps, but no store read supplies gathered comps', () => {
  gap(6, 'built, not called', 'valuate reads ObservationPort and shares Kish with gather.measure; the route does not call valuate. The wider sold set is a separate direct diagnostic.');
  const d = report.observed.direct_basis;
  assert.ok(d.wider.n_eff > d.thin.n_eff);
  const w = d.wider.comps.map(c => c.w);
  const kish = w.reduce((a, b) => a + b, 0) ** 2 / w.reduce((a, b) => a + b * b, 0);
  assert.ok(Math.abs(d.wider.n_eff - kish) < 1e-12, 'D1 Kish effective sample size changed');
  assert.ok(d.match_weights.family < d.match_weights.product && d.match_weights.product < d.match_weights.variant);
  assert.equal(d.gather_measure.n_eff, d.wider.n_eff, 'gather.measure must use valuation Kish weights');
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
  assert.equal(p.observe_calls.length, 2);
  assert.equal(p.observe_calls[1].outcome.days_since_last, 30);
});

test('9: the route still ignores contribution learning but cites resolved valuation versions', async () => {
  gap(9, 'built, not called', 'contributionMean and cutOrder read learned weights only in the direct diagnostic; runPlan and valuation do not read them.');
  const p = report.observed.learning;
  assert.equal(p.mean_before, 0.5);
  assert.equal(p.mean_after, 0.4);
  assert.equal(p.second.version, 2);
  assert.deepEqual(report.observed.after_learning, report.observed.before);
  assert.equal(report.observed.after_learning.param_version, 1);
  assert.equal(report.observed.after_learning.citation.param_versions.valuation, undefined);
  const { DECLARED } = await import('../app/src/engines/valuation/params.ts');
  assert.deepEqual(report.observed.after_learning.citation.param_versions, Object.fromEntries(DECLARED.map(p => [p.name, 0])));
});

test('the overridden valuation input port must be reviewed when its real wiring changes', () => {
  assert.equal(report.observed.input_port.source_sha256,
    '41ff876f6c66aee5c2fd9f46490c884633fec01bf3de8d082512d9fa3a07c79d',
    'valuation.ports.read changed: inspect new store/param joins before updating links 1, 2, 6, 7 and 9');
  assert.match(report.observed.input_port.source, /warm_comps: \[\]/);
  assert.match(report.observed.input_port.source, /param_version: 1/);
  assert.match(report.observed.input_port.source, /soldSources\(soldSearch\(/);
  assert.match(report.observed.input_port.source, /example\('items.get'\)/);
  const offline = report.observed.input_port.offline;
  assert.equal(offline.product_id, 'pr_4hd1');
  assert.equal(offline.condition, 'good');
  assert.equal(offline.param_version, 1);
  assert.deepEqual(offline.warm_comps, []);
  assert.deepEqual(offline.sites, [{ site: 'mercari' }, { site: 'poshmark' }]);
  assert.deepEqual(offline.source_rows, [[], []]);
  assert.deepEqual(offline.sold_search, [
    { rows: [], outcome: 'blocked', reason: 'live reads are disabled' },
    { rows: [], outcome: 'blocked', reason: 'live reads are disabled' },
  ]);
});

test('10: two fresh stores produce byte-identical observed outputs', () => {
  assert.equal(row(10).state, 'works');
  assert.equal(report.determinism.identical, true);
  assert.equal(report.determinism.first_sha256, report.determinism.second_sha256);
  assert.equal(report.works, 2);
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
  assert.match(cli.stdout, /2\/10 works/);
});
