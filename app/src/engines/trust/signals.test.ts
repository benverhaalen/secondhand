// tr-1 proof: code signals, hard rules, prints and the link guard (spec/engines/trust.md §2, §9 trust.hard_rules).
import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryStore } from '../param/param.ts';
import { codeSignals, declareTrust, guardLinks, hamming, printOf, saltsFor, simhash, type Ctx, type Msg } from './signals.ts';
import { evaluateHard, type HardInput } from './hard.ts';

const store = memoryStore();
declareTrust(store);
const p = (n: string) => store.read(n, {}).value as number;
const ctx = (over: Partial<Ctx> = {}): Ctx => ({
  buyer: { age_days: 400, ratings: 20, good_purchases: 2 }, banner: false, urgent: false, price_cents: 10000,
  printHits: { sellers: 0, buyers: 0 }, sameTextListings10m: 0, p, ...over,
});
const msg = (text: string, n = 1, site: Msg['site'] = 'facebook'): Msg => ({ id: 'm', thread_id: 't', site, n, text, at: '2026-11-14T10:00:00Z' });

test('flagged: an off-site payment link never reaches the person unflagged, and nothing is fetched', async () => {
  let fetched = 0;
  const real = globalThis.fetch;
  globalThis.fetch = (async () => { fetched++; return new Response(''); }) as typeof fetch;
  try {
    const texts = [
      'pay here https://paypal-verify.example/pay now',
      'confirm at www.secure-ebay-login.com/verify',
      'see https://bit.ly/3xYz12 ok',
      'go to https://xn--pypal-4ve.com/login',
      'open paypal . com / verify to get paid',
      'link: ebay.com.evil.net/pay',
    ];
    for (const t of texts) {
      const g = guardLinks(t, 'ebay');
      assert.equal(g.flagged, true, t);
      assert.ok(g.flags.length >= 1, t);
      assert.ok(!/https?:\/\/|www\.|bit\.ly|xn--|evil\.net|verify/i.test(g.display.replace(/\[link removed[^\]]*\]/g, '')), `display still shows the link: ${g.display}`);
    }
    assert.equal(fetched, 0);
  } finally { globalThis.fetch = real; }
});

test('the site\'s own links pass; plain words do not trip the guard', () => {
  assert.equal(guardLinks('see https://www.ebay.com/itm/123', 'ebay').flagged, false);
  assert.equal(guardLinks('ok. me too, thanks. see you at 5', 'facebook').flagged, false);
  assert.equal(guardLinks('mail me@home.com', 'facebook').flagged, false);
});

test('link_early fires on message 1 or 2 only; claims-to-be-payment is its own code signal', () => {
  const early = codeSignals(msg('buy at https://pay-now.example/x', 1), ctx());
  assert.equal(early.find((r) => r.signal === 'link_early')?.present, true);
  assert.equal(early.find((r) => r.signal === 'payment_link')?.present, true);
  const late = codeSignals(msg('buy at https://pay-now.example/x', 5), ctx());
  assert.equal(late.find((r) => r.signal === 'link_early')?.present, false);
});

test('account signals: new account, good history, banner, urgency, burst', () => {
  const r = codeSignals(msg('hi', 1), ctx({ buyer: { age_days: 9, ratings: 0, good_purchases: 0 }, banner: true, urgent: true, price_cents: 30000, sameTextListings10m: 5 }));
  const on = (s: string) => r.find((x) => x.signal === s)?.present;
  assert.deepEqual([on('new_account'), on('site_banner'), on('urgency_no_question'), on('burst_same_text'), on('good_history')], [true, true, true, true, false]);
  assert.equal(codeSignals(msg('hi'), ctx({ buyer: { age_days: 900, ratings: 50, good_purchases: 10 } })).find((x) => x.signal === 'good_history')?.present, true);
});

test('signal: a template with the item swapped collides; honest words do not', () => {
  const salt = 'trust-2026-11';
  const a = printOf('Hi, I am interested in your iPhone 13. I can pay 350 by Zelle now, please send your email so I can lock it in today.', salt, ['iphone 13']);
  const b = printOf('Hi, I am interested in your Pixel 7. I can pay 280 by Zelle now, please send your email so I can lock it in today.', salt, ['pixel 7']);
  const c = printOf('Does the couch have any pet damage? I would pick it up Saturday afternoon if the price holds for the weekend.', salt, []);
  assert.ok(a !== null && b !== null && c !== null);
  assert.ok(hamming(a, b) <= 3, `template distance ${hamming(a, b)}`);
  assert.ok(hamming(a, c) > 3);
  assert.notEqual(simhash('same words here for the test of salts', 'x'), simhash('same words here for the test of salts', 'y'));
});

test('no print signal: a site prefill or one-line opener from 50 buyers is never a script', () => {
  const salt = 'trust-2026-11';
  for (const t of ['Is this still available?', 'is this still available', 'Hi, is this available?', 'Is this still available? Hello', 'Is this item still available?', 'Offer: $20', 'Yes']) {
    assert.equal(printOf(t, salt, []), null, t);
  }
});

test('the print salt rotates monthly and the old salt is looked up for 7 days', () => {
  assert.deepEqual(saltsFor('2026-12-01T08:00:00Z'), ['trust-2026-12', 'trust-2026-11']);
  assert.deepEqual(saltsFor('2026-12-07T23:00:00Z'), ['trust-2026-12', 'trust-2026-11']);
  assert.deepEqual(saltsFor('2026-12-08T00:00:00Z'), ['trust-2026-12']);
  assert.deepEqual(saltsFor('2027-01-02T00:00:00Z'), ['trust-2027-01', 'trust-2026-12']);
});

test('the scripts counted as a signal need 3 sellers and 3 buyers', () => {
  const on = (s: number, b: number) => codeSignals(msg('x'), ctx({ printHits: { sellers: s, buyers: b } })).find((r) => r.signal === 'script_print_hit')?.present;
  assert.deepEqual([on(3, 3), on(2, 3), on(3, 2)], [true, false, false]);
});

// --- hard rules (trust.hard_rules) ---
const hard = (signals: string[], over: Partial<HardInput> = {}) =>
  evaluateHard({ site: 'ebay', checkout: true, orderPaid: false, local: false, present: new Set(signals), ...over });

test('blocked: each hard fixture blocks the thread; no draft goes out', () => {
  for (const s of ['asks_code', 'overpay_or_shipping_label', 'payment_link', 'gift_crypto_wire']) {
    const h = hard([s]);
    assert.equal(h.action, 'block', s);
    assert.equal(h.draft, false, s);
  }
  assert.equal(hard(['claims_paid']).action, 'block');
});

test('blocked: a gift card ask is read by code from the message, with no model', () => {
  const r = codeSignals(msg('I will pay with an Apple gift card, ok?'), ctx());
  assert.equal(r.find((x) => x.signal === 'gift_crypto_wire')?.present, true);
  assert.equal(codeSignals(msg('Do you have the gift card holder in blue?'), ctx()).find((x) => x.signal === 'gift_crypto_wire')?.present, false);
  assert.equal(evaluateHard({ site: 'facebook', checkout: false, orderPaid: false, local: true, present: new Set(['gift_crypto_wire']) }).action, 'block');
});

test('claims_paid: block with checkout and no order, ask on a Facebook local deal, nothing when the order is paid', () => {
  assert.equal(hard(['claims_paid']).action, 'block');
  assert.equal(hard(['claims_paid'], { orderPaid: true }).action, 'none');
  const fb = hard(['claims_paid'], { site: 'facebook', checkout: false, local: true });
  assert.equal(fb.action, 'ask');
  assert.match(fb.reasons.join(' '), /payment app/);
});

test('locked kinds stop the agent, not the thread: off-site on checkout and an address ask', () => {
  const h = hard(['off_platform', 'asks_address_phone']);
  assert.equal(h.action, 'none');
  assert.deepEqual(h.locked.sort(), ['move_off_site', 'share_address']);
  assert.equal(h.scoreOffPlatform, true);
  const local = hard(['off_platform'], { site: 'facebook', checkout: false, local: true });
  assert.equal(local.scoreOffPlatform, true, 'off-site before meeting still scores');
  assert.deepEqual(local.locked, ['move_off_site']);
});

test('a draft that calls the item authentic is blocked', () => {
  assert.equal(evaluateHard({ site: 'poshmark', checkout: true, orderPaid: false, local: false, present: new Set(), draft: 'Yes, 100% authentic, bought at Nordstrom' }).draftBlocked, true);
  assert.equal(evaluateHard({ site: 'poshmark', checkout: true, orderPaid: false, local: false, present: new Set(), draft: 'Happy to share the receipt photo' }).draftBlocked, false);
});

test('counterfactual: a name, a language or a place in the text does not move a code signal', () => {
  const a = codeSignals(msg('Hola, soy María de Madrid. Pago con zelle, mira https://pay-now.example/x', 1), ctx());
  const b = codeSignals(msg('Hi, I am John from Ohio. Pago con zelle, mira https://pay-now.example/x', 1), ctx());
  assert.deepEqual(a.map((r) => [r.signal, r.present]), b.map((r) => [r.signal, r.present]));
});
