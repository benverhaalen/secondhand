import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { kv } from './kv.ts';

function fixture(t: TestContext) {
  const dir = mkdtempSync(join(tmpdir(), 'secondhand-kv-'));
  const path = join(dir, 'secondhand.db');
  const a = new DatabaseSync(path), b = new DatabaseSync(path);
  t.after(() => { a.close(); b.close(); rmSync(dir, { recursive: true, force: true }); });
  let time = 1000;
  return { a: kv(a, () => time), b: kv(b, () => time), advance: (ms: number) => { time += ms; } };
}

test('kv TTL expiry is visible across handles at the boundary and permanent keys survive sweep', t => {
  const { a, b, advance } = fixture(t);
  a.set('sessions', 'key', { count: 1 }, 50);
  a.set('signing', 'key', 'synthetic');
  assert.deepEqual(b.get('sessions', 'key'), { count: 1 });
  advance(49);
  assert.deepEqual(b.get('sessions', 'key'), { count: 1 });
  advance(1);
  assert.equal(b.get('sessions', 'key'), undefined);
  assert.equal(b.take('sessions', 'key'), undefined);
  a.set('limits', 'expired', 1, 0);
  assert.equal(b.sweep(), 1);
  assert.equal(a.get('signing', 'key'), 'synthetic');
  a.set('limits', 'later', 2, 100);
  assert.equal(a.sweep(1150), 1);
  b.delete('signing', 'key');
  assert.equal(a.get('signing', 'key'), undefined);
});

test('kv take reads and deletes once across handles while namespaces remain separate', t => {
  const { a, b } = fixture(t);
  a.set('sessions', 'same', { value: ['synthetic'] });
  a.set('idempotency', 'same', null);
  assert.deepEqual(b.take('sessions', 'same'), { value: ['synthetic'] });
  assert.equal(a.take('sessions', 'same'), undefined);
  assert.equal(a.get('idempotency', 'same'), null);
});

test('kv add refuses a live key across handles and accepts an expired key', t => {
  const { a, b, advance } = fixture(t);
  assert.equal(a.add('slots', 'one', 'first'), true);
  assert.equal(b.add('slots', 'one', 'second'), false);
  assert.equal(b.get('slots', 'one'), 'first');
  a.set('slots', 'one', 'temporary', 10);
  advance(10);
  assert.equal(b.add('slots', 'one', 'replacement'), true);
  advance(100);
  assert.equal(a.get('slots', 'one'), 'replacement');
});

test('kv incr uses one fixed window from the first hit across handles and resets at expiry', t => {
  const { a, b, advance } = fixture(t);
  assert.equal(a.incr('limits', 'one', 100), 1);
  advance(60);
  assert.equal(b.incr('limits', 'one', 100), 2);
  advance(39);
  assert.equal(a.incr('limits', 'one', 100), 3);
  advance(1);
  assert.equal(b.incr('limits', 'one', 100), 1);
  assert.equal(a.get('limits', 'one'), 1);
  assert.equal(a.incr('limits', 'two', 100), 1);
});

test('kv set replaces an old TTL and serialization errors preserve the saved value', t => {
  const { a, b, advance } = fixture(t);
  a.set('slots', 'one', 'first', 10);
  b.set('slots', 'one', 'permanent');
  advance(20);
  assert.equal(a.get('slots', 'one'), 'permanent');
  assert.throws(() => b.set('slots', 'one', 1n));
  assert.throws(() => b.set('slots', 'one', undefined));
  assert.equal(a.get('slots', 'one'), 'permanent');
});
