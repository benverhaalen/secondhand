import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryStore } from '../param/param.ts';
import { declareTrust, readModel, saltsFor, type Ctx } from './signals.ts';
import { decideThread, loss } from './decide.ts';
import { health, flagAfterWarning, observeChallenge, observeDispute, disputeCount } from './health.ts';
import { nsScore, nsDecide, observeAppointment } from './noshow.ts';
import { matchAll, type RecallRow } from './recall.ts';
import { createLabels } from './labels.ts';
import { resolve, numberParam } from './params.ts';
import { counterfeit } from './counterfeit.ts';

const at = '2026-11-14T10:00:00Z';
const setup = () => { const store = memoryStore(); declareTrust(store); return store; };
const context = (store: ReturnType<typeof setup>): Ctx => ({ buyer: { age_days: 90, ratings: 2, good_purchases: 0 }, banner: false, urgent: false, price_cents: 4800, printHits: { sellers: 0, buyers: 0 }, sameTextListings10m: 0, p: n => store.read(n, {}).value as number });
const input = (store: ReturnType<typeof setup>) => ({ msg: { id: 'm', thread_id: 't', site: 'ebay' as const, n: 3, text: 'hello', at }, ctx: context(store), group: 'ebay' as const, checkout: true, orderPaid: false, local: false, refund_asked_cents: 0 });
const promote = (store: ReturnType<typeof setup>, name: string, value: unknown, scope: Record<string, string> = { site: 'ebay' }) => {
  const v = store.rows(name, scope).length;
  store.propose({ name, scope, family: name === 'trust_calib' ? 'model_ref' : 'scalar', value_or_hyperparams: value, prior: null, n_eff: 400, metric: null, fitted_on_ids_hash: null, held_out_score: v + 1, guard_lo: null, guard_hi: null }, v);
  store.promote(name, scope, v + 1, 0, at);
};

test('valuation keep_q50 4800 cents and boundary price 48 dollars produce identical whole-cent loss', async () => {
  const store = setup(), d = { store, model: async () => [] };
  const a = await decideThread(d, { ...input(store), keep_q50_cents: 4800 });
  const b = await decideThread(d, input(store));
  assert.equal(a.loss_cents, 4800); assert.equal(a.loss_cents, b.loss_cents);
  assert.ok(Number.isSafeInteger(a.friction_cents));
});

test('money boundaries refuse fractional, negative, nonfinite and unsafe cents with field name', async () => {
  const store = setup();
  for (const bad of [0.5, -1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(decideThread({ store, model: async () => [] }, { ...input(store), keep_q50_cents: bad }), /keep_q50_cents/);
    await assert.rejects(decideThread({ store, model: async () => [] }, { ...input(store), refund_asked_cents: bad }), /refund_asked_cents/);
  }
  assert.throws(() => loss(Number.MAX_SAFE_INTEGER, 1), /loss_cents/);
});

test('scoped base risk and calibration are read; unsupported display has no percent', async () => {
  const store = setup(); promote(store, 'trust_b', 2);
  promote(store, 'trust_calib', { kind: 'platt', a: 1, b: 0, n: 400, positives: 40, ece: .01 });
  const out = await decideThread({ store, model: async () => [] }, input(store));
  assert.ok(out.p! > .8); assert.equal(out.percent, null);
  promote(store, 'trust_calib', { kind: 'isotonic', xs: [1, 0], ys: [.2, .8], n: 400, positives: 40, ece: .01 });
  await assert.rejects(decideThread({ store, model: async () => [] }, input(store)), /isotonic/);
});

test('health refuses invalid thresholds and values instead of reporting zero risk', () => {
  for (const threshold of [0, -1, NaN, Infinity]) assert.throws(() => health([{ name: 'cancel', value: 1, threshold }]), /threshold/);
  assert.throws(() => health([{ name: 'cancel', value: NaN, threshold: 3 }]), /value/);
});

test('model readings require known predicates, valid confidence and nonempty evidence', () => {
  for (const confidence of [-.1, 1.1, NaN]) assert.throws(() => readModel([{ signal: 'asks_code', confidence, span: 'code' }], () => .1, 'v'), /confidence/);
  assert.throws(() => readModel([{ signal: 'asks_code', confidence: .9, span: ' ' }], () => .1, 'v'), /span/);
});

test('recall priority is stable under permutation for exact and name matches', () => {
  const row = (id: string): RecallRow => ({ RecallID: id, RecallDate: '2025-01-01', LastPublishDate: '2025-01-01', Title: 'Acme heater', Description: 'model AB123' });
  for (const title of ['AB123', 'Acme heater']) {
    const a = matchAll({ id: 'i', title }, [row('b'), row('a')]);
    const b = matchAll({ id: 'i', title }, [row('a'), row('b')]);
    assert.deepEqual(a, b);
  }
});

test('all-thread signal rate observes scams too; identical label retries do not add evidence', () => {
  const store = setup(), labels = createLabels(store, 'fixture');
  const l = { thread_id: 't', buyer: 'fixture', site: 'ebay', outcome: 'scam' as const, weight: .2, present: ['off_platform'], absent: [], at };
  labels.addLabel(l);
  const r = store.read('trust_r.off_platform', { site: 'ebay' });
  assert.ok((r.value as { alpha: number }).alpha > .8);
  const q = store.read('trust_q.off_platform', { site: 'ebay' });
  labels.addLabel(l);
  assert.deepEqual(store.read('trust_q.off_platform', { site: 'ebay' }), q);
});

test('all tunables have source and scope metadata; missing resolved names refuse', () => {
  const values = resolve(setup(), {}).values;
  assert.throws(() => numberParam({}, 'trust_ns_ask'), /trust_ns_ask/);
  assert.equal(numberParam(values, 'trust_ns_past_weight'), 2);
  assert.equal(flagAfterWarning(.7, { ...values, trust_warning_factor: .5 }), .35);
  assert.equal(saltsFor('2026-12-02', { ...values, trust_salt_overlap_days: 1 }).length, 1);
});

test('no-show priors are resolved and appointment outcomes update base and signal posteriors', () => {
  const store = setup(), scope = { site: 'ebay', person: 'fixture' };
  const i = { pastNoShows: 0, paidInApp: false, exactTimeConfirmed24h: false, vagueTime: true, newNoRatings: false, hardHaggle: false, rescheduledOnce: false, repliedConfirm30: false };
  const before = nsScore(i, resolve(store, scope).values);
  observeAppointment(store, scope, i, 1, at);
  assert.ok((store.read('trust_ns_b', scope).value as { alpha: number }).alpha > 1);
  assert.notEqual(nsScore(i, resolve(store, scope).values), before);
  assert.equal(nsDecide({ ...i, pastNoShows: 1 }).shown, null, 'uncited pickup count hidden');
});

test('challenge and dispute observations change scoped posterior and counts', () => {
  const store = setup(), scope = { site: 'ebay', segment: 'pace:2' };
  observeChallenge(store, scope, 1, at);
  assert.equal((store.read('trust_pace', scope).value as { alpha: number }).alpha, 2);
  observeDispute(store, { site: 'ebay', segment: 'reason:bundle' }, 1, at);
  assert.equal((store.read('trust_dispute', { site: 'ebay', segment: 'reason:bundle' }).value as { alpha: number }).alpha, 2);
  assert.equal(disputeCount(store, { site: 'ebay', segment: 'reason:bundle' }).shown, null);
});

test('counterfeit money is cents and unsupported displayed prices are hidden', () => {
  const out = counterfeit({ brand: 'Gucci', proofPhoto: true, site: 'other', shoes: false, stockPhoto: false, price_cents: 12000, q50_cents: 31000 });
  assert.equal(out.action, 'warn'); assert.ok(!out.reasons.some(r => /120|310/.test(r)));
  assert.throws(() => counterfeit({ proofPhoto: true, site: 'other', shoes: false, stockPhoto: false, price_cents: .1, q50_cents: 100 }), /price_cents/);
});

test('nightly signal champion is consumed at the group/person scope', async () => {
  const store = setup();
  promote(store, 'trust_weights', { weights: { off_platform: 5 }, b: 1, uri: 'fit' });
  const model = async () => [{ signal: 'off_platform', confidence: .9, span: 'off site' }];
  const out = await decideThread({ store, model }, input(store));
  assert.equal(out.s, 5);
  assert.equal(out.action, 'ask');
});

test('price and q50 displays publish citations with the exact parameter versions', () => {
  const proof = { rows: [{ id: 'listing', source: 'listing', at }], now: at, scope: { site: 'ebay' }, code_version: 'fixture', table_versions: [] };
  const out = counterfeit({ brand: 'Gucci', proofPhoto: true, site: 'other', shoes: false, stockPhoto: false, price_cents: 12000, q50_cents: 31000, proof: { price: proof, q50: proof } }, resolve(setup(), {}).values, { ...resolve(setup(), {}).versions, trust_cf_price_ratio: 7 });
  assert.equal(out.price?.number.state, 'shown');
  assert.equal(out.typical?.citation.param_versions.trust_cf_price_ratio, 7);
  assert.match(out.reasons.join(' '), /\$120.00.*\$310.00/);
});

test('dollar boundary rounds decimal half-cent ties upward exactly once', async () => {
  for (const [usd, expected] of [[20.005, 2001], [48.005, 4801], [1.005, 101], [10.075, 1008]]) {
    const out = counterfeit({ proofPhoto: true, site: 'other', shoes: false, stockPhoto: false, price_cents: expected, q50_cents: 10000 });
    const { dollarsToCents } = await import('./money.ts');
    assert.equal(dollarsToCents(usd, 'price_usd'), expected);
    assert.equal(out.action, 'none');
  }
});

test('label poison cap uses the observation person and site scope', () => {
  const store = setup();
  const scope = { site: 'ebay', person: 'p' };
  const v = store.propose({ name: 'trust_seller_cap', scope, family: 'scalar', value_or_hyperparams: 0, prior: null, n_eff: 40, metric: null, fitted_on_ids_hash: null, held_out_score: 1, guard_lo: null, guard_hi: null }, 0);
  store.promote('trust_seller_cap', scope, v.version, 0, at);
  const before = store.read('trust_q.off_platform', scope);
  createLabels(store, 'fixture').addLabel({ thread_id: 't', person: 'p', buyer: 'fixture', site: 'ebay', outcome: 'scam', weight: 1, present: ['off_platform'], absent: [], at });
  assert.deepEqual(store.read('trust_q.off_platform', scope), before);
});

test('no-show decision reads its learned base rate', () => {
  const store = setup(), scope = { site: 'ebay', person: 'fixture' };
  const i = { pastNoShows: 0, paidInApp: false, exactTimeConfirmed24h: false, vagueTime: true, newNoRatings: false, hardHaggle: false, rescheduledOnce: false, repliedConfirm30: false };
  const before = nsDecide(i, resolve(store, scope).values);
  observeAppointment(store, scope, i, 1, at);
  const after = nsDecide(i, resolve(store, scope).values);
  assert.ok(after.q > before.q);
});

test('duplicate, future or stale numeric evidence stays hidden', () => {
  const row = { id: 'appointment', source: 'appointment', at };
  const i = { pastNoShows: 2, paidInApp: false, exactTimeConfirmed24h: false, vagueTime: true, newNoRatings: false, hardHaggle: false, rescheduledOnce: false, repliedConfirm30: false };
  const proof = { rows: [row, row], now: at, scope: { person: 'fixture' }, code_version: 'fixture', table_versions: [] };
  assert.equal(nsDecide(i, undefined, proof).shown, null);
});

test('print horizon and no-show lines follow scoped resolved values', () => {
  const store = setup();
  promote(store, 'trust_print_days', 1, {});
  const labels = createLabels(store, 'fixture');
  const text = 'I can pay for this lamp today please send an email to arrange the collection';
  labels.addPrint(text, [], 'seller', 'buyer', '2026-11-10T00:00:00Z');
  assert.deepEqual(labels.printHits(text, [], '2026-11-12T00:00:00Z'), { sellers: 0, buyers: 0 });
  const values = resolve(store, {}).values;
  const i = { pastNoShows: 0, paidInApp: false, exactTimeConfirmed24h: false, vagueTime: true, newNoRatings: false, hardHaggle: false, rescheduledOnce: false, repliedConfirm30: false };
  assert.equal(nsDecide(i, { ...values, trust_ns_vague_weight: 4, trust_ns_ask: 3 }).askBeforeBooking, true);
});

test('a calibration from an earlier scoring champion cannot show a percentage or block by score', async () => {
  const store = setup();
  promote(store, 'trust_calib', { kind: 'platt', a: 1, b: 0, n: 400, positives: 40, ece: .01, score_model_version: 0 });
  promote(store, 'trust_weights', { weights: { off_platform: 5 }, b: 5, uri: 'fit' });
  const out = await decideThread({ store, model: async () => [{ signal: 'off_platform', confidence: .9, span: 'off site' }] }, input(store));
  assert.notEqual(out.action, 'block');
  assert.equal(out.p, null); assert.equal(out.percent, null);
});
