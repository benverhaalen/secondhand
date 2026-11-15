import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appleNonce } from './apple-nonce.ts';

test('Apple is given the SHA-256 hex the API will compute from the nonce it receives', async () => {
  const first = await appleNonce(), second = await appleNonce();
  assert.equal(first.hashed, createHash('sha256').update(first.nonce).digest('hex'));
  assert.notEqual(first.nonce, second.nonce);
});
