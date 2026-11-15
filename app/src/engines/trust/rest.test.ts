// tr-4 proof: no-show, account health, recall, counterfeit (spec/engines/trust.md §2).
import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryStore } from '../param/param.ts';
import { resolve } from './params.ts';
import { declareTrust } from './signals.ts';
import { nsDecide, resolveSlot, type NsIn } from './noshow.ts';
import { flagAfterWarning, health, paceAllowed } from './health.ts';
import { buyGate, gtin14, postGate, recallDelta, RecallDeltaRejected, takedowns, type RecallRow } from './recall.ts';
import { counterfeit } from './counterfeit.ts';
import { sameProduct, type Result } from '../../edge/intel/reconcile.ts';

const store = memoryStore();
declareTrust(store);
const p = (n: string) => store.read(n, {}).value as number;
const pa = (n: string) => store.read(n, {}).value;

const ns = (o: Partial<NsIn> = {}): NsIn => ({ pastNoShows: 0, paidInApp: false, exactTimeConfirmed24h: false, vagueTime: false, newNoRatings: false, hardHaggle: false, rescheduledOnce: false, repliedConfirm30: false, ...o });

test('no-show: a vague time confirms; 2 past no-shows ask before booking; paid in app is safe', () => {
  assert.equal(nsDecide(ns({ vagueTime: true }), p).confirm, true);
  const two = nsDecide(ns({ pastNoShows: 2 }), p);
  assert.equal(two.askBeforeBooking, true);
  assert.equal(nsDecide(ns({ pastNoShows: 1, paidInApp: true }), p).confirm, false);
  assert.equal(nsDecide(ns({ pastNoShows: 1, vagueTime: true }), p, { rows: [{ id: 'appointment1', source: 'appointment', at: '2026-11-14T00:00:00Z' }], now: '2026-11-14T10:00:00Z', scope: { person: 'fixture' }, code_version: 'fixture', table_versions: [] }, resolve(store, {}).versions).shown, 'Missed 1 pickup with you. Confirm sent.');
});

test('no-show: "here" at minute 14 is not a no_show; silence for 15 minutes is; "on my way" is read first', () => {
  const slot = '2026-11-14T10:00:00Z';
  assert.equal(resolveSlot(slot, '2026-11-14T10:16:00Z', [{ who: 'buyer', kind: 'here', at: '2026-11-14T10:14:00Z' }], 15), 'met');
  assert.equal(resolveSlot(slot, '2026-11-14T10:16:00Z', [{ who: 'person', kind: 'on_my_way', at: '2026-11-14T10:05:00Z' }], 15), 'coming');
  assert.equal(resolveSlot(slot, '2026-11-14T10:16:00Z', [], 15), 'no_show');
  assert.equal(resolveSlot(slot, '2026-11-14T10:10:00Z', [], 15), 'pending');
});

test('health: flag at 0.8; one more cancel that crosses becomes ask; a site warning pauses everything; warning at 0.7 sets flag 0.63', () => {
  const m = [{ name: 'cancellations', value: 2.9, threshold: 3 }];
  assert.equal(health(m, p).flagged, true);
  assert.equal(health([{ name: 'cancellations', value: 1, threshold: 3 }], p).flagged, false);
  assert.equal(health(m, p, { next: { metric: 'cancellations', delta: 0.2 } }).action, 'ask');
  assert.equal(health(m, p, { paused: true }).action, 'block');
  assert.equal(flagAfterWarning(0.7), 0.63);
  assert.equal(paceAllowed(0.005, 0.63, pa), false);
  assert.equal(paceAllowed(0.02, 0.63, pa), false);
});

const recall = (o: Partial<RecallRow> = {}): RecallRow => ({
  RecallID: 9001, RecallDate: '2025-03-01', LastPublishDate: '2025-03-01', Title: 'Acme space heaters recalled for fire hazard',
  Description: 'Model 10AW1G-AQU2U sold January 5, 2024 through June 30, 2024. Date codes are printed on the label.',
  Products: [{ Name: 'Acme Space Heater', Model: '' }], ProductUPCs: [{ UPC: '0012345678905' }], ...o,
});

for (const upc of ['036000291452', '0036000291452', '00036000291452', '036-000 291-452']) {
  test(`GTIN: valid equivalent code ${upc} normalises to GTIN-14`, () => {
    assert.equal(gtin14(upc), '00036000291452');
  });
}

for (const [cause, upc] of [
  ['bad check digit', '036000291453'],
  ['fewer than eight digits', '0000000'],
  ['more than fourteen digits', '000036000291452'],
  ['letter inside a valid code', '036000x291452'],
  ['punctuation inside a valid code', '036000.291452'],
  ['empty code', ''],
  ['missing code', undefined],
] as const) {
  test(`GTIN: ${cause} is rejected`, () => assert.equal(gtin14(upc), null));
}

test('recall: two identical bad codes cannot make an exact code match', () => {
  const r = recall({ ProductUPCs: [{ UPC: '036000291453' }] });
  assert.equal(postGate({ id: 'bad', title: 'Plain lamp', upc: '036000291453' }, [r]).match, 'none');
});

for (const [listingCode, recallCode] of [
  ['036000291453', '036000291452'],
  ['036000291452', '036000291453'],
  ['036000291453', '036000291453'],
]) {
  test(`recall: ${listingCode} against ${recallCode} uses the missing-code fallback rules`, () => {
    const r = recall({ ProductUPCs: [{ UPC: recallCode }] });
    for (const title of ['Plain lamp', 'Acme Space Heater', 'Heater 10AW1G-AQU2U']) {
      const listing = { id: 'fallback', title, upc: listingCode };
      assert.deepEqual(postGate(listing, [r]), postGate({ ...listing, upc: undefined }, [r]), title);
    }
  });
}

for (const [left, right] of [
  ['036000291453', '036000291453'],
  ['036000291453', '036000291452'],
  ['036000291452', '036000291453'],
]) {
  test(`reconcile: ${left} against ${right} creates neither a code match nor a clash`, async () => {
    const rows: Result[] = [0.9, 0.2].map((pair_score, i) => ({
      id: `row${i}`, site: 'ebay', listing_id: `listing${i}`, title: 'Plain lamp', price_cents: 4000,
      route_id: 'fixture', url: 'https://example.test/lamp', ids: { gtin: right }, pair_score,
    }));
    const judged = await sameProduct({ title: 'Plain lamp', ids: { gtin: left } }, rows,
      async () => { throw new Error('score ends must settle without Jev'); });
    assert.deepEqual(judged.map(({ match, keep, by }) => [match, keep, by]), [
      ['likely_same_model', 'keep', 'score'], ['unresolved', 'wrong_item', 'score'],
    ]);
  });
}

test('recall: model only in Description blocks the listing; UPC leading zero blocks; GTIN-14 normalises', () => {
  assert.equal(gtin14('12345678905'), '00012345678905');
  const r = recall({ Products: [{ Name: 'Acme Space Heater' }], ProductUPCs: [] });
  assert.equal(postGate({ id: 'a', title: 'heater 10aw1g-aqu2u', upc: undefined }, [r]).allowed, false);
  assert.equal(postGate({ id: 'a', title: 'Heater', description: 'label says 10AW1G AQU2U' }, [r]).match, 'none', 'a split token is not the model');
  assert.equal(postGate({ id: 'b', title: 'Some lamp', upc: '12345678905' }, [recall()]).allowed, false);
  assert.equal(postGate({ id: 'b', title: 'Some lamp', upc: '0012345678905' }, [recall()]).allowed, false);
  assert.equal(postGate({ id: 'c', title: 'Plain lamp', upc: '99999999999999' }, [recall()]).allowed, true);
});

test('recall: a republished recall (old RecallDate, new LastPublishDate) is in the delta; 8,000 rows is rejected', () => {
  const old = recall({ RecallDate: '2020-01-01', LastPublishDate: '2026-11-14' });
  assert.equal(recallDelta([old, recall()], '2026-11-13', 500).length, 1);
  assert.throws(() => recallDelta(Array.from({ length: 8000 }, () => recall()), '2026-11-13', p('trust_recall_max_delta')), RecallDeltaRejected);
});

test('recall: a new row takes the matching live listing down in one run; others stay', () => {
  const live = [{ id: 'L1', title: 'Heater', description: 'model 10AW1G-AQU2U' }, { id: 'L2', title: 'Chair' }];
  assert.deepEqual(takedowns(live, [recall()]), { down: ['L1'], hold: [] });
});

test('recall: a name-only match holds; one tap never clears it; the identifier confirmation does and is stored as the reason', () => {
  const l = { id: 'n', title: 'Acme Space Heater used' };
  const g = postGate(l, [recall({ Description: 'Sold in 2024.' })]);
  assert.equal(g.match, 'name');
  assert.equal(g.allowed, false);
  assert.equal(g.hold, true);
  const wrong = postGate(l, [recall({ Description: 'Sold in 2024.' })], { identifier_differs: true, recall_id: 'other', reason: 'x', at: 't' });
  assert.equal(wrong.allowed, false);
  const ok = postGate(l, [recall({ Description: 'Sold in 2024.' })], { identifier_differs: true, recall_id: '9001', reason: 'Model on my label is 22X, recall lists 10AW', at: '2026-11-14T10:00:00Z' });
  assert.equal(ok.allowed, true);
  assert.match(ok.reason, /Model on my label/);
});

test('recall: an exact match is never cleared by a confirmation; the buy side drafts no offer and shows the notice', () => {
  const l = { id: 'x', title: 'Heater 10AW1G-AQU2U' };
  assert.equal(postGate(l, [recall()], { identifier_differs: true, recall_id: '9001', reason: 'trust me', at: 't' }).allowed, false);
  const b = buyGate(l, [recall()]);
  assert.equal(b.draftOffer, false);
  assert.match(b.notice ?? '', /Recalled/);
  assert.equal(buyGate({ id: 'y', title: 'Chair' }, [recall()]).draftOffer, true);
});

test('counterfeit: missing proof asks, unsupported numbers and site floors hide, cheap stock from a young seller asks', () => {
  const base = { proofPhoto: true, site: 'other' as const, shoes: false, stockPhoto: false, price_cents: 30000, q50_cents: 31000 };
  assert.equal(counterfeit({ ...base, brand: 'Gucci', proofPhoto: false }, pa).action, 'ask');
  const cheap = counterfeit({ ...base, brand: 'Gucci', price_cents: 12000 }, pa);
  assert.equal(cheap.action, 'warn');
  assert.equal(cheap.price, null);
  assert.match(cheap.reasons.join(' '), /below comparable/);
  assert.equal(counterfeit({ ...base, site: 'poshmark', price_cents: 50000, brand: 'Coach' }, pa).action, 'none');
  assert.equal(counterfeit({ ...base, site: 'ebay', shoes: true, price_cents: 7500 }, pa).action, 'none');
  assert.equal(counterfeit({ ...base, brand: 'Gucci', price_cents: 12000, stockPhoto: true, buy: true, sellerAgeDays: 10 }, pa).action, 'ask');
  assert.equal(counterfeit({ ...base, brand: 'Gucci', price_cents: 12000, stockPhoto: true, buy: true, sellerAgeDays: 400 }, pa).action, 'warn');
  assert.equal(counterfeit(base, pa).action, 'none');
});
