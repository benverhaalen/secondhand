import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVisitor } from './visitor.ts';

test('visitor id persists and matches the API visitor format', () => {
  const map = new Map<string, string>();
  const storage = { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); } };
  const first = createVisitor(() => storage);
  const id = first();
  assert.match(id, /^vis_[a-z0-9]{8,64}$/);
  assert.equal(createVisitor(() => storage)(), id);
});
test('blocked storage falls back to one in-memory id and reports the failure', () => {
  const errors: unknown[] = [];
  const get = createVisitor(() => { throw new Error('Storage blocked'); }, e => errors.push(e));
  assert.equal(get(), get());
  assert.equal(errors.length, 1);
});
test('the id the server returns replaces the one the page made, and is kept', () => {
  const map = new Map<string, string>();
  const storage = { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); } };
  const get = createVisitor(() => storage);
  get();
  const signed = 'vis_abc123def456' + '0123456789abcdef0123';
  assert.equal(get(signed), signed);
  assert.equal(get(), signed);
  assert.equal(createVisitor(() => storage)(), signed);
  assert.equal(get('not-a-visitor'), signed);
});
