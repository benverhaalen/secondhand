import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import { dataPath, openDb, migrate, tx, db } from './db.ts';
import { memorySink, observeLogs } from '../../../../log/index.js';

function fixture(t: TestContext) {
  const dir = mkdtempSync(join(tmpdir(), 'secondhand-db-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return join(dir, 'nested', 'secondhand.db');
}

test('transactions emit no timing lines and log a synchronous failure once', t => {
  const handle = new DatabaseSync(':memory:');
  const sink = memorySink(), stop = observeLogs(sink);
  t.after(() => { stop(); handle.close(); });
  assert.equal(tx(handle, () => 42), 42);
  assert.deepEqual(sink.lines, [], 'successful transactions must not flood the log');
  assert.throws(() => tx(handle, () => { throw new Error('synthetic transaction failure'); }), /synthetic transaction failure/);
  const entries: Record<string, unknown>[] = sink.lines.map(line => JSON.parse(line));
  assert.equal(entries.length, 1, 'failed transactions must log once');
  assert.equal(entries[0].event, 'error');
  assert.equal(entries[0].where, 'sqlite.tx');
});

test('dataPath chooses the explicit folder, test memory, development temp, and refuses unset production', () => {
  assert.equal(dataPath({ SECONDHAND_DATA_DIR: '/data', NODE_TEST_CONTEXT: 'child-v8', NODE_ENV: 'production' }), join('/data', 'secondhand.db'));
  assert.equal(dataPath({ NODE_TEST_CONTEXT: 'child-v8', NODE_ENV: 'production' }), ':memory:');
  assert.equal(dataPath({}), join(tmpdir(), 'secondhand-dev', 'secondhand.db'));
  assert.throws(() => dataPath({ NODE_ENV: 'production' }), /^Error: SECONDHAND_DATA_DIR is required in production$/);
  assert.equal(db(), openDb(dataPath()));
});

test('openDb creates missing folders and shares configured handles across module copies, including memory', async t => {
  const path = fixture(t), first = openDb(path);
  t.after(() => first.close());
  const copy: typeof import('./db.ts') = await import(new URL('./db.ts?cache-copy', import.meta.url).href);
  assert.equal(copy.openDb(path), first);
  assert.equal(copy.openDb(':memory:'), openDb(':memory:'));
  assert.equal(first.prepare('PRAGMA journal_mode').get()?.journal_mode, 'wal');
  assert.equal(first.prepare('PRAGMA busy_timeout').get()?.timeout, 5000);
  assert.equal(first.prepare('PRAGMA synchronous').get()?.synchronous, 1);
  assert.equal(first.prepare('PRAGMA foreign_keys').get()?.foreign_keys, 1);
});

test('migrate records names once across handles and rolls back failed schema changes', t => {
  const path = fixture(t), first = openDb(path), second = new DatabaseSync(path);
  t.after(() => { first.close(); second.close(); });
  migrate(first, 'one', 'CREATE TABLE example (id TEXT); INSERT INTO example VALUES (\'first\');');
  migrate(second, 'one', 'INSERT INTO example VALUES (\'duplicate\');');
  assert.equal(second.prepare('SELECT count(*) AS n FROM example').get()?.n, 1);
  assert.equal(typeof second.prepare('SELECT at FROM migrations WHERE name = ?').get('one')?.at, 'string');
  assert.throws(() => migrate(first, 'broken', 'CREATE TABLE undone (id TEXT); INSERT INTO missing VALUES (1);'));
  assert.equal(second.prepare("SELECT name FROM sqlite_master WHERE name = 'undone'").get(), undefined);
  assert.equal(second.prepare("SELECT name FROM migrations WHERE name = 'broken'").get(), undefined);
  migrate(second, 'broken', 'CREATE TABLE undone (id TEXT);');
});

test('tx rolls back all writes on an outer throw, including a nested commit from another module copy', async t => {
  const handle = new DatabaseSync(':memory:');
  t.after(() => handle.close());
  handle.exec('CREATE TABLE example (id TEXT)');
  const copy: typeof import('./db.ts') = await import(new URL('./db.ts?tx-copy', import.meta.url).href);
  assert.throws(() => tx(handle, () => {
    handle.prepare('INSERT INTO example VALUES (?)').run('outer');
    copy.tx(handle, () => handle.prepare('INSERT INTO example VALUES (?)').run('inner'));
    throw new Error('abort outer');
  }), /abort outer/);
  assert.deepEqual(handle.prepare('SELECT * FROM example').all(), []);
  const result = tx(handle, () => {
    handle.prepare('INSERT INTO example VALUES (?)').run('kept');
    assert.throws(() => copy.tx(handle, () => {
      handle.prepare('INSERT INTO example VALUES (?)').run('discarded');
      throw new Error('abort inner');
    }), /abort inner/);
    return 42;
  });
  assert.equal(result, 42);
  assert.deepEqual(handle.prepare('SELECT id FROM example').all().map(row => row.id), ['kept']);
});

test('tx refuses a Promise result and rolls back its synchronous writes', t => {
  const handle = new DatabaseSync(':memory:');
  t.after(() => handle.close());
  handle.exec('CREATE TABLE example (id TEXT)');
  assert.throws(() => tx(handle, () => {
    handle.exec("INSERT INTO example VALUES ('discarded')");
    return Promise.resolve('async');
  }), /synchronous|Promise/);
  assert.deepEqual(handle.prepare('SELECT * FROM example').all(), []);
  tx(handle, () => handle.exec("INSERT INTO example VALUES ('kept')"));
  assert.equal(handle.prepare('SELECT count(*) AS n FROM example').get()?.n, 1);
});

test('a rejected Promise callback cannot terminate the process after tx refuses it synchronously', () => {
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { DatabaseSync } from 'node:sqlite';
    const { tx } = await import(process.argv[1]);
    const handle = new DatabaseSync(':memory:');
    handle.exec('CREATE TABLE example (id TEXT)');
    assert.throws(() => tx(handle, async () => {
      handle.exec("INSERT INTO example VALUES ('discarded')");
      throw new Error('synthetic async callback failure');
    }), /synchronous|Promise/);
    assert.equal(handle.prepare('SELECT count(*) AS n FROM example').get().n, 0);
    setImmediate(() => handle.close());
  `, new URL('./db.ts', import.meta.url).href], { encoding: 'utf8', timeout: 10000 });
  assert.equal(child.status, 0, child.stderr);
});
