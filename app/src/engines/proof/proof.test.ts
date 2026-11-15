import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as proof from './proof.ts';
import { resolve } from './params.ts';
import { memoryStore } from '../param/param.ts';
import { createHash } from 'node:crypto';
import { answer, basisHash, basisOf, guard, memoryProof, type BasisRow, type CitationInput } from './proof.ts';

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

test('age shown: a stale basis stays shown with a stale note and its age set', () => {
  const a = answer(45, rows(10, '2026-10-01T00:00:00.000Z'), cite, NOW);
  assert.ok(a.ok);
  assert.equal(a.basis.age_days, 45);
  const g = guard(a, RULES);
  assert.equal(g.state, 'shown');
  assert.deepEqual('notes' in g && g.notes, ['stale']);
  assert.equal(g.hide_reason, undefined);
});

test('thin and wide numbers stay shown with notes; a good one has no notes', () => {
  const thin = guard(answer(45, rows(3), cite, NOW), RULES);
  assert.equal(thin.state, 'shown');
  assert.deepEqual('notes' in thin && thin.notes, ['too_few']);
  const wide = guard(answer({ lo: 10, hi: 90 }, rows(10), cite, NOW), RULES);
  assert.equal(wide.state, 'shown');
  assert.deepEqual('notes' in wide && wide.notes, ['too_wide']);
  const g = guard(answer({ lo: 40, hi: 50 }, rows(10), cite, NOW), RULES);
  assert.equal(g.state, 'shown');
  assert.equal(g.basis_count, 10);
  assert.deepEqual('notes' in g && g.notes, []);
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


test('citation identity distinguishes every frozen calculation input and canonicalizes nested keys', () => {
  const a = answer(45, rows(8), cite, NOW);
  assert.ok(a.ok);
  const variants: CitationInput[] = [
    { ...cite, metric: 'another_metric' }, { ...cite, filters: { product_id: 'prd_2' } },
    { ...cite, table_versions: [{ table: 'observation', version: 38 }] },
    { ...cite, definition_version: 'd2' }, { ...cite, code_version: 'c2' },
    { ...cite, param_versions: { proof_min_n_eff: 1 } }, { ...cite, model_version: 'm1' },
  ];
  for (const changed of variants) {
    const b = answer(46, rows(8), changed, NOW);
    assert.ok(b.ok);
    assert.notEqual(b.citation.id, a.citation.id, JSON.stringify(changed));
  }
  const left = answer(45, rows(8), { ...cite, filters: { z: 1, nested: { b: 2, a: 1 } }, param_versions: { z: 2, a: 1 } }, NOW);
  const right = answer(45, rows(8), { ...cite, filters: { nested: { a: 1, b: 2 }, z: 1 }, param_versions: { a: 1, z: 2 } }, NOW);
  assert.ok(left.ok && right.ok);
  assert.equal(left.citation.id, right.citation.id);
});

test('basis hash freezes id, source, date, weight and cents in canonical sorted rows', () => {
  const row: BasisRow = { id: 'obs_1', source: 'ebay', at: NOW, weight: 1, price_cents: 4000 };
  const expected = createHash('sha256').update(JSON.stringify([{ at: NOW, id: 'obs_1', price_cents: 4000, source: 'ebay', weight: 1 }])).digest('hex');
  assert.equal(basisHash([row]), expected);
  for (const change of [{ id: 'obs_2' }, { source: 'mercari' }, { at: '2026-11-14T00:00:00Z' }, { weight: 2 }, { price_cents: 4001 }]) {
    assert.notEqual(basisHash([row]), basisHash([{ ...row, ...change }]), JSON.stringify(change));
  }
  assert.equal(basisHash([{ ...row, weight: undefined }]), basisHash([row]));
  const ambiguous = [{ id: 'a:b', source: 'x', at: NOW }, { id: 'a', source: 'x', at: NOW }];
  assert.equal(basisHash(ambiguous), basisHash([...ambiguous].reverse()));
});

test('basis refuses invalid weights and duplicate ids; zero contributes no effective evidence', () => {
  for (const weight of [-1, NaN, Infinity, -Infinity]) {
    assert.throws(() => basisOf([{ ...rows(1)[0], weight }], NOW, []), /weight/);
  }
  assert.throws(() => basisOf([rows(1)[0], rows(1)[0]], NOW, []), /duplicate.*id/);
  assert.equal(basisOf(rows(8).map(r => ({ ...r, weight: 0 })), NOW, []).n_eff, 0);
  for (const weight of [Number.MAX_VALUE, Number.MIN_VALUE]) {
    assert.equal(basisOf(rows(8).map(r => ({ ...r, weight })), NOW, []).n_eff, 8);
  }
});

test('answer refuses invalid now and future evidence before computing age', () => {
  assert.deepEqual(answer(45, rows(8), cite, 'invalid'), { ok: false, refused: 'no_basis' });
  assert.deepEqual(answer(45, rows(8, '2026-11-16T00:00:00Z'), cite, NOW), { ok: false, refused: 'no_basis' });
  assert.ok(answer(45, rows(8, NOW), cite, NOW).ok);
});

test('basis cents are validated at both public boundaries', () => {
  for (const price_cents of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const invalid = [{ ...rows(1)[0], price_cents }];
    assert.throws(() => basisHash(invalid), { name: 'RangeError', message: /price_cents/ });
    assert.throws(() => basisOf(invalid, NOW, []), { name: 'RangeError', message: /price_cents/ });
    assert.throws(() => answer(45, invalid, cite, NOW), { name: 'RangeError', message: /price_cents/ });
  }
});

test('guard refuses nonfinite numbers, reversed ranges and invalid rules', () => {
  for (const value of [NaN, Infinity, -Infinity, { lo: 5, hi: 4 }, { lo: NaN, hi: 5 }, { lo: 1, hi: Infinity }]) {
    assert.throws(() => guard(answer(value, rows(8), cite, NOW), RULES), /value|range/);
  }
  for (const value of [NaN, Infinity, -Infinity, 0, -1]) {
    assert.throws(() => guard(answer(45, rows(8), cite, NOW), { ...RULES, min_n_eff: value }), /min_n_eff/);
    assert.throws(() => guard(answer(45, rows(8), cite, NOW), { ...RULES, max_age_days: value }), /max_age_days/);
  }
});

test('citation snapshots cannot mutate and memoryProof refuses conflicting writes', () => {
  const input = structuredClone(cite);
  const a = answer(45, rows(8), input, NOW);
  assert.ok(a.ok);
  input.param_versions.proof_min_n_eff = 99;
  assert.equal(a.citation.param_versions.proof_min_n_eff, 0);
  const p = memoryProof();
  p.cite(a.citation);
  p.cite(structuredClone(a.citation));
  assert.throws(() => p.cite({ ...a.citation, metric: 'different' }), /citation.*already|citation.*conflict/);
  assert.deepEqual(p.citation(a.citation.id), a.citation);
  const copy = p.citation(a.citation.id)!;
  copy.param_versions.proof_min_n_eff = 5;
  assert.equal(p.citation(a.citation.id)!.param_versions.proof_min_n_eff, 0);
});

test('guardWith reads scoped proof params and cites both versions without mutating its answer', () => {
  const store = memoryStore();
  const scope = { kind: 'clothing', site: 'ebay' };
  const a = answer(45, rows(8), cite, NOW);
  assert.ok(a.ok);
  const first = proof.guardWith(store, scope, a);
  assert.equal(first.guarded.state, 'shown');
  assert.deepEqual(first.param_versions, { proof_min_n_eff: 0, proof_max_age_days: 0 });
  for (const [name, value] of [['proof_min_n_eff', 9], ['proof_max_age_days', 2]] as const) {
    const p = store.propose({ name, scope, family: 'scalar', value_or_hyperparams: value, prior: value, fitted_on_ids_hash: null,
      n_eff: 10, metric: null, held_out_score: 1, guard_lo: null, guard_hi: null }, 0);
    store.promote(name, scope, p.version, 0, NOW);
  }
  const second = proof.guardWith(store, scope, a);
  assert.equal(second.guarded.state, 'shown');
  assert.deepEqual('notes' in second.guarded && second.guarded.notes, ['too_few', 'stale']);
  assert.deepEqual(second.param_versions, { proof_min_n_eff: 1, proof_max_age_days: 1 });
  assert.ok(second.citation);
  assert.deepEqual(second.citation.param_versions, second.param_versions);
  assert.equal('citation_id' in second.guarded && second.guarded.citation_id, second.citation.id);
  assert.notEqual(second.citation.id, first.citation?.id);
  assert.equal(a.citation.param_versions.proof_min_n_eff, 0);
  assert.equal(proof.guardWith(store, { site: 'mercari' }, a).guarded.state, 'shown');
  const stale = answer(45, rows(10), cite, NOW);
  const g = proof.guardWith(store, scope, stale).guarded;
  assert.equal(g.state, 'shown');
  assert.deepEqual('notes' in g && g.notes, ['stale']);
});


test('citation id is the full SHA-256 of precisely the canonical frozen identity', () => {
  const a = answer(45, rows(8), cite, NOW);
  assert.ok(a.ok);
  const expected = createHash('sha256').update(JSON.stringify({
    basis_hash: a.citation.basis_hash, code_version: 'c1', definition_version: 'd1',
    filters: { product_id: 'prd_1' }, metric: 'sold_range', model_version: null,
    param_versions: { proof_min_n_eff: 0 }, table_versions: [{ table: 'observation', version: 37 }],
  })).digest('hex');
  assert.equal(a.citation.id, `cit_${expected}`);
});

test('memoryProof refuses a conflicting citation even if its id is supplied by a caller', () => {
  const a = answer(45, rows(8), cite, NOW);
  assert.ok(a.ok);
  const p = memoryProof();
  p.cite(a.citation);
  assert.throws(() => p.cite({ ...a.citation, computed_at: '2026-11-15T05:00:00.000Z' }), /citation.*already/);
  assert.deepEqual(p.citation(a.citation.id), a.citation);
});

test('registry resolution refuses missing or invalid proof values instead of substituting a prior', () => {
  for (const value of [undefined, '6', NaN, Infinity, 0, -1]) {
    const store = memoryStore();
    const invalid = { ...store, read: (name: string, scope: Parameters<typeof store.read>[1]) => ({ ...store.read(name, scope), value }) };
    assert.throws(() => resolve(invalid, {}), /proof_min_n_eff/);
  }
});

test('guardWith supports priors and refused answers, and keeps other calculation param versions', () => {
  const a = answer(45, rows(8), { ...cite, param_versions: { ...cite.param_versions, valuation_weight: 7 } }, NOW);
  const result = proof.guardWith(undefined, {}, a);
  assert.equal(result.guarded.state, 'shown');
  assert.equal(result.citation?.param_versions.valuation_weight, 7);
  assert.deepEqual(result.param_versions, { proof_min_n_eff: 0, proof_max_age_days: 0 });
  const refused = proof.guardWith(memoryStore(), {}, answer(45, [], cite, NOW));
  assert.deepEqual(refused.guarded, { state: 'hidden', hide_reason: 'source_gap', basis_count: 0 });
  assert.equal(refused.citation, null);
});

test('a basis older than the age limit by one millisecond is stale', () => {
  const at = new Date(Date.parse(NOW) - 14 * 86_400_000 - 1).toISOString();
  const g = guard(answer(45, rows(8, at), cite, NOW), RULES);
  assert.equal(g.state, 'shown');
  assert.deepEqual('notes' in g && g.notes, ['stale']);
});

test('range width is checked without overflow or underflow for finite bounds', () => {
  const wide = guard(answer({ lo: 1e307, hi: 1.7e308 }, rows(8), cite, NOW), RULES);
  assert.deepEqual('notes' in wide && wide.notes, ['too_wide']);
  const tiny = guard(answer({ lo: 0, hi: Number.MIN_VALUE }, rows(8), cite, NOW), RULES);
  assert.deepEqual('notes' in tiny && tiny.notes, ['too_wide']);
});


test('equivalent basis row permutations can be cited idempotently', () => {
  const a = answer(45, rows(8), cite, NOW);
  const b = answer(45, rows(8).reverse(), cite, NOW);
  assert.ok(a.ok && b.ok);
  assert.deepEqual(a.citation, b.citation);
  const p = memoryProof();
  p.cite(a.citation);
  p.cite(b.citation);
});


test('guardWith distinguishes scoped champions that share local version numbers', () => {
  const store = memoryStore();
  const a = answer(45, rows(8), cite, NOW);
  proof.guardWith(store, {}, a);
  for (const [site, value] of [['ebay', 9], ['mercari', 7]] as const) {
    const scope = { site };
    const p = store.propose({ name: 'proof_min_n_eff', scope, family: 'scalar', value_or_hyperparams: value, prior: 6,
      fitted_on_ids_hash: null, n_eff: 10, metric: null, held_out_score: 1, guard_lo: null, guard_hi: null }, 0);
    store.promote(p.name, scope, p.version, 0, NOW);
  }
  const ebay = proof.guardWith(store, { site: 'ebay' }, a);
  const mercari = proof.guardWith(store, { site: 'mercari' }, a);
  assert.deepEqual(ebay.param_versions, mercari.param_versions);
  assert.equal(ebay.guarded.state, 'shown');
  assert.deepEqual('notes' in ebay.guarded && ebay.guarded.notes, ['too_few']);
  assert.deepEqual('notes' in mercari.guarded && mercari.guarded.notes, []);
  assert.equal(mercari.guarded.state, 'shown');
  assert.notEqual(ebay.citation?.id, mercari.citation?.id);
});

test('guardWith records which fallback row supplied a local param version', () => {
  const store = memoryStore();
  const a = answer(45, rows(8), cite, NOW);
  proof.guardWith(store, {}, a);
  const add = (scope: { site?: string }, value: number) => {
    const p = store.propose({ name: 'proof_min_n_eff', scope, family: 'scalar', value_or_hyperparams: value, prior: 6,
      fitted_on_ids_hash: null, n_eff: 10, metric: null, held_out_score: 1, guard_lo: null, guard_hi: null }, 0);
    store.promote(p.name, scope, p.version, 0, NOW);
  };
  add({}, 9);
  const before = proof.guardWith(store, { site: 'ebay' }, a);
  add({ site: 'ebay' }, 7);
  const after = proof.guardWith(store, { site: 'ebay' }, a);
  assert.deepEqual(before.param_versions, after.param_versions);
  assert.equal(before.guarded.state, 'shown');
  assert.deepEqual('notes' in before.guarded && before.guarded.notes, ['too_few']);
  assert.deepEqual('notes' in after.guarded && after.guarded.notes, []);
  assert.equal(after.guarded.state, 'shown');
  assert.notEqual(before.citation?.id, after.citation?.id);
});


test('a range exactly as wide as its middle is shown', () => {
  for (const value of [{ lo: 1, hi: 3 }, { lo: 40, hi: 120 }]) {
    assert.equal(guard(answer(value, rows(8), cite, NOW), RULES).state, 'shown');
  }
});

test('answer defaults to variant and carries each caller-named fallback level through guardWith', () => {
  const a = answer(45, rows(1), cite, NOW);
  assert.ok(a.ok);
  assert.equal(a.basis_level, 'variant');
  for (const basis_level of ['variant', 'product', 'family', 'kind', 'prior', 'site_curve']) {
    const a = answer(45, rows(1), cite, NOW, [], { basis_level });
    assert.ok(a.ok);
    assert.equal(a.basis_level, basis_level);
    const { guarded } = proof.guardWith(undefined, {}, a);
    assert.equal(guarded.state, 'shown');
    assert.equal('basis_level' in guarded && guarded.basis_level, basis_level);
  }
});

test('guard retains every thin, stale and wide note together without a hide reason', () => {
  const g = guard(answer({ lo: 10, hi: 90 }, rows(1, '2026-10-01T00:00:00Z'), cite, NOW), RULES);
  assert.equal(g.state, 'shown');
  assert.equal(g.hide_reason, undefined);
  assert.deepEqual('notes' in g && g.notes, ['too_few', 'stale', 'too_wide']);
});

test('only missing basis or an explicit conflict hides a number', () => {
  assert.deepEqual(guard(answer(45, [], cite, NOW), RULES), { state: 'hidden', hide_reason: 'source_gap', basis_count: 0 });
  for (const basis of [[], rows(8)]) {
    const a = answer(45, basis, cite, NOW, [], { conflict: true });
    assert.deepEqual(proof.guardWith(undefined, {}, a).guarded, { state: 'hidden', hide_reason: 'conflict', basis_count: 0 });
  }
});

const levels = (): proof.LadderLevel<number>[] => ['variant', 'product', 'family', 'kind', 'prior'].map((basis_level, i) => ({
  basis_level, value: 100 - i * 10, rows: rows(1).map(r => ({ ...r, id: `${basis_level}_${r.id}` })),
}));

test('removing rows walks five fallback levels, staying shown with each level named and its notes', () => {
  const input = levels();
  for (let i = 0; i < input.length; i++) {
    const a = proof.ladder(input, cite, NOW);
    assert.ok(a.ok, `no answer at ${input[i].basis_level}`);
    const g = guard(a, RULES);
    assert.equal(g.state, 'shown', `hidden at ${input[i].basis_level}`);
    assert.equal('basis_level' in g && g.basis_level, input[i].basis_level);
    assert.deepEqual('notes' in g && g.notes, ['too_few']);
    input[i].rows = [];
  }
  assert.deepEqual(guard(proof.ladder(input, cite, NOW), RULES), { state: 'hidden', hide_reason: 'source_gap', basis_count: 0 });
});

test('ladder blends numeric values recursively by each level\'s effective evidence, not raw row count', () => {
  const input = levels().slice(0, 3);
  input[0].rows = rows(2).map((r, i) => ({ ...r, weight: i ? 0 : 1 }));
  const a = proof.ladder(input, cite, NOW);
  assert.ok(a.ok);
  const parent = 90 / 7 + 80 * (6 / 7);
  assert.ok(Math.abs(a.value - (100 / 7 + parent * (6 / 7))) < 1e-12);
  assert.equal(a.basis.n_eff, 1);
  assert.equal(a.basis.count, 2);
  assert.equal(a.basis_level, 'variant');
});

test('ladder skips unstated or empty levels, preserves zero, and does not blend ranges', () => {
  const input = levels();
  input[0].value = null;
  input[1].value = undefined;
  input[2].rows = [];
  input[3].value = 0;
  input[4].value = 0;
  const a = proof.ladder(input, cite, NOW);
  assert.ok(a.ok);
  assert.equal(a.value, 0);
  assert.equal(a.basis_level, 'kind');
  const range = { lo: 10, hi: 90 };
  const b = proof.ladder([{ basis_level: 'family', rows: rows(1), value: range }], cite, NOW);
  assert.ok(b.ok);
  assert.deepEqual(b.value, range);
  const g = guard(b, RULES);
  assert.equal(g.state, 'shown');
  assert.deepEqual('notes' in g && g.notes, ['too_few', 'too_wide']);
  assert.deepEqual(proof.ladder([], cite, NOW), { ok: false, refused: 'no_basis' });
});

test('ladder reads scoped proof_blend_k and freezes the parent evidence, values and param version in its citation', () => {
  const store = memoryStore();
  const scope = { kind: 'shoes' };
  const input = levels().slice(0, 2);
  const snapshot = structuredClone(input);
  const a = proof.ladder(input, cite, NOW, [], { store, scope });
  assert.ok(a.ok);
  assert.ok(Math.abs(a.value - (100 / 7 + 90 * (6 / 7))) < 1e-12);
  assert.equal(a.citation.param_versions.proof_blend_k, 0);
  assert.deepEqual(a.citation.basis_ids, input.flatMap(l => l.rows.map(r => r.id)).sort());
  assert.deepEqual(input, snapshot);
  const p = store.propose({ name: 'proof_blend_k', scope, family: 'scalar', value_or_hyperparams: 3, prior: 6,
    fitted_on_ids_hash: null, n_eff: 10, metric: null, held_out_score: 1, guard_lo: null, guard_hi: null }, 0);
  store.promote(p.name, scope, p.version, 0, NOW);
  const b = proof.ladder(input, cite, NOW, [], { store, scope });
  assert.ok(b.ok);
  assert.equal(b.value, 92.5);
  assert.equal(b.citation.param_versions.proof_blend_k, 1);
  assert.notEqual(b.citation.id, a.citation.id);
  input[1].rows[0].price_cents! += 1;
  const c = proof.ladder(input, cite, NOW, [], { store, scope });
  assert.ok(c.ok);
  assert.notEqual(c.citation.id, b.citation.id);
  input[1].value = 70;
  const d = proof.ladder(input, cite, NOW, [], { store, scope });
  assert.ok(d.ok);
  assert.notEqual(d.citation.id, c.citation.id);
  assert.equal(b.citation.param_versions.proof_blend_k, 1);
});

test('ladder rejects invalid numeric values and weights at the boundary', () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    const input = levels(); input[0].value = value;
    assert.throws(() => proof.ladder(input, cite, NOW), /value.*finite/);
  }
  const invalid = levels(); invalid[0].rows[0].weight = -1;
  assert.throws(() => proof.ladder(invalid, cite, NOW), /weight/);
});

test('a level with refused evidence cannot hide another stated level', () => {
  for (const index of [0, 1, 4]) {
    const input = levels(); input[index].rows[0].at = 'invalid';
    const a = proof.ladder(input, cite, NOW);
    assert.ok(a.ok, `invalid date at level ${index} discarded valid evidence`);
    assert.equal(a.basis_level, index === 0 ? 'product' : 'variant');
    assert.equal(guard(a, RULES).state, 'shown');
  }
  const input = levels(); input.forEach(l => { l.rows[0].at = 'invalid'; });
  assert.deepEqual(proof.ladder(input, cite, NOW), { ok: false, refused: 'no_basis' });
});

test('guardWith preserves the blend version and reads only the note thresholds', () => {
  const store = memoryStore();
  const scope = { kind: 'shoes' };
  proof.ladder(levels(), cite, NOW, [], { store, scope });
  const p = store.propose({ name: 'proof_blend_k', scope, family: 'scalar', value_or_hyperparams: 3, prior: 6,
    fitted_on_ids_hash: null, n_eff: 10, metric: null, held_out_score: 1, guard_lo: null, guard_hi: null }, 0);
  store.promote(p.name, scope, p.version, 0, NOW);
  const a = proof.ladder(levels(), cite, NOW, [], { store, scope });
  const g = proof.guardWith(undefined, {}, a);
  assert.equal(g.citation?.param_versions.proof_blend_k, 1);
  const independent = { ...store, read: (name: string, s: Parameters<typeof store.read>[1]) => {
    assert.notEqual(name, 'proof_blend_k', 'a note-only guard read an unrelated blend parameter');
    return store.read(name, s);
  } };
  assert.equal(proof.guardWith(independent, {}, a).guarded.state, 'shown');
});
