import assert from 'node:assert/strict';
import { test } from 'node:test';
import { outcomeStore } from './outcome.ts';

const read = { conversation_id: 'c1', item_id: 'i1', site: 'ebay', offer_cents: 6200, ask_cents: 8000, at: 1_000_000, round: 1,
  buyer_name: 'Pat', buyer_ref_hash: 'abc' };

test('the same offer read twice gives one row, and no buyer identity in it', () => {
  const s = outcomeStore();
  s.fromOffer(read);
  s.fromOffer({ ...read });
  const rows = s.rows();
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], { conversation_id: 'c1', item_id: 'i1', site: 'ebay', round: 1, side: 'sell', offer: 6200, ask: 8000, counter: null, response: null, final_price: null, ms_to_response: null });
  assert.doesNotMatch(JSON.stringify(rows), /Pat|abc|buyer/);
});

test('every offer and reply is recorded; ms_to_response is computed', () => {
  const s = outcomeStore();
  s.fromOffer(read);
  s.fromOffer({ ...read, conversation_id: 'c2', at: 5 });
  s.fromReply({ conversation_id: 'c1', round: 1, response: 'countered', counter_cents: 6800, at: 1_004_500 });
  s.fromReply({ conversation_id: 'c2', round: 1, response: 'accepted', at: 905 });
  const [a, b] = s.rows();
  assert.equal(s.rows().length, 2);
  assert.deepEqual([a.response, a.counter, a.final_price, a.ms_to_response], ['countered', 6800, null, 4500]);
  assert.deepEqual([b.response, b.counter, b.final_price, b.ms_to_response], ['accepted', null, 6200, 900]);
});

test('a reply with an unknown outcome is reconciled later, not duplicated', () => {
  const s = outcomeStore();
  s.fromOffer(read);
  s.fromReply({ conversation_id: 'c1', round: 1, outcome_unknown: true, at: 1_002_000 });
  assert.equal(s.rows()[0].response, null);
  s.reconcile('c1', 1, { response: 'declined', at: 1_002_000 });
  assert.equal(s.rows().length, 1);
  assert.deepEqual([s.rows()[0].response, s.rows()[0].ms_to_response], ['declined', 2000]);
});

test('a round answers once: the same response again is fine, a different one throws', () => {
  const s = outcomeStore();
  s.fromOffer(read);
  s.fromReply({ conversation_id: 'c1', round: 1, response: 'declined', at: 1_000_100 });
  s.fromReply({ conversation_id: 'c1', round: 1, response: 'declined', at: 1_000_100 });
  assert.throws(() => s.fromReply({ conversation_id: 'c1', round: 1, response: 'accepted', at: 1_000_200 }));
  assert.throws(() => s.reconcile('c1', 1, { response: 'expired' }));
  assert.equal(s.rows().length, 1);
});

test('a reply or reconcile for an offer never read throws; an overruled flag is kept', () => {
  const s = outcomeStore();
  assert.throws(() => s.fromReply({ conversation_id: 'zz', round: 1, response: 'declined', at: 1 }));
  assert.throws(() => s.reconcile('zz', 1, { response: 'declined' }));
  s.fromOffer(read);
  s.fromReply({ conversation_id: 'c1', round: 1, response: 'countered', counter_cents: 7000, at: 1_000_050, overruled: true });
  assert.equal(s.rows()[0].overruled, true);
});

test('a buyer taking our counter: the final price is the counter, not the offer', () => {
  const s = outcomeStore();
  s.fromOffer(read);
  s.fromReply({ conversation_id: 'c1', round: 1, response: 'accepted', counter_cents: 6800, at: 1_001_000 });
  assert.equal(s.rows()[0].final_price, 6800);
});

test('audit: invalid outcome money refuses atomically', () => {
  for (const value of [NaN, Infinity, -1, 1.5]) {
    const s = outcomeStore(); s.fromOffer(read);
    assert.throws(() => s.fromReply({ conversation_id: 'c1', round: 1, response: 'accepted', final_price_cents: value, at: read.at }), /final_price_cents/);
    assert.equal(s.rows()[0].response, null);
    assert.throws(() => s.reconcile('c1', 1, { response: 'countered', counter_cents: value }), /counter_cents/);
    assert.throws(() => s.fromOffer({ ...read, conversation_id: 'bad', offer_cents: value }), /offer_cents/);
  }
});
test('audit: omitted round cannot settle the first of multiple rounds', () => {
  const s = outcomeStore(); s.fromOffer(read); s.fromOffer({ ...read, round: 2 });
  assert.throws(() => s.fromReply({ conversation_id: 'c1', response: 'accepted', at: read.at }), /round/);
});
