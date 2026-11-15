import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitImage } from './image.ts';
test('photo dimensions keep aspect ratio, cap the long side and never enlarge', () => {
  assert.deepEqual(fitImage(4000, 3000), { width: 1600, height: 1200 });
  assert.deepEqual(fitImage(1000, 4000), { width: 400, height: 1600 });
  assert.deepEqual(fitImage(320, 240), { width: 320, height: 240 });
  assert.throws(() => fitImage(0, 400), /dimensions/);
});
