import assert from 'node:assert/strict';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { test } from 'node:test';
import { sha256Hex } from './sha256.ts';

for (const value of ['', 'abc', 'a'.repeat(1000), 'Hello 🌍! Café, naïve, résumé 🦊']) {
  test(`SHA-256 matches Node for ${JSON.stringify(value.slice(0, 40))}`, () => {
    assert.equal(sha256Hex(value), createHash('sha256').update(value).digest('hex'));
  });
}

test('SHA-256 matches Node for 200 random UTF-16 strings', () => {
  for (let i = 0; i < 200; i++) {
    const bytes = randomBytes(randomInt(1025) * 2);
    const value = bytes.toString('utf16le');
    assert.equal(sha256Hex(value), createHash('sha256').update(value).digest('hex'), JSON.stringify(value));
  }
});
