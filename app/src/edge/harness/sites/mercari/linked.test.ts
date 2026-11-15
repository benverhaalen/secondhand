import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { linkedSearch, type BrowserPage } from './linked.ts';
import { memoryAccounts, memoryVault } from '../../../browser/auth.ts';

test('Mercari linked search refuses another person and loads only the asking account', async () => {
  const vault = memoryVault();
  await vault.put('ref', { cookies: [], origins: [] });
  const accounts = memoryAccounts([{ account_id: 'acc', person_id: 'owner', site: 'mercari', token_ref: 'ref' }], vault);
  let calls = 0;
  const recording = JSON.parse(readFileSync(new URL('./fixtures/search-sold.json', import.meta.url), 'utf8'));
  const adapter = linkedSearch({ accounts, read: async (account_id, url) => {
    calls++; assert.equal(account_id, 'acc'); assert.match(url, /itemStatuses=2/); return recording;
  } });
  const signal = new AbortController().signal;
  const refused = await adapter.run({ q: 'carhartt hoodie', status: 'sold', account_id: 'acc', person_id: 'other' }, signal);
  assert.equal(refused.ok, false); assert.equal(calls, 0);
  const allowed = await adapter.run({ q: 'carhartt hoodie', status: 'sold', account_id: 'acc', person_id: 'owner' }, signal);
  assert.ok(allowed.ok); assert.equal((allowed.data as unknown[]).length, 5); assert.equal(calls, 1);
});

test('the linked browser reads the sold page own GraphQL answer', async () => {
  const { readSearchPage } = await import('./linked.ts');
  const recording = JSON.parse(readFileSync(new URL('./fixtures/search-sold.json', import.meta.url), 'utf8'));
  let closes = 0;
  const page = {
    async close() { closes++; },
    async content() { return recording.html; },
    async goto(url: string) { assert.match(url, /itemStatuses=2/); return { status: () => 200 }; },
    async waitForResponse(predicate: Parameters<BrowserPage['waitForResponse']>[0]) {
      const response = { url: () => 'https://www.mercari.com/v1/api', request: () => ({ postData: () => JSON.stringify({ operationName: 'searchFacetQuery' }) }), json: async () => recording.api[0].body };
      assert.equal(predicate({ ...response, url: () => 'https://www.mercari.com/other' }), false);
      assert.equal(predicate(response), true);
      return response;
    },
  };
  const result = await readSearchPage(page, recording.url, new AbortController().signal, { error: (_where, e) => { throw e; } });
  assert.equal(result.status, 200); assert.equal(result.api[0].op, 'searchFacetQuery');
  assert.deepEqual(result.api[0].body, recording.api[0].body); assert.equal(closes, 0);
});
