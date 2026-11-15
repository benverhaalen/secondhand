import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { memoryStore } from '../param/param.ts';
import { FEATURE_ORDER, features, onOutcome, pAcceptFrom, type Model, type Outcome } from './learn.ts';

type Sequence = { name: string; initial: Model; at: string; events: { at: string; row: Outcome; expected: Model & { p: number } }[] };
const fixture = JSON.parse(readFileSync(new URL('./fixtures/learn-parity.json', import.meta.url), 'utf8')) as {
  feature_order: string[]; sequences: Sequence[];
};
function close(actual: number, expected: number, cause: string) { assert.ok(Math.abs(actual - expected) < 1e-9, `${cause}: ${actual} != ${expected}`); }

test('dated per-outcome Laplace updates match fit.online_update through the registry', () => {
  assert.deepEqual(fixture.feature_order, FEATURE_ORDER);
  assert.ok(fixture.sequences.length >= 8);
  for (const sequence of fixture.sequences) {
    const store = memoryStore(), scope = { site: 'poshmark', segment: 'jackets' };
    pAcceptFrom(store, scope, features);
    const row = store.propose({ name: 'P_accept', scope, family: 'model_ref', value_or_hyperparams: sequence.initial,
      prior: sequence.initial, held_out_score: 0, n_eff: 0, metric: 'negative_log_loss', fitted_on_ids_hash: null, guard_lo: null, guard_hi: null }, 0);
    store.promote('P_accept', scope, row.version, 0, sequence.at);
    for (const [i, event] of sequence.events.entries()) {
      // Scope selects the registry cell; these sequences also exercise shared rows with other hierarchy keys.
      const s = { ...scope, site: event.row.site, segment: event.row.category };
      const applied = onOutcome(store, s, event.row, event.at);
      assert.equal(applied.applied, true);
      const actual = applied.read.value as Model;
      for (const [key, value] of Object.entries(event.expected.terms)) close(actual.terms[key], value, `${sequence.name}/${i} term ${key}`);
      for (const [key, value] of Object.entries(event.expected.precision!)) close(actual.precision![key], value, `${sequence.name}/${i} precision ${key}`);
      actual.weights.forEach((value, j) => close(value, event.expected.weights[j], `${sequence.name}/${i} weight ${j}`));
      const p = pAcceptFrom(store, s, () => event.row.features);
      close(p(7000, { site: event.row.site } as Parameters<typeof p>[1]), event.expected.p, `${sequence.name}/${i} prediction`);
    }
  }
});
