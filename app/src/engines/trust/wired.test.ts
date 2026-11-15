import test from 'node:test';
import assert from 'node:assert/strict';
import { createLog } from '../../../../log/index.js';
import { memoryStore } from '../param/param.ts';
import { declareTrust } from './signals.ts';
import { decideThread, type ThreadIn } from './decide.ts';

const setup = () => { const store = memoryStore(); declareTrust(store); return store; };
const thread = (text = 'is this still available?'): ThreadIn => ({
  msg: { id: 'm', thread_id: 't', site: 'ebay', n: 3, text, at: '2026-11-14T10:00:00Z' },
  ctx: { buyer: { age_days: 90, ratings: 2, good_purchases: 0 }, banner: false, urgent: false,
    price_cents: 30000, printHits: { sellers: 0, buyers: 0 }, sameTextListings10m: 0, p: () => 0 },
  group: 'ebay', checkout: true, orderPaid: false, local: false,
});

const malformed: [string, unknown][] = [
  ['confidence 2', [{ signal: 'off_platform', confidence: 2, span: 'pay off site' }]],
  ['negative confidence', [{ signal: 'off_platform', confidence: -1, span: 'pay off site' }]],
  ['nonfinite confidence', [{ signal: 'off_platform', confidence: NaN, span: 'pay off site' }]],
  ['unknown signal', [{ signal: 'unknown', confidence: .9, span: 'pay off site' }]],
  ['empty span', [{ signal: 'off_platform', confidence: .9, span: ' ' }]],
  ['non-array reply', {}], ['null row', [null]], ['sparse array', new Array<unknown>(1)],
  ['non-string span', [{ signal: 'off_platform', confidence: .9, span: 4 }]],
  ['non-string signal', [{ signal: 4, confidence: .9, span: 'pay off site' }]],
  ['non-number confidence', [{ signal: 'off_platform', confidence: '.9', span: 'pay off site' }]],
  ['partial valid reply', [{ signal: 'asks_code', confidence: .9, span: 'code' }, { signal: 'unknown', confidence: .9, span: 'bad' }]],
];
for (const [cause, reply] of malformed) {
  test(`trust.model_down: ${cause} asks and logs once without throwing`, async () => {
    await modelDown(async () => reply);
  });
}
async function modelDown(model: () => Promise<unknown>) {
  const entries: { event: string }[] = [], events: Record<string, unknown>[] = [];
  const logger = createLog({ src: 'test', build: 'fixture', sink: entry => { entries.push(JSON.parse(entry)); } });
  const out = await decideThread({ store: setup(), model, logger, log: e => events.push(e) }, thread());
  assert.equal(out.action, 'ask');
  assert.equal(out.checked_by, 'code');
  assert.ok(out.reasons.includes('The check did not finish, so every commit waits for you.'));
  assert.ok(out.readings.every(r => r.extractor === 'code'));
  assert.equal(entries.filter(e => e.event === 'error').length, 1);
  assert.equal(events.filter(e => e.kind === 'trust_model_failed').length, 1);
}
test('trust.model_down: rejecting model asks and logs once', async () => {
  await modelDown(async () => { throw new Error('down'); });
});
test('trust.model_down: invalid threshold asks and logs once', async () => {
  const store = setup();
  const read = store.read.bind(store);
  store.read = (name, scope) => name === 'trust_thr.off_platform' ? { ...read(name, scope), value: NaN } : read(name, scope);
  const errors: Record<string, unknown>[] = [];
  const out = await decideThread({ store, model: async () => [{ signal: 'off_platform', confidence: .9, span: 'pay off site' }], log: e => errors.push(e) }, thread());
  assert.equal(out.action, 'ask');
  assert.equal(out.checked_by, 'code');
  assert.equal(errors.filter(e => e.kind === 'trust_model_failed').length, 1);
});
test('hard rule still blocks a gift-card message after malformed model output', async () => {
  const out = await decideThread({ model: async () => ({}) }, thread("I'll pay with an Apple gift card"));
  assert.equal(out.action, 'block');
  assert.equal(out.checked_by, 'code');
});
test('no extractor: gift card blocks on code alone without a model failure', async () => {
  const events: Record<string, unknown>[] = [];
  const out = await decideThread({ log: e => events.push(e) }, thread("I'll pay with an Apple gift card"));
  assert.notEqual(out.action, 'none');
  assert.equal(out.checked_by, 'code');
  assert.equal(events.filter(e => e.kind === 'trust_model_failed').length, 0);
  assert.ok(out.readings.every(r => r.extractor === 'code'));
});
test('no extractor: a plain availability question needs no action', async () => {
  const out = await decideThread({}, thread());
  assert.equal(out.action, 'none');
  assert.equal(out.checked_by, 'code');
});
test('successful extractor is checked by code+model, even with no predicates', async () => {
  let calls = 0;
  const out = await decideThread({ model: async () => { calls++; return []; } }, thread());
  assert.equal(out.checked_by, 'code+model');
  assert.equal(calls, 1);
});
test('warn names new_account when it alone contributes to the score', async () => {
  const t = thread();
  t.ctx.buyer.age_days = 1;
  t.ctx.price_cents = 300000;
  const out = await decideThread({}, t);
  assert.equal(out.action, 'warn');
  assert.match(out.reasons.join(' '), /the account is new/);
});
test('money: a 5000-cent refund and a 4800-cent keep give loss 9800', async () => {
  const out = await decideThread({}, { ...thread(), keep_q50_cents: 4800, refund_asked_cents: 5000 });
  assert.equal(out.loss_cents, 9800);
});
// @ts-expect-error ThreadIn accepts keep_q50_cents only.
const legacy: ThreadIn = { ...thread(), keep_q50: 4800 };
void legacy;

test('warn names the largest learned contribution rather than the largest prior', async () => {
  const store = setup();
  const value = { uri: 'fixture', b: -4, weights: { off_platform: .2, ship_elsewhere: .8 } };
  store.propose({ name: 'trust_weights', scope: {}, family: 'model_ref', value_or_hyperparams: value, prior: null, n_eff: 400, metric: null, fitted_on_ids_hash: null, held_out_score: 1, guard_lo: null, guard_hi: null }, 0);
  store.promote('trust_weights', {}, 1, 0, '2026-11-14T10:00:00Z');
  const out = await decideThread({ store, model: async () => ['off_platform', 'ship_elsewhere'].map(signal => ({ signal, confidence: .9, span: signal })) }, thread());
  assert.equal(out.action, 'warn');
  assert.equal(out.reasons.at(-1), 'Check before you reply: they want it shipped somewhere else.');
});

test('warn keeps the fixed line when no positive signal is present', async () => {
  const store = setup();
  store.propose({ name: 'trust_b', scope: {}, family: 'scalar', value_or_hyperparams: -3, prior: null, n_eff: 400, metric: null, fitted_on_ids_hash: null, held_out_score: 1, guard_lo: null, guard_hi: null }, 0);
  store.promote('trust_b', {}, 1, 0, '2026-11-14T10:00:00Z');
  const out = await decideThread({ store }, thread());
  assert.equal(out.action, 'warn');
  assert.deepEqual(out.reasons, ['Don’t open links from buyers.']);
});

test('warn uses the fixed fallback when a reversed good_history weight has no WHY text', async () => {
  const store = setup();
  const value = { uri: 'fixture', b: -4, weights: { good_history: 1 } };
  store.propose({ name: 'trust_weights', scope: {}, family: 'model_ref', value_or_hyperparams: value, prior: null, n_eff: 400, metric: null, fitted_on_ids_hash: null, held_out_score: 1, guard_lo: null, guard_hi: null }, 0);
  store.promote('trust_weights', {}, 1, 0, '2026-11-14T10:00:00Z');
  const t = thread();
  t.ctx.buyer.good_purchases = 10;
  const out = await decideThread({ store }, t);
  assert.equal(out.action, 'warn');
  assert.deepEqual(out.reasons, ['Don’t open links from buyers.']);
});
