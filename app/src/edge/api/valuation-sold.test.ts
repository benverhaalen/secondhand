import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { soldSources } from '../../engines/valuation/sold.ts';
import { soldSearch } from './valuation-sold.ts';

test('a valuation uses only its asking person linked Mercari account and logs a missing link', async () => {
  const { memoryVault, memoryAccounts } = await import('../browser/auth.ts');
  const { createHarness } = await import('../harness/protocol.ts');
  const { mercariAdapters } = await import('../harness/sites/mercari/adapter.ts');
  const vault = memoryVault();
  await vault.put('ref', { cookies: [], origins: [] });
  const account = { person_id: 'owner', account_id: 'acc', site: 'mercari' as const, token_ref: 'ref' };
  const accounts = memoryAccounts([account], vault);
  const recording = JSON.parse(readFileSync(new URL('../harness/sites/mercari/fixtures/search-sold.json', import.meta.url), 'utf8'));
  let reads = 0;
  const harness = createHarness({ accounts, adapters: mercariAdapters({ signed_in: true, page: async url => {
    assert.match(url, /itemStatuses=2/); reads++; return recording;
  } }) });
  const errors: string[] = [];
  const opts = { accounts, harness, live_sites: ['mercari'], fetchPage: async () => { throw new Error('no anonymous Mercari fetch'); } };
  const run = async (person_id: string, live_sites = opts.live_sites) => (await Promise.all(soldSources(soldSearch({ ...opts, person_id, live_sites }), ['mercari'], {
    query: 'carhartt hoodie', condition: 'good', error: (w, e) => errors.push(`${w}: ${String(e)}`),
  }).map(source => source(new AbortController().signal)))).flat();
  assert.deepEqual(await run('other'), []);
  assert.equal(reads, 0); assert.match(errors[0], /mercari.*needs_account/);
  const comps = await run('owner');
  assert.equal(reads, 1); assert.equal(comps.length, 5);
  assert.deepEqual(comps.filter(c => c.level === 'product').map(c => c.price_cents), [1300, 2959, 3495]);
  assert.equal(comps[0].condition, 'good'); assert.equal(comps[0].w_extract, .9); assert.equal(comps[0].size, 'S (34-36)');
  assert.deepEqual(await run('owner', []), []); assert.equal(reads, 1);
  assert.match(errors.at(-1)!, /live reads are disabled/);
});

test('Poshmark sold search uses its public page and preserves stated condition, size and listing date', async () => {
  const html = readFileSync(new URL('../harness/sites/poshmark/fixtures/search-sold.html', import.meta.url), 'utf8');
  let calls = 0;
  const sources = soldSources(soldSearch({ live_sites: ['poshmark'], fetchPage: async url => {
    calls++; assert.match(url, /availability=sold_out/);
    return { ok: true, html, status: 200, final_url: url, rung: 'plain', ms: 0, searched: [] };
  } }), ['poshmark'], { query: 'levis 501', condition: 'good', error: (_w, e) => { throw e; } });
  const comps = await sources[0](new AbortController().signal);
  assert.equal(calls, 1); assert.equal(comps.length, 3); assert.equal(comps[0].size, '29');
  assert.equal(comps[0].sold_at, '2026-11-03T11:49:50-08:00');
});

test('Poshmark explicit live state on a sold search never becomes a sold comp', async () => {
  const html = readFileSync(new URL('../harness/sites/poshmark/fixtures/search-sold.html', import.meta.url), 'utf8').replaceAll('"status":"sold_out"', '"status":"available"');
  const [source] = soldSources(soldSearch({ live_sites: ['poshmark'], fetchPage: async url =>
    ({ ok: true, html, status: 200, final_url: url, rung: 'plain', ms: 0, searched: [] }) }), ['poshmark'],
    { query: 'levis 501', condition: 'good', error: (_w, e) => { throw e; } });
  assert.deepEqual(await source(new AbortController().signal), []);
});
