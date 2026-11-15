// node --test research/list/ben/levers/interest.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { band, rates, pull, strongest, stageOf } from './interest.mjs';

test('every signal id used here has a stage in levers.json', () => {
  for (const [site, sig] of [['ebay', 'watchers'], ['depop', 'likes'], ['depop', 'bag'], ['poshmark', 'likes'], ['mercari', 'views'], ['facebook', 'saves']])
    assert.ok(stageOf(site, sig), `${site} ${sig}`);
  assert.equal(stageOf('mercari', 'views'), 'exposure', 'Mercari "views" are impressions, not page views');
});

test('band compares with listings like it, and says nothing on a thin reference', () => {
  const ref = { n: 80, p25: 3, p75: 9 };
  assert.equal(band(12, ref), 'ahead');
  assert.equal(band(5, ref), 'on');
  assert.equal(band(1, ref), 'behind');
  assert.equal(band(12, { ...ref, n: 20 }), null);
});

const sold = (site, counts) => ({ site, counts, sold: true });
const unsold = (site, counts) => ({ site, counts, sold: false });
const history = [
  ...Array.from({ length: 5 }, () => sold('depop', { likes: 12, bag: 2 })),
  ...Array.from({ length: 5 }, () => unsold('depop', { likes: 10, bag: 0 })),
  ...Array.from({ length: 6 }, () => sold('ebay', { watchers: 3, views: 60 })),
  ...Array.from({ length: 2 }, () => sold('mercari', { likes: 4 })),
];

test('rates: signals per sale, per site, only once enough sales back it', () => {
  const r = rates(history);
  assert.equal(r.depop.likes, 22, '110 likes over 5 sales');
  assert.equal(r.depop.bag, 2);
  assert.equal(r.ebay.watchers, 3);
  assert.equal(r.mercari, undefined, '2 sales are too few');
});

test('pull: 11 Depop likes and 3 eBay watchers are not 14 of anything', () => {
  const r = rates(history);
  const p = pull({ depop: { likes: 11, bag: 1 }, ebay: { watchers: 3, views: 30 }, mercari: { likes: 9 } }, r);
  assert.equal(p.sites.depop.pull, 0.5, 'half a sale either way; the max, not the sum, within a site');
  assert.equal(p.sites.ebay.pull, 1);
  assert.equal(p.sites.mercari.pull, null, 'no rate yet: shown raw, left out');
  assert.equal(p.total, 1.5);
});

test('pull is null, not zero, when no site has a rate', () => {
  assert.equal(pull({ facebook: { saves: 4 } }, {}).total, null);
});

test('strongest: an offer outranks any number of views', () => {
  assert.deepEqual(strongest('ebay', { views: 400, watchers: 6, offers: 1 }), { signal: 'offers', stage: 'intent', count: 1 });
  assert.deepEqual(strongest('poshmark', { impressions: 900, likes: 4 }), { signal: 'likes', stage: 'interest', count: 4 });
});
