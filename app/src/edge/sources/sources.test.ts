import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createLog, memorySink } from '../../../../log/index.js';
import { checkLog } from '../../../../spec/log.mjs';
import { memoryStore } from '../../engines/param/param.ts';
import { rankSources, SOURCE_PARAMS, type SiteData } from './sources.ts';
const sink = memorySink();
const log = createLog({ src: 'test.sources', build: 'test', sink });
const number = (value: number | { lo: number; hi: number }) => ({ value, state: 'shown' as const, basis_count: 20, as_of: '2026-11-15T12:00:00Z', citation_id: 'cit_test' });
const site = (name: SiteData['site'], E = 4000): SiteData => ({ site: name, connected: true, allowed: true, fit: true, health: 'ok', expected_keep: number(E), days: number({ lo: 3, hi: 7 }), P: 0.5, keep: 8000, cancel_cost: 2500 });
function rig(rows: SiteData[], explored: SiteData['site'][] = [], share = 0) {
  const params = memoryStore(); SOURCE_PARAMS.forEach(p => params.declare(p));
  return rankSources({ user_id: 'usr_1', item_id: 'it_1', category: 'apparel', exploration_share: share }, { read: async () => rows, explore: async () => explored }, params, log);
}
test('ranked by expected keep with days and basis exposed', async () => {
  const result = await rig([site('depop', 2000), site('ebay', 5000)]);
  assert.deepEqual(result.ranked.map(s => s.site), ['ebay', 'depop']);
  assert.ok(result.ranked[0].days.citation_id);
});
test('explored: a new site with a backed prior is added without replacing the mean pick', async () => {
  const result = await rig([site('ebay'), { ...site('depop', 0), P: 0, expected_keep: { ...number(0), basis_count: 0 } }], ['depop']);
  assert.deepEqual(result.chosen, ['ebay', 'depop']);
  assert.deepEqual(result.exploration, ['depop']);
  assert.deepEqual((await rig([site('ebay'), { ...site('depop', 0), P: 0 }], ['depop'], 0.2)).exploration, []);
});
test('demoted: a site down cannot be selected or explored even with highest keep', async () => {
  const result = await rig([{ ...site('depop', 9000), health: 'broken' }, site('ebay')], ['depop']);
  assert.deepEqual(result.chosen, ['ebay']);
  assert.equal(result.skipped[0].reason, 'site_down');
});
test('a site without its data is unranked; unlinked and disallowed sites cannot enter exploration', async () => {
  const result = await rig([{ ...site('depop'), expected_keep: { ...number(0), state: 'hidden', hide_reason: 'too_few' } }, { ...site('ebay'), connected: false }], ['depop', 'ebay']);
  assert.deepEqual(result.chosen, []);
  assert.deepEqual(result.ranked, []);
  assert.deepEqual(result.skipped.map(s => s.reason), ['source_gap', 'not_connected']);
});
test('invalid sale probability fails at the boundary', async () => {
  await assert.rejects(rig([{ ...site('depop'), P: 1.2 }]), /probability/);
});

after(() => { assert.deepEqual(checkLog([['sources', sink.text()]]).problems, []); });
