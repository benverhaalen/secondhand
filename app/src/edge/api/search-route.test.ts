// The search route alone (as the dev server bundles it) must compose the runtime's search ports.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ports } from './search.ts';

test('importing the search handlers alone gives search the runtime harness and accounts, so harness sources are routed', () => {
  assert.ok(ports.harness, 'no harness: the route bundle never loaded runtime.ts, and Depop and eBay answer no_route');
  assert.ok(ports.accounts);
});
