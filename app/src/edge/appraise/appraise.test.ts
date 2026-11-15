import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createLog, memorySink } from '../../../../log/index.js';
import { checkLog } from '../../../../spec/log.mjs';
import { answer } from '../../engines/proof/proof.ts';
import { appraiseOwned, type AppraisePort, type ValuationCheck } from './appraise.ts';
const at = '2026-11-15T12:00:00Z';
const sink = memorySink();
const log = createLog({ src: 'test.appraise', build: 'test', sink });
function band(low = 3000, high = 5000) { return answer({ lo: low, hi: high }, [{ id: 'comp_family', source: 'category_sales', at }], { metric: 'fair_value', filters: {}, table_versions: [], definition_version: 'D5', code_version: 'test', param_versions: {}, model_version: null }, at); }
const checked = (): ValuationCheck => ({ item_id: 'it_1', per_site: [{ site: 'depop', band: band(), level: 1, comps: ['co_1'], state: 'checked' }], recall: 'clear' });
function rig(check = checked(), states = ['owned']) {
  const calls: string[] = [];
  const port: AppraisePort = { items: async () => states.map((state, i) => ({ id: `it_${i + 1}`, user_id: 'usr_1', state })), check: async item => { calls.push(item.id); return { ...check, item_id: item.id }; } };
  return { calls, run: () => appraiseOwned('usr_1', port, log) };
}
test('each held item has its site band, basis and citation from valuation', async () => {
  const result = await rig().run(); const row = result.items[0].per_site[0];
  assert.equal(row.band.ok, true);
  if (row.band.ok) { assert.deepEqual(row.band.value, { lo: 3000, hi: 5000 }); assert.ok(row.band.citation.id); assert.equal(row.band.basis.count, 1); }
});
test('wide band: no comps uses an evidenced family or category fallback without calling it checked', async () => {
  const c = checked(); c.per_site = [{ site: 'depop', band: band(1000, 9000), level: 3, comps: [], state: 'rough' }];
  const result = await rig(c).run();
  assert.equal(result.items[0].per_site[0].state, 'wide');
  assert.equal(result.items[0].per_site[0].level, 3);
});
test('removed: sold and completed items are not appraised or counted as held', async () => {
  const r = rig(checked(), ['owned', 'sold', 'handed_over', 'done', 'live']);
  assert.deepEqual((await r.run()).items.map(i => i.item_id), ['it_1', 'it_5']);
  assert.deepEqual(r.calls, ['it_1', 'it_5']);
});
test('no comps and no fallback yields a hidden source gap with no invented band', async () => {
  const c = checked(); c.per_site[0].band = { ok: false, refused: 'no_basis' }; c.per_site[0].comps = [];
  const result = await rig(c).run();
  assert.equal(result.items[0].per_site[0].state, 'hidden');
  assert.equal(result.items[0].per_site[0].hide_reason, 'source_gap');
});
test('foreign item, mismatched valuation and invalid band are refused', async () => {
  const port: AppraisePort = { items: async () => [{ id: 'it_1', user_id: 'usr_other', state: 'owned' }], check: async () => checked() };
  await assert.rejects(appraiseOwned('usr_1', port, log), /tenant/);
  const c = checked(); c.per_site[0].band = band(5000, 1000);
  await assert.rejects(rig(c).run(), /band/);
});

after(() => { assert.deepEqual(checkLog([['appraise', sink.text()]]).problems, []); });
