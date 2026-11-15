import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { StorageState } from '../browser/auth.ts';
import { sqliteVault } from './vault.ts';

function fixture(t: TestContext) {
  const dir = mkdtempSync(join(tmpdir(), 'secondhand-vault-'));
  const path = join(dir, 'secondhand.db'), handles: DatabaseSync[] = [];
  t.after(() => { for (const handle of handles) handle.close(); rmSync(dir, { recursive: true, force: true }); });
  const open = () => { const handle = new DatabaseSync(path); handles.push(handle); return handle; };
  return { path, open, key: randomBytes(32) };
}
const state = (value = 'synthetic-session'): StorageState => ({ cookies: [], origins: [{ origin: 'https://example.test', localStorage: [{ name: 'session', value }] }] });

test('restart retains a session and a different key fails authentication naming only its ref', async t => {
  const f = fixture(t), first = sqliteVault(f.open(), f.key), ref = 'account/restart';
  const saved = state();
  await first.put(ref, saved);
  const reopened = f.open();
  assert.deepEqual(await sqliteVault(reopened, f.key).get(ref), saved);
  await assert.rejects(sqliteVault(reopened, randomBytes(32)).get(ref), (error: Error) => {
    assert.ok(error.message.includes(ref));
    assert.ok(!error.message.includes(saved.origins[0].localStorage[0].value));
    return true;
  });
});

test('encrypted database bytes contain no plaintext session marker and every write uses a fresh 12-byte IV', async t => {
  const f = fixture(t), db = f.open(), vault = sqliteVault(db, f.key);
  const marker = `synthetic-${randomBytes(32).toString('hex')}`;
  await vault.put('account/secret', state(marker));
  const first = db.prepare('SELECT iv, tag, data FROM vault WHERE ref = ?').get('account/secret')!;
  assert.equal((first.iv as Uint8Array).length, 12);
  assert.equal((first.tag as Uint8Array).length, 16);
  assert.ok(!readFileSync(f.path).includes(Buffer.from(marker)));
  await vault.put('account/secret', state(marker));
  const second = db.prepare('SELECT iv, data FROM vault WHERE ref = ?').get('account/secret')!;
  assert.notDeepEqual(second.iv, first.iv);
  assert.notDeepEqual(second.data, first.data);
  assert.ok(!readFileSync(f.path).includes(Buffer.from(marker)));
});

test('ciphertext copied to another ref fails authentication because the ref is AAD', async t => {
  const f = fixture(t), db = f.open(), vault = sqliteVault(db, f.key);
  await vault.put('account/original', state());
  db.prepare('INSERT INTO vault (ref, version, iv, tag, data) SELECT ?, version, iv, tag, data FROM vault WHERE ref = ?').run('account/copied', 'account/original');
  await assert.rejects(vault.get('account/copied'), /account\/copied/);
  await assert.rejects(vault.snapshot('account/copied'), /account\/copied/);
});

test('get and snapshot return fresh copies and input mutations cannot change a session', async t => {
  const f = fixture(t), vault = sqliteVault(f.open(), f.key), input = state();
  assert.deepEqual(await vault.snapshot('account/copies'), { state: undefined, version: 0 });
  await vault.put('account/copies', input);
  input.origins.length = 0;
  const got = (await vault.get('account/copies'))!;
  got.origins.length = 0;
  const snapshot = await vault.snapshot('account/copies');
  assert.deepEqual(snapshot, { state: state(), version: 1 });
  snapshot.state!.origins.length = 0;
  assert.deepEqual(await vault.get('account/copies'), state());
});

test('stale compareAndPut writes nothing and delete retains a version that rejects pre-delete writes', async t => {
  const f = fixture(t), db = f.open(), vault = sqliteVault(db, f.key), ref = 'account/version';
  assert.equal(await vault.compareAndPut(ref, 0, state('first')), 1);
  assert.equal(await vault.compareAndPut(ref, 1, state('second')), 2);
  const before = db.prepare('SELECT * FROM vault WHERE ref = ?').get(ref);
  assert.equal(await vault.compareAndPut(ref, 1, state('stale')), undefined);
  assert.deepEqual(db.prepare('SELECT * FROM vault WHERE ref = ?').get(ref), before);
  await vault.delete(ref);
  assert.deepEqual(await vault.snapshot(ref), { state: undefined, version: 3 });
  assert.equal(db.prepare('SELECT data FROM vault WHERE ref = ?').get(ref)?.data, null);
  assert.equal(await vault.compareAndPut(ref, 2, state('resurrected')), undefined);
  await vault.delete(ref);
  assert.deepEqual(await vault.snapshot(ref), { state: undefined, version: 4 });
  await vault.delete('account/never-written');
  assert.equal(await vault.compareAndPut('account/never-written', 0, state()), undefined);
});

test('two database handles share versions so only one compareAndPut at the same version wins', async t => {
  const f = fixture(t), a = sqliteVault(f.open(), f.key), b = sqliteVault(f.open(), f.key);
  const results = await Promise.all([a.compareAndPut('account/shared', 0, state('winner')), b.compareAndPut('account/shared', 0, state('loser'))]);
  assert.deepEqual(results, [1, undefined]);
  assert.deepEqual(await b.get('account/shared'), state('winner'));
  await b.delete('account/shared');
  assert.deepEqual(await a.snapshot('account/shared'), { state: undefined, version: 2 });
});

test('invalid AES key length is rejected before a vault is used', t => {
  const f = fixture(t), db = f.open();
  for (const length of [0, 16, 31, 33]) assert.throws(() => sqliteVault(db, randomBytes(length)), /32/);
});
