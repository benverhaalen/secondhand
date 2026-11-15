import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupe, reconcileNumber, reconcileText, sameProduct, splitByVariant, type Result } from './reconcile.ts';
import type { JevResult } from './jev.ts';

const r = (o: Partial<Result> & { id: string }): Result => ({ site: 'ebay', listing_id: o.id, title: 'levi 501 jeans 32x32', price_cents: 4000, route_id: 'com.ebay.search', url: `https://x/${o.id}`, ...o });
const target = { title: 'Levi 501 Original Fit 32x32', ids: { mpn: '00501-0114' } };

test('identifiers and the score ends settle without Jev; the band goes to Jev in batches of 20', async () => {
  const calls: number[] = [];
  const ask = async (_s: object, q: Record<string, unknown>): Promise<JevResult> => {
    calls.push(Object.keys(q).length / 2);
    const answers: Record<string, unknown> = {};
    for (const k of Object.keys(q)) answers[k] = k.startsWith('m') ? { choice: 'likely_same_model' } : { choice: 'keep' };
    return { ok: true, answers, ms: 5 };
  };
  const band = Array.from({ length: 25 }, (_, i) => r({ id: `b${i}`, pair_score: 0.7 }));
  const out = await sameProduct(target, [r({ id: 'a', ids: { mpn: '00501-0114' } }), r({ id: 'w', ids: { mpn: '505' } }), r({ id: 'hi', pair_score: 0.9 }), r({ id: 'lo', pair_score: 0.2 }), ...band], ask);
  assert.deepEqual(calls.sort((x, y) => x - y), [5, 20]);
  assert.equal(out.find(j => j.id === 'a')!.by, 'ids');
  assert.equal(out.find(j => j.id === 'w')!.keep, 'wrong_item');
  assert.equal(out.find(j => j.id === 'hi')!.match, 'likely_same_model', 'a score alone is never exact (identity.md B5)');
  assert.equal(out.find(j => j.id === 'lo')!.in_basis, false);
  assert.equal(out.filter(j => j.by === 'jev' && j.in_basis).length, 25);
});

test('an invalid Jev answer leaves the result unresolved and out of the basis', async () => {
  const ask = async (): Promise<JevResult> => ({ ok: true, answers: { m0: { choice: 'exact', probabilities: { exact: 0.9 } }, k0: { choice: 'keep' } }, ms: 5 });
  const [j] = await sameProduct(target, [r({ id: 'x', pair_score: 0.6 })], ask);
  assert.deepEqual([j!.match, j!.in_basis, j!.by], ['unresolved', false, 'default']);
  const fail = async (): Promise<JevResult> => ({ ok: false, reason: 'timeout', ms: 400 });
  const [k] = await sameProduct(target, [r({ id: 'y', pair_score: 0.6 })], fail);
  assert.equal(k!.in_basis, false);
});

test('one item crosslisted on two sites merges into one row', () => {
  const c = dedupe([
    r({ id: 'e1', site: 'ebay', phash: 'f0f0f0f0f0f0f0f0', price_cents: 4000, listed_at: '2026-11-01T00:00:00Z', seller_hash: 's1' }),
    r({ id: 'p1', site: 'poshmark', phash: 'f0f0f0f0f0f0f0f1', price_cents: 4200, listed_at: '2026-11-03T00:00:00Z', seller_hash: 's9' }),
    r({ id: 'm1', site: 'mercari', phash: '0123456789abcdef', price_cents: 3900, listed_at: '2026-11-03T00:00:00Z' }),
  ]);
  assert.equal(c.length, 2);
  assert.deepEqual(c.find(x => x.members.length === 2)!.members.map(m => m.id).sort(), ['e1', 'p1']);
});

test('a stock photo on two different items keeps them apart', () => {
  const stockHash = 'aaaaaaaaaaaaaaaa';
  const items = [r({ id: 'n1', site: 'ebay', phash: stockHash, seller_hash: 'a' }), r({ id: 'n2', site: 'mercari', phash: stockHash, seller_hash: 'b' })];
  assert.equal(dedupe(items, { retailPhashes: [stockHash] }).length, 2);
  const five = Array.from({ length: 5 }, (_, i) => r({ id: `s${i}`, site: 'ebay', phash: stockHash, seller_hash: `x${i}` }));
  assert.equal(dedupe(five).length, 5);
});

test('the same listing id within a site counts once', () => assert.equal(dedupe([r({ id: 'a', listing_id: '9' }), r({ id: 'b', listing_id: '9' })]).length, 1));

test('a numeric conflict returns one of its inputs, weighted by right_90d', () => {
  const vals = [{ value: 100, route_id: 'good', source_url: 'a' }, { value: 400, route_id: 'bad', source_url: 'b' }, { value: 110, route_id: 'good', source_url: 'c' }];
  const out = reconcileNumber(vals, { good: 0.95, bad: 0.2 });
  assert.ok([100, 110].includes(out.value!));
  assert.equal(out.kept.length, 3);
});

test('mixed types split by variant', () => assert.equal(splitByVariant([{ v: 'xl' }, { v: 's' }, { v: 'xl' }], x => x.v).size, 2));

test('a text conflict returns one of its inputs or conflict, never a new value', async () => {
  const claims = [{ value: '100% cotton', snippet: 'Material: 100% cotton', source_url: 'a' }, { value: '98% cotton', snippet: '98% cotton 2% elastane', source_url: 'b' }];
  assert.deepEqual(await reconcileText('material', claims, async () => ({ value: '99% cotton', reason: 'avg' })), { state: 'conflict', values: ['100% cotton', '98% cotton'] });
  const ok = await reconcileText('material', claims, async () => ({ value: '98% cotton', reason: 'the tag photo' }));
  assert.equal(ok.state === 'settled' && ok.value, '98% cotton');
  assert.equal((await reconcileText('material', claims, async () => { throw new Error('down'); })).state, 'conflict');
  const agree = await reconcileText('material', [claims[0]!, claims[0]!], async () => { throw new Error('not called'); });
  assert.equal(agree.state === 'settled' && agree.by, 'code');
});

const at = '2026-11-02T00:00:00Z';
test('the stock guard checks both photos of a pair, in either order', () => {
  const R = '0000000000000000', b = r({ id: 'b', site: 'mercari', phash: '00000000000000ff', listed_at: at }), a = r({ id: 'a', phash: '000000000000ffff', listed_at: at });
  assert.equal(dedupe([a, b], { retailPhashes: [R] }).length, 2);
  assert.equal(dedupe([b, a], { retailPhashes: [R] }).length, 2);
});

test('five sellers of one stock image on a site are caught even when their hashes are near but not equal', () => {
  const hs = ['0000000000000000', '00000000000001ff', '0000000000000001', '0000000000000003', '0000000000000007'];
  const items = hs.map((h, i) => r({ id: `s${i}`, listing_id: `s${i}`, phash: h, seller_hash: `x${i}`, listed_at: at }));
  assert.equal(dedupe(items).length, 5);
});

test('one person crossposting to all five sites collapses to one row', () => {
  const sites = ['ebay', 'poshmark', 'mercari', 'depop', 'facebook'];
  const items = sites.map((site, i) => r({ id: site, site, phash: 'f0f0f0f0f0f0f0f0', seller_hash: `h${i}`, listed_at: at }));
  assert.equal(dedupe(items).length, 1);
});

test('a missing listing date or a malformed hash never merges by photo, and never throws', () => {
  assert.equal(dedupe([r({ id: 'a', phash: 'f0f0f0f0f0f0f0f0' }), r({ id: 'b', site: 'mercari', phash: 'f0f0f0f0f0f0f0f0', listed_at: at })]).length, 2);
  assert.equal(dedupe([r({ id: 'a', phash: 'zz', listed_at: at }), r({ id: 'b', site: 'mercari', phash: 'zz', listed_at: at })]).length, 2);
});

test('right_90d decides the median: the trusted route wins against a majority of weak ones', () => {
  const vals = [{ value: 100, route_id: 'weak', source_url: 'a' }, { value: 105, route_id: 'weak', source_url: 'b' }, { value: 300, route_id: 'strong', source_url: 'c' }];
  assert.equal(reconcileNumber(vals, { weak: 0.1, strong: 0.95 }).value, 300);
});


for (const gtin of ['036000291452', '0036000291452', '00036000291452']) {
  test(`GTIN-14 compares the UPC with ${gtin} without an identifier clash`, async () => {
    const [judged] = await sameProduct({ title: 'same product', ids: { gtin: '036000291452' } },
      [r({ id: 'gtin', ids: { gtin } })], async () => { throw new Error('valid equivalent codes must settle without Jev'); });
    assert.deepEqual([judged.match, judged.keep, judged.by], ['exact', 'keep', 'ids']);
  });
}
