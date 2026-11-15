// tr-3 proof: score, loss, friction, action and the gate (spec/engines/trust.md §3, §4 gate, worked example).
import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryStore } from '../param/param.ts';
import { declareTrust, type Ctx, type Msg } from './signals.ts';
import { askLine, decideThread, gatePassed, loss, type Deps, type ThreadIn } from './decide.ts';

const store = memoryStore();
declareTrust(store);
const p = (n: string) => store.read(n, {}).value as number;
const ctx = (over: Partial<Ctx> = {}): Ctx => ({
  buyer: { age_days: 9, ratings: 0, good_purchases: 0 }, banner: false, urgent: true, price_usd: 300,
  printHits: { sellers: 0, buyers: 0 }, sameTextListings10m: 0, p, ...over,
});
const msg = (text: string, n = 1): Msg => ({ id: 'm1', thread_id: 't1', site: 'facebook', n, text, at: '2026-11-14T10:00:00Z' });
const WORKED = 'Still available? I will pay by Zelle now, send me your email so I can lock it in. Here is my number: https://my-pics.example/x';
const thread = (over: Partial<ThreadIn> = {}): ThreadIn => ({
  msg: msg(WORKED), ctx: ctx(), group: 'facebook_local', checkout: false, orderPaid: false, local: true, keep_q50: 300, refund_asked: 0, ...over,
});
const model = (...sigs: string[]): Deps['model'] => async () => sigs.map((signal) => ({ signal, confidence: 0.9, span: signal }));
const deps = (m: Deps['model'], over: Partial<Deps> = {}): Deps => ({ store, model: m, ...over });

test('worked example: s = 4.2, L = 300, F = 17.14, line 1.24, ask, share_address locked, no percentage', async () => {
  const d = await decideThread(deps(model('off_platform', 'asks_address_phone')), thread());
  assert.ok(Math.abs(d.s - 4.2) < 1e-9, String(d.s));
  assert.equal(d.loss, 300);
  assert.ok(Math.abs(d.friction - 17.14) < 1e-9);
  assert.ok(Math.abs(d.line - 1.2434) < 0.001);
  assert.equal(d.action, 'ask');
  assert.equal(d.commitWaits, true);
  assert.deepEqual(d.locked, ['move_off_site', 'share_address']);
  assert.equal(d.percent, null);
  assert.match(d.reasons.join(' '), /off the site|Zelle|pay/i);
});

test('the reference loss puts the ask line at exactly card 5\'s 1.5; loss has a $20 floor and counts the refund asked', () => {
  assert.ok(Math.abs(askLine(50, p) - 1.5) < 0.01);
  assert.equal(loss(5, 0, p), 20);
  assert.equal(loss(100, 50, p), 150);
});

test('blocked: a scam script (the overpay message) is blocked and no draft is allowed', async () => {
  const d = await decideThread(deps(model('overpay_or_shipping_label')), thread({ msg: msg('Zelle says you need a business account. I sent $350, please refund the $50.', 3) }));
  assert.equal(d.action, 'block');
  assert.equal(d.draft, false);
  assert.ok(d.reasons.length > 0);
});

test('a good buyer sees no friction: none, no reason, commit does not wait', async () => {
  const d = await decideThread(deps(model()), thread({ msg: msg('Does it come with the case? I can pick up Saturday.', 3), ctx: ctx({ buyer: { age_days: 900, ratings: 60, good_purchases: 12 }, urgent: false, price_usd: 80 }), keep_q50: 80 }));
  assert.equal(d.action, 'none');
  assert.equal(d.commitWaits, false);
  assert.deepEqual(d.reasons, []);
});

test('a high-loss buyer over the line never passes: ask at $300 where $30 would not be asked', async () => {
  const c = ctx({ buyer: { age_days: 9, ratings: 0, good_purchases: 0 }, urgent: false, price_usd: 100 });
  const hi = await decideThread(deps(model('off_platform')), thread({ ctx: c, msg: msg('ok i will pay zelle'), keep_q50: 300 }));
  const lo = await decideThread(deps(model('off_platform')), thread({ ctx: c, msg: msg('ok i will pay zelle'), keep_q50: 25 }));
  assert.equal(hi.action, 'ask');
  assert.notEqual(lo.action, 'block');
  assert.ok(hi.commitWaits);
  // a high-loss thread is never dropped to none by a missing keep value
  const none = await decideThread(deps(model('off_platform')), thread({ ctx: c, msg: msg('ok i will pay zelle'), keep_q50: Number.NaN }));
  assert.notEqual(none.action, 'none');
});

test('warn: a score within the gap under the line shows one line', async () => {
  // new account (0.7) + urgency (0.5) = 1.2 at $300: line 1.24, gap 0.04 -> warn
  const d = await decideThread(deps(model()), thread({ msg: msg('is the phone still here?') }));
  assert.ok(Math.abs(d.s - 1.2) < 1e-9);
  assert.equal(d.action, 'warn');
});

test('model failure or timeout: the commit becomes ask and says the check did not finish; never none, never block', async () => {
  const boom = await decideThread(deps(async () => { throw new Error('down'); }), thread({ msg: msg('hi'), ctx: ctx({ buyer: { age_days: 900, ratings: 60, good_purchases: 12 }, urgent: false }) }));
  assert.equal(boom.action, 'ask');
  assert.match(boom.reasons.join(' '), /did not finish/);
  const slow = await decideThread(deps(() => new Promise(() => {}), { ms: 20 }), thread({ msg: msg('hi') }));
  assert.equal(slow.action, 'ask');
  assert.match(slow.reasons.join(' '), /did not finish/);
});

test('a hard rule from code stops before the score: a gift card ask blocks with the model down', async () => {
  const d = await decideThread(deps(async () => { throw new Error('down'); }), thread({ msg: msg('I will pay with an Apple gift card') }));
  assert.equal(d.action, 'block');
});

test('299 resolved threads: no percentage; at 300 with 30 positives and ece within 5 points: a percentage', async () => {
  assert.equal(gatePassed({ n: 299, positives: 40, ece: 0.02 }, p), false);
  assert.equal(gatePassed({ n: 300, positives: 29, ece: 0.02 }, p), false);
  assert.equal(gatePassed({ n: 300, positives: 30, ece: 0.06 }, p), false);
  assert.equal(gatePassed({ n: 300, positives: 30, ece: 0.05 }, p), true);
  const s2 = memoryStore();
  declareTrust(s2);
  const put = (n: number, ece: number) => {
    s2.propose({ name: 'trust_calib', scope: {}, family: 'model_ref', value_or_hyperparams: { uri: 'x', version: 1, kind: 'platt', a: 1, b: 0, n, positives: 40, ece }, prior: null, fitted_on_ids_hash: null, n_eff: n, metric: null, held_out_score: n, guard_lo: null, guard_hi: null }, s2.rows('trust_calib', {}).length);
    s2.promote('trust_calib', {}, s2.rows('trust_calib', {}).length, 0, '2026-11-14T00:00:00Z');
  };
  put(299, 0.02);
  const none = await decideThread({ store: s2, model: model('off_platform') }, thread());
  assert.equal(none.percent, null);
  put(300, 0.02);
  const some = await decideThread({ store: s2, model: model('off_platform') }, thread());
  assert.ok(some.percent !== null && some.percent.checked === 300);
});

test('block from the score alone needs the gate and a calibrated p of 0.95', async () => {
  const s2 = memoryStore();
  declareTrust(s2);
  s2.propose({ name: 'trust_calib', scope: {}, family: 'model_ref', value_or_hyperparams: { uri: 'x', version: 1, kind: 'platt', a: 1, b: 0, n: 400, positives: 90, ece: 0.02 }, prior: null, fitted_on_ids_hash: null, n_eff: 400, metric: null, held_out_score: 1, guard_lo: null, guard_hi: null }, 0);
  s2.promote('trust_calib', {}, 1, 0, '2026-11-14T00:00:00Z');
  const high = await decideThread({ store: s2, model: model('off_platform', 'ship_elsewhere', 'third_party_collects', 'asks_address_phone') }, thread({ ctx: ctx({ banner: true, printHits: { sellers: 3, buyers: 3 } }) }));
  assert.equal(high.action, 'block'); // s = 2+1.5+1.5+2+1+.7+1+.5+... logit over ln(19)
  assert.equal(high.draft, false);
  const under = await decideThread({ store, model: model('off_platform', 'ship_elsewhere', 'third_party_collects') }, thread({ ctx: ctx({ banner: true, printHits: { sellers: 3, buyers: 3 } }) }));
  assert.notEqual(under.action, 'block', 'gate not passed: ask, never block from the score');
});

test('counterfactual: a name, a language or a place does not move the score', async () => {
  const a = await decideThread(deps(model('off_platform')), thread({ msg: msg('Hola soy María de Madrid, pago por zelle') }));
  const b = await decideThread(deps(model('off_platform')), thread({ msg: msg('Hi I am John from Ohio, pay by zelle') }));
  assert.equal(a.s, b.s);
  assert.equal(a.action, b.action);
});

test('person scope: a person\'s learned weight changes their score and no one else\'s', async () => {
  const s2 = memoryStore();
  declareTrust(s2);
  s2.observe('trust_q.off_platform', { site: 'facebook_local', person: 'ana' }, { success: 1, weight: 1 }, '2026-11-14T00:00:00Z');
  const base = await decideThread({ store: s2, model: model('off_platform') }, thread());
  const ana = await decideThread({ store: s2, model: model('off_platform') }, thread({ person: 'ana' }));
  const bo = await decideThread({ store: s2, model: model('off_platform') }, thread({ person: 'bo' }));
  assert.ok(ana.s > base.s);
  assert.equal(bo.s, base.s);
});
