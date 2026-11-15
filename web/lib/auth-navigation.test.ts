import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workspaceDestination } from './auth-navigation.ts';

test('sign-in preserves a private destination including filters and fragment', () => {
  const next = '/app/sell/item_1?tab=photos#details';
  assert.equal(workspaceDestination(next), next);
});

test('only private routes on this origin can be authentication destinations', () => {
  for (const next of [undefined, ['a'], '/application', '//other.test/app', '/app/../../signin', '/app\\..\\..\\other', 'https://other.test/app', 'javascript:alert(1)']) {
    assert.equal(workspaceDestination(next), '/app');
  }
});
