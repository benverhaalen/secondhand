import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shortName } from './format.ts';

test('a short name is the thing as a person says it, and fits one line at 18', () => {
  assert.equal(shortName('Carhartt Detroit Jacket J97, brown duck, L'), 'Carhartt Detroit Jacket');
  assert.equal(shortName('IKEA Stefan chair, light wood'), 'IKEA Stefan chair');
  assert.equal(shortName('Brass desk lamp with cream shade'), 'Brass desk lamp');
  assert.equal(shortName('Levi’s 501, 32x30, light wash'), 'Levi’s 501');
  assert.equal(shortName('Nintendo Switch OLED, white, with dock'), 'Nintendo Switch OLED');
  assert.equal(shortName('Carhartt canvas work pants, faded black, 38x36'), 'Carhartt canvas work pants');
  assert.equal(shortName('anything', 'Work pants'), 'Work pants');
  for (const t of ['Kindle Paperwhite 11th gen, 16 GB', 'Patagonia Retro-X fleece, cream, M']) assert.ok(shortName(t).length <= 26);
});
