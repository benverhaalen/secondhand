// The search route, as the dev server bundles it alone, must load the runtime so search has its harness.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('the search route file loads the runtime, or Depop and eBay answer no_route on the dev server', () => {
  const route = readFileSync(new URL('../../app/v1/search/index+api.ts', import.meta.url), 'utf8');
  assert.match(route, /^import '@\/edge\/api\/runtime';$/m);
});
