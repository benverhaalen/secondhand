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

// Follow-up: D17, D5's no-show sibling, and card 5's message action.
import { codeSignals } from './signals.ts';
import { counterfeit } from './counterfeit.ts';
import { priors, numeric, resolve, SCORED_NAMES, SCORED, STRENGTH } from './params.ts';

const fitted = (store: ReturnType<typeof setup>, name: string, value: unknown) => {
  store.propose({ name, scope: {}, family: 'model_ref', value_or_hyperparams: value, prior: null, n_eff: 2, metric: null, fitted_on_ids_hash: null, held_out_score: 1, guard_lo: null, guard_hi: null }, 0);
  store.promote(name, {}, 1, 0, '2026-11-14T10:00:00Z');
};

test('D17: missing price and keep asks with the minimum loss and names the unknown price', async () => {
  const t = thread();
  delete t.ctx.price_cents;
  const out = await decideThread({ model: async () => [] }, { ...t, refund_asked_cents: 5000 });
  assert.equal(out.action, 'ask');
  assert.equal(out.loss_cents, priors().trust_loss_min_cents);
  assert.match(out.reasons[0], /price.*(?:not known|unknown)/i);
});
test('D17: missing listing price still uses an available keep valuation', async () => {
  const t = thread();
  delete t.ctx.price_cents;
  const out = await decideThread({}, { ...t, keep_q50_cents: 4800 });
  assert.equal(out.loss_cents, 4800);
  assert.equal(out.action, 'none');
});
test('D17: urgency without a price is absent and code hard rules still run', async () => {
  const t = thread("I'll pay with an Apple gift card");
  delete t.ctx.price_cents;
  t.ctx.urgent = true;
  const readings = codeSignals(t.msg, { ...t.ctx, p: numeric(priors()) });
  assert.equal(readings.find(r => r.signal === 'urgency_no_question')?.present, false);
  assert.equal((await decideThread({}, t)).action, 'block');
});
for (const missing of ['price_cents', 'q50_cents'] as const) {
  test(`D17: counterfeit with missing ${missing} asks without throwing`, () => {
    const input = { proofPhoto: true, site: 'other' as const, shoes: false, stockPhoto: false, price_cents: 30000, q50_cents: 31000 };
    delete (input as Partial<typeof input>)[missing];
    const out = counterfeit(input);
    assert.equal(out.action, 'ask');
    assert.equal(out.price, null);
    assert.equal(out.typical, null);
    assert.ok(out.reasons.length > 0);
  });
}
test("D17: partial fitted weights use each missing name's prior and log each missing name", async () => {
  const store = setup();
  fitted(store, 'trust_weights', { uri: 'fixture', b: -3, weights: { off_platform: 2.5 } });
  fitted(store, 'trust_q.new_account', { alpha: 20, beta: 1 });
  fitted(store, 'trust_calib', { kind: 'platt', a: 1, b: 0, n: 400, positives: 40, ece: .01, score_model_version: 1 });
  const resolved = resolve(store, {});
  const weights = (resolved.values.trust_weights as { weights: Record<string, number> }).weights;
  for (const name of SCORED_NAMES) assert.equal(weights[name], name === 'off_platform' ? 2.5 : SCORED[name].w, name);
  const missing = SCORED_NAMES.filter(name => name !== 'off_platform');
  assert.equal(resolved.errors.length, missing.length);
  for (const name of missing) assert.equal(resolved.errors.filter(error => error.message.includes(name)).length, 1, name);
  assert.equal(resolved.values.trust_b, -3);
  assert.equal(resolved.versions.trust_weights, 1);
  const entries: { event: string }[] = [], events: Record<string, unknown>[] = [];
  const logger = createLog({ src: 'test', build: 'fixture', sink: entry => { entries.push(JSON.parse(entry)); } });
  const t = thread();
  t.ctx.buyer.age_days = 1;
  const out = await decideThread({ store, logger, log: e => events.push(e), model: async () => [{ signal: 'off_platform', confidence: .9, span: 'off site' }] }, t);
  assert.equal(out.s, 2.5 + SCORED.new_account.w);
  assert.notEqual(out.p, null, 'partial weights preserve compatible calibration');
  assert.equal(entries.filter(e => e.event === 'error').length, missing.length);
  const failures = events.filter(e => e.kind === 'trust_params_failed');
  assert.equal(failures.length, missing.length);
  for (const name of missing) assert.equal(failures.filter(e => String(e.error).includes(name)).length, 1, name);
});
for (const invalid of [NaN, Infinity, -Infinity, '2', null, undefined]) {
  test(`D17: nonfinite or nonnumeric fitted weight ${String(invalid)} uses only that name's prior`, async () => {
    const store = setup();
    fitted(store, 'trust_weights', { uri: 'fixture', b: -4, weights: { ...Object.fromEntries(SCORED_NAMES.map(name => [name, .8])), off_platform: invalid } });
    const resolved = resolve(store, {});
    const weights = (resolved.values.trust_weights as { weights: Record<string, number> }).weights;
    assert.equal(weights.off_platform, SCORED.off_platform.w);
    assert.equal(weights.new_account, .8);
    assert.equal(resolved.errors.length, 1);
    assert.match(resolved.errors[0].message, /off_platform/);
    const out = await decideThread({ store, model: async () => [{ signal: 'off_platform', confidence: .9, span: 'off site' }] }, thread());
    assert.equal(out.s, SCORED.off_platform.w);
  });
}
test('D17: a complete fitted weights row is accepted', async () => {
  const store = setup();
  fitted(store, 'trust_weights', { uri: 'fixture', b: -4, weights: Object.fromEntries(SCORED_NAMES.map(s => [s, .8])) });
  const t = thread();
  t.ctx.buyer.age_days = 1;
  assert.equal((await decideThread({ store }, t)).s, .8);
});

for (const [positive, negative, bounded] of [[1, 1, true], [30, 29, true], [29, 30, true], [30, 30, false]] as const) {
  for (const [signal, prior, learned] of [['past', 2, -2], ['paid', -3, 2]] as const) {
    test(`D5: no-show ${signal}, ${positive} positive/${negative} negative labels ${bounded ? 'stays in' : 'leaves'} the prior band`, () => {
      const store = setup();
      const total = STRENGTH + positive + negative;
      const qt = STRENGTH + positive;
      fitted(store, `trust_ns_q.${signal}`, { alpha: qt * .1 * Math.exp(learned), beta: qt * (1 - .1 * Math.exp(learned)) });
      fitted(store, `trust_ns_r.${signal}`, { alpha: total * .1, beta: total * .9 });
      const value = numeric(resolve(store, {}).values)(`trust_ns_${signal}_weight`);
      assert.ok(Math.abs(value - (bounded ? prior - Math.sign(prior) * Math.abs(prior) * .5 : learned)) < 1e-12);
    });
  }
}
test('D5: live scam weights share the low-support band', async () => {
  const store = setup();
  fitted(store, 'trust_q.new_account', { alpha: 20, beta: 1 });
  const t = thread();
  t.ctx.buyer.age_days = 1;
  const out = await decideThread({ store }, t);
  assert.ok(Math.abs(out.s - SCORED.new_account.w * 1.5) < 1e-12);
});

for (const [action, scam_warning, hold_commits, reason] of [
  ['block', true, true, 'first reason'], ['ask', false, true, 'first reason'],
  ['warn', false, false, 'warn line'], ['none', false, false, null],
] as const) {
  test(`card 5: messageAction maps ${action}`, async () => {
    const { messageAction } = await import('./action.ts');
    const base = await decideThread({}, thread());
    const decision = { ...base, action, reasons: action === 'warn' ? ['warn line'] : ['first reason', 'second reason'] };
    assert.deepEqual(messageAction(decision), { scam_warning, hold_commits, reason });
  });
}
test('card 5: gift-card code rule creates a scam warning with a successful empty extractor', async () => {
  const { messageAction } = await import('./action.ts');
  const out = messageAction(await decideThread({ model: async () => [] }, thread("I'll pay with an Apple gift card")));
  assert.equal(out.scam_warning, true);
  assert.equal(out.hold_commits, true);
  assert.match(out.reason ?? '', /gift.card/i);
});
test('card 5: a new-account-only thread creates no scam warning', async () => {
  const { messageAction } = await import('./action.ts');
  const t = thread();
  t.ctx.buyer.age_days = 1;
  const out = messageAction(await decideThread({ model: async () => [] }, t));
  assert.equal(out.scam_warning, false);
});

test('D17: a nonfinite fitted intercept withholds calibration without throwing', async () => {
  const store = setup();
  fitted(store, 'trust_weights', { uri: 'fixture', b: NaN, weights: { off_platform: 2.5 } });
  fitted(store, 'trust_calib', { kind: 'platt', a: 1, b: 20, n: 400, positives: 40, ece: .01, score_model_version: 0 });
  const out = await decideThread({ store }, thread());
  assert.equal(out.p, null);
  assert.equal(out.percent, null);
  assert.equal(out.action, 'none');
});

test('card 5: warn maps its warning line after any locked-action reasons', async () => {
  const { messageAction } = await import('./action.ts');
  const out = await decideThread({}, thread());
  assert.equal(messageAction({ ...out, action: 'warn', reasons: ['Locked action reason.', 'Check before you reply: the account is new.'] }).reason,
    'Check before you reply: the account is new.');
});

import { observeAppointment, nsScore, type NsIn } from './noshow.ts';
test('D5: two actual no-show labels cannot move the paid signal more than half its prior', () => {
  const store = setup();
  const input: NsIn = { pastNoShows: 0, paidInApp: true, exactTimeConfirmed24h: false, vagueTime: false,
    newNoRatings: false, hardHaggle: false, rescheduledOnce: false, repliedConfirm30: false };
  for (let i = 0; i < 2; i++) observeAppointment(store, {}, input, 1, '2026-11-14T10:00:00Z');
  const score = nsScore(input, resolve(store, {}).values);
  assert.ok(Math.abs(score - numeric(priors())('trust_ns_paid_weight')) <= 1.5);
});

const calibratedStore = () => {
  const store = setup();
  fitted(store, 'trust_calib', { kind: 'platt', a: 1, b: 20, n: 400, positives: 40, ece: .01, score_model_version: 0 });
  return store;
};
test('unknown price cannot downgrade a gate-passing calibrated block', async () => {
  const t = thread();
  delete t.ctx.price_cents;
  const out = await decideThread({ store: calibratedStore(), model: async () => [] }, t);
  assert.ok(out.p !== null && out.p >= numeric(priors())('trust_p_block'));
  assert.equal(out.action, 'block');
});
test('failed extraction still asks above the calibrated block threshold with unknown price', async () => {
  const t = thread();
  delete t.ctx.price_cents;
  const out = await decideThread({ store: calibratedStore(), model: async () => { throw new Error('down'); } }, t);
  assert.equal(out.action, 'ask');
  assert.ok(out.reasons.includes('The check did not finish, so every commit waits for you.'));
});
for (const row of ['q', 'r']) {
  test(`corrupt scam ${row} count returns the signal prior and logs exactly one error`, async () => {
    const store = setup();
    fitted(store, `trust_${row}.new_account`, { alpha: -1, beta: 20 });
    const entries: { event: string }[] = [], events: Record<string, unknown>[] = [];
    const logger = createLog({ src: 'test', build: 'fixture', sink: entry => { entries.push(JSON.parse(entry)); } });
    const t = thread();
    t.ctx.buyer.age_days = 1;
    const out = await decideThread({ store, logger, log: e => events.push(e), model: async () => [] }, t);
    assert.equal(out.s, SCORED.new_account.w);
    assert.equal(entries.filter(e => e.event === 'error').length, 1);
    const errors = events.filter(e => e.kind === 'trust_params_failed');
    assert.equal(errors.length, 1);
    assert.match(String(errors[0].error), /trust_q\/r.*new_account/);
  });
  test(`corrupt no-show ${row} count resolves to the name's prior with one returned and logged error`, async () => {
    const store = setup();
    fitted(store, `trust_ns_${row}.paid`, { alpha: -1, beta: 20 });
    const out = resolve(store, {});
    assert.equal(numeric(out.values)('trust_ns_paid_weight'), numeric(priors())('trust_ns_paid_weight'));
    assert.equal(out.errors.length, 1);
    assert.match(out.errors[0].message, /trust_q\/r.*paid/);
    const events: Record<string, unknown>[] = [];
    await decideThread({ store, log: e => events.push(e), model: async () => [] }, thread());
    assert.equal(events.filter(e => e.kind === 'trust_params_failed').length, 1);
  });
}
test('unknown price follows the gift-card hard reason in block and messageAction', async () => {
  const { messageAction } = await import('./action.ts');
  const t = thread("I'll pay with an Apple gift card");
  delete t.ctx.price_cents;
  const out = await decideThread({ model: async () => [] }, t);
  assert.equal(out.action, 'block');
  assert.match(out.reasons[0], /gift card/);
  assert.ok(out.reasons.indexOf('The price is not known.') > 0);
  assert.equal(messageAction(out).reason, out.reasons[0]);
});
for (const calibrated of [false, true]) {
  test(`${calibrated ? 'block' : 'ask'} puts the strongest learned reason before the unknown price`, async () => {
    const store = setup();
    fitted(store, 'trust_weights', { uri: 'fixture', b: -4, weights: { ...Object.fromEntries(SCORED_NAMES.map(name => [name, SCORED[name].w])), new_account: -.2, ship_elsewhere: .8, third_party_collects: .3 } });
    if (calibrated) fitted(store, 'trust_calib', { kind: 'platt', a: 1, b: 20, n: 400, positives: 40, ece: .01, score_model_version: 1 });
    const t = thread();
    t.ctx.buyer.age_days = 1;
    delete t.ctx.price_cents;
    const out = await decideThread({ store, model: async () => ['third_party_collects', 'ship_elsewhere'].map(signal => ({ signal, confidence: .9, span: signal })) }, t);
    assert.equal(out.action, calibrated ? 'block' : 'ask');
    assert.equal(out.reasons[0], 'Check before you reply: they want it shipped somewhere else.');
    assert.ok(out.reasons.indexOf('The price is not known.') > 0);
    assert.doesNotMatch(out.reasons.join(' '), /account is new/);
    if (!calibrated) assert.match(out.reasons.join(' '), /someone else would collect it/);
  });
}
for (const sink of ['logger', 'log'] as const) {
  test(`missing extractor records one code-only note per call through ${sink}, without an error`, async () => {
    const entries: { event: string; msg?: string }[] = [], events: Record<string, unknown>[] = [];
    const logger = createLog({ src: 'test', build: 'fixture', sink: entry => { entries.push(JSON.parse(entry)); } });
    const deps = sink === 'logger' ? { logger } : { log: (e: Record<string, unknown>) => events.push(e) };
    for (let i = 0; i < 2; i++) {
      await decideThread(deps, thread());
      assert.equal(sink === 'logger' ? entries.filter(e => e.event === 'note' && /code only/i.test(e.msg ?? '')).length : events.filter(e => e.kind === 'trust_code_only').length, i + 1);
    }
    assert.equal(entries.filter(e => e.event === 'error').length, 0);
    assert.equal(events.filter(e => /failed/.test(String(e.kind))).length, 0);
  });
}
