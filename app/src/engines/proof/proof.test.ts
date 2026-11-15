import assert from 'node:assert/strict';
import { test } from 'node:test';
import { answer, basisHash, guard, memoryProof, type BasisRow, type CitationInput } from './proof.ts';

const NOW = '2026-11-15T04:00:00.000Z';
const cite: CitationInput = {
  metric: 'sold_range', filters: { product_id: 'prd_1' }, table_versions: [{ table: 'observation', version: 37 }],
  definition_version: 'd1', code_version: 'c1', param_versions: { proof_min_n_eff: 0 }, model_version: null,
};
const rows = (n: number, at = '2026-11-10T00:00:00.000Z'): BasisRow[] =>
  Array.from({ length: n }, (_, i) => ({ id: `obs_${i}`, source: i % 2 ? 'ebay' : 'mercari', at, price_cents: 4000 + i * 100 }));
const RULES = { min_n_eff: 6, max_age_days: 14 };

test('refused: an answer with no basis is not an answer', () => {
  assert.deepEqual(answer(42, [], cite, NOW), { ok: false, refused: 'no_basis' });
  assert.deepEqual(answer(42, [{ id: 'obs_1', source: 'ebay', at: 'not a date' }], cite, NOW), { ok: false, refused: 'no_basis' });
});

test('an answer carries its sources, counts, dates, passed proof rows and a citation that names every basis id', () => {
  const a = answer({ lo: 40, hi: 50 }, rows(8), cite, NOW, ['claim_check']);
  assert.ok(a.ok);
  assert.deepEqual(a.basis.sources, ['ebay', 'mercari']);
  assert.equal(a.basis.count, 8);
  assert.equal(a.basis.n_eff, 8);
  assert.equal(a.basis.age_days, 5);
  assert.deepEqual(a.basis.passed, ['claim_check']);
  assert.deepEqual(a.citation.basis_ids, rows(8).map((r) => r.id));
  assert.equal(a.citation.computed_at, NOW);
});

test('the basis hash does not depend on row order and changes with a price', () => {
  const r = rows(4);
  assert.equal(basisHash(r), basisHash([...r].reverse()));
  assert.notEqual(basisHash(r), basisHash([{ ...r[0], price_cents: 1 }, ...r.slice(1)]));
});

test('age shown: a stale basis is hidden as stale with its age set', () => {
  const a = answer(45, rows(10, '2026-10-01T00:00:00.000Z'), cite, NOW);
  assert.ok(a.ok);
  assert.equal(a.basis.age_days, 45);
  const g = guard(a, RULES);
  assert.deepEqual([g.state, g.hide_reason], ['hidden', 'stale']);
});

test('a thin basis hides as too_few; a range wider than its middle hides as too_wide; a good one shows', () => {
  assert.equal(guard(answer(45, rows(3), cite, NOW), RULES).hide_reason, 'too_few');
  assert.equal(guard(answer({ lo: 10, hi: 90 }, rows(10), cite, NOW), RULES).hide_reason, 'too_wide');
  const g = guard(answer({ lo: 40, hi: 50 }, rows(10), cite, NOW), RULES);
  assert.equal(g.state, 'shown');
  assert.equal(g.basis_count, 10);
});

test('observations are append-only in the fake and filter by kind and site', () => {
  const p = memoryProof();
  const o = {
    id: 'obs_1', kind: 'listing' as const, site: 'ebay', subject_ref: 'lst_1', observed_at: NOW, payload: { price_cents: 4000 },
    evidence: { source_url: 'https://www.ebay.com/itm/1', read_at: NOW, snapshot_ref: 'v/1', fingerprint: 'f', extractor_version: 'e1',
      rights: { may_store: true, may_model: true, may_show: true, may_share: false, ttl: null } },
    source_route: 'harness', retention_class: 'source_ttl', rights_mode: 'public',
  };
  p.observe(o);
  assert.throws(() => p.observe(o), /append-only/);
  assert.equal(p.observations({ kind: 'listing', site: 'ebay' }).length, 1);
  assert.equal(p.observations({ site: 'mercari' }).length, 0);
});
