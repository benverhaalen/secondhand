import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createLog, memorySink } from '../../../../log/index.js';
import { checkLog } from '../../../../spec/log.mjs';
import { insights, type AnalyticsData } from './insights.ts';
const at = '2026-11-15T12:00:00Z';
const sink = memorySink();
const log = createLog({ src: 'test.insights', build: 'test', sink });
const data = (): AnalyticsData => ({ snapshot: { id: 'query_snapshot', source: 'own_records_query', at }, listings: [{ id: 'li_d', item_id: 'it_1', site: 'depop' }, { id: 'li_e', item_id: 'it_1', site: 'ebay' }], stats: [], sales: [] });
const run = (rows: AnalyticsData) => insights('usr_test', { read: async () => rows }, at, log);
test('flag: site stats missing are hidden, never counted as zero', async () => {
  const result = await run(data());
  assert.equal(result.funnel[0].quality, 'not_reported');
  assert.deepEqual(result.funnel[0].stages, {});
});
test('once: a cross-listed physical sale belongs only to the winning site', async () => {
  const rows = data(); const sale = { id: 'or_1', item_id: 'it_1', listing_id: 'li_d', site: 'depop', state: 'released' as const, payout_cents: 4200, at };
  rows.sales = [sale, { ...sale }];
  const result = await run(rows);
  assert.equal(result.sold_count.value, 1);
  assert.equal(result.by_site.find(s => s.site === 'depop')?.sold_count.value, 1);
  assert.equal(result.by_site.find(s => s.site === 'ebay')?.sold_count.value, 0);
  assert.ok(result.sold_count.citation_id);
});
test('funnel stays per site with reported figure beside ours and explicit quality', async () => {
  const rows = data();
  rows.stats = [{ id: 'ob_1', listing_id: 'li_d', day: '2026-11-15', stages: { likes: 3 }, definitions: { likes: 'Depop likes' }, source: 'harness', at }];
  rows.site_figures = [{ id: 'sf_1', site: 'depop', name: 'likes', value: 4, definition: 'Shop likes', at }];
  const result = await run(rows);
  const row = result.by_site.find(s => s.site === 'depop')!;
  assert.equal(row.stages.likes.value, 3);
  assert.equal(row.reported[0].value.value, 4);
  assert.equal(row.reported[0].definition, 'Shop likes');
  assert.equal(row.quality, 'reported');
  assert.equal(result.funnel[1].quality, 'not_reported');
});
test('a missing stage stays hidden in a site total and duplicate daily reads are not summed', async () => {
  const rows = data(); rows.listings.push({ id: 'li_d2', item_id: 'it_2', site: 'depop' });
  const stat = { id: 'ob_1', listing_id: 'li_d', day: '2026-11-15', stages: { likes: 3 }, definitions: { likes: 'Depop likes' }, source: 'harness', at };
  rows.stats = [stat, stat];
  const result = await run(rows);
  assert.equal(result.funnel[0].stages.likes.value, 3);
  assert.equal(result.by_site[0].stages.likes.state, 'hidden');
  assert.equal(result.by_site[0].stages.likes.hide_reason, 'source_gap');
});
test('negative counts and mismatched sale attribution fail with their cause', async () => {
  const rows = data(); rows.stats = [{ id: 'ob_bad', listing_id: 'li_d', day: '2026-11-15', stages: { likes: -1 }, definitions: { likes: 'likes' }, source: 'harness', at }];
  await assert.rejects(run(rows), /count/);
  rows.stats = []; rows.sales = [{ id: 'or_1', item_id: 'it_1', listing_id: 'li_d', site: 'ebay', state: 'released', payout_cents: 4000, at }];
  await assert.rejects(run(rows), /attribution/);
});
test('citations identify the actual sales and stat observations used by totals', async () => {
  const rows = data();
  rows.sales = [{ id: 'or_actual', item_id: 'it_1', listing_id: 'li_d', site: 'depop', state: 'released', payout_cents: 4200, at }];
  rows.stats = [{ id: 'ob_actual', listing_id: 'li_d', day: '2026-11-15', stages: { likes: 3 }, definitions: { likes: 'Depop likes' }, source: 'harness', at }];
  const result = await run(rows);
  const sold = result.citations.find(c => c.id === result.sold_count.citation_id)!;
  assert.deepEqual(sold.basis_ids, ['or_actual']);
  const likes = result.by_site[0].stages.likes;
  assert.deepEqual(result.citations.find(c => c.id === likes.citation_id)!.basis_ids, ['ob_actual']);
  const ids = result.citations.map(c => c.id);
  for (const id of new Set(ids)) assert.equal(new Set(result.citations.filter(c => c.id === id).map(c => c.metric)).size, 1);
});

after(() => { assert.deepEqual(checkLog([['insights', sink.text()]]).problems, []); });
