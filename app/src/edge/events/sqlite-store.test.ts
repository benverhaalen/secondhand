import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import { openDb } from '../store/db.ts';
import { sqliteStore } from './sqlite-store.ts';
import { memoryStore, TABLES, type JobRow, type StoreState } from './ports.ts';

const ev = { user_id: 'u1', source: 'app', action: 'app.list', dedupe_key: 'k1', actor: 'user', observed_at: 'x', effective_at: 'x', trace_id: 't' } as const;
const job: Omit<JobRow, 'id'> = { kind: 'post', user_id: 'u1', event_id: 'e', idempotency_key: 'k1', args: {}, state: 'queued', stages: [], attempts: 0, trace_id: 't', created_at: 'x' };
const decision = { user_id: 'u1', kind: 'first_post', subject: 'it_1', why: 'approval', options: [] };
const operation = { id: 'op_1', user_id: 'u1', site: 'ebay', verb: 'post', data: 'synthetic', at: '2026-11-15T00:00:00Z' } as const;

function fixture(t: TestContext) {
  const dir = mkdtempSync(join(tmpdir(), 'secondhand-sqlite-'));
  const path = join(dir, 'secondhand.db'), handles: DatabaseSync[] = [];
  t.after(() => { for (const handle of handles) handle.close(); rmSync(dir, { recursive: true, force: true }); });
  const connect = () => { const handle = new DatabaseSync(path); handles.push(handle); return handle; };
  return { path, connect, reopen: () => sqliteStore(connect()) };
}

test('late search stages survive insertion, updates and getJob after reopening', t => {
  const { reopen } = fixture(t), s = reopen();
  const stages = [{ name: 'site:ebay', state: 'late' }] as unknown as JobRow['stages'];
  const inserted = s.insertJob({ ...job, stages }).row;
  assert.deepEqual(reopen().getJob(inserted.id), inserted);
  const updated = s.updateJob(inserted.id, { attempts: 1, stages });
  assert.deepEqual(reopen().getJob(inserted.id), updated);
});

test('job stage validation refuses a missing name or a non-string state', t => {
  const { reopen, connect } = fixture(t), s = reopen(), handle = connect();
  const inserted = s.insertJob(job).row;
  for (const stage of [{ state: 'late' }, { name: 'site:ebay', state: 1 }]) {
    handle.prepare('UPDATE jobs SET body = ? WHERE id = ?').run(JSON.stringify({ ...inserted, stages: [stage] }), inserted.id);
    assert.throws(() => reopen().getJob(inserted.id), /Cannot load Store jobs/);
  }
});

test('dump returns every tenant and table in insertion order as independent plain copies', t => {
  const { reopen } = fixture(t), s = reopen();
  const expected: StoreState = { events: [], jobs: [], decisions: [], rows: Object.fromEntries(TABLES.map(table => [table, []])) };
  assert.deepEqual(s.dump(), expected);
  for (const user_id of ['u2', 'u1']) {
    expected.events.push(s.insertEvent({ ...ev, user_id }).row);
    expected.jobs.push(s.insertJob({ ...job, user_id, args: { nested: { value: 1 } } }).row);
    expected.decisions.push(s.raiseDecision({ ...decision, user_id }).row);
    for (const table of TABLES) expected.rows[table]!.push(s.put(table, { id: user_id, user_id, nested: { value: 1 } }));
  }
  expected.jobs[0] = s.updateJob(expected.jobs[0].id, { attempts: 1 });
  expected.decisions[0] = s.updateDecision(expected.decisions[0].id, { state: 'answered' });
  expected.rows.item![0] = s.put('item', { ...expected.rows.item![0], state: 'live' });
  const loaded = reopen(), dumped = loaded.dump();
  assert.deepEqual(dumped, expected);
  assert.equal(Object.getPrototypeOf(dumped.jobs[0]), Object.prototype);
  dumped.events[0].why = 'changed';
  (dumped.jobs[0].args.nested as { value: number }).value = 2;
  dumped.decisions[0].options.push({ id: 'changed', label: 'changed' });
  (dumped.rows.item![0].nested as { value: number }).value = 2;
  dumped.rows.account!.pop();
  assert.deepEqual(loaded.dump(), expected);
});

test('independent route connections cannot overwrite each other with stale snapshots (review B2)', t => {
  const { reopen } = fixture(t), a = reopen(), b = reopen();
  const account = a.put('account', { id: 'acc_1', user_id: 'u1' });
  const itemB = b.put('item', { id: 'it_b', user_id: 'u1' });
  const itemA = a.put('item', { id: 'it_a', user_id: 'u1' });
  const fresh = reopen();
  assert.deepEqual(fresh.get('account', 'u1', 'acc_1'), account);
  assert.deepEqual(fresh.rows('item', { user_id: 'u1' }), [itemB, itemA]);
  assert.deepEqual(a.get('item', 'u1', 'it_b'), itemB);
});

test('cached route handles see other Store writes immediately without reopening', t => {
  const { path } = fixture(t), handle = openDb(path);
  t.after(() => handle.close());
  const a = sqliteStore(handle), b = sqliteStore(openDb(path));
  const account = a.put('account', { id: 'acc_1', user_id: 'u1' });
  const itemB = b.put('item', { id: 'it_b', user_id: 'u1' });
  const itemA = a.put('item', { id: 'it_a', user_id: 'u1' });
  assert.deepEqual(b.get('account', 'u1', 'acc_1'), account);
  assert.deepEqual(a.rows('item', { user_id: 'u1' }), [itemB, itemA]);
});

test('another process sees committed rows and its writes survive subsequent writes by the first process', t => {
  const { path, reopen } = fixture(t), a = reopen();
  const account = a.put('account', { id: 'acc_1', user_id: 'u1' });
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    const { openDb } = await import(process.argv[2]);
    const { sqliteStore } = await import(process.argv[3]);
    const s = sqliteStore(openDb(process.argv[1]));
    assert.equal(s.get('account', 'u1', 'acc_1')?.version, 1);
    s.put('item', { id: 'child_item', user_id: 'u1' });
  `, path, new URL('../store/db.ts', import.meta.url).href, new URL('./sqlite-store.ts', import.meta.url).href], { encoding: 'utf8', timeout: 10000 });
  assert.equal(child.status, 0, child.stderr);
  const parentItem = a.put('item', { id: 'parent_item', user_id: 'u1' });
  assert.deepEqual(reopen().get('account', 'u1', account.id), account);
  assert.deepEqual(reopen().rows('item', { user_id: 'u1' }).map(row => row.id), ['child_item', parentItem.id]);
});

test('stale versions write nothing and equal ids in different tenants retain independent versions after reopening', t => {
  const { reopen } = fixture(t), a = reopen(), b = reopen();
  const first = a.put('item', { id: 'it_1', user_id: 'u1', state: 'review' });
  const second = b.put('item', { id: 'it_1', user_id: 'u2', state: 'live' });
  const loaded = reopen();
  assert.deepEqual(loaded.get('item', 'u1', 'it_1'), first);
  assert.deepEqual(loaded.get('item', 'u2', 'it_1'), second);
  const updatedFirst = a.put('item', { ...first, state: 'live' });
  const updatedSecond = b.put('item', { ...second, state: 'review' });
  assert.throws(() => loaded.put('item', first), { code: 'stale' });
  assert.throws(() => loaded.put('item', { id: 'new', user_id: 'u1', version: 0 }), { code: 'stale' });
  assert.equal(updatedFirst.version, 2); assert.equal(updatedSecond.version, 2);
  assert.deepEqual(reopen().get('item', 'u1', 'it_1'), updatedFirst);
  assert.deepEqual(reopen().get('item', 'u2', 'it_1'), updatedSecond);
  assert.equal(a.get('item', 'u1', 'new'), undefined);
});

test('uniqueness across handles returns the first event, job and open decision and is scoped per tenant', t => {
  const { reopen } = fixture(t), a = reopen(), b = reopen();
  const event = a.insertEvent(ev).row, queued = a.insertJob(job).row, opened = a.raiseDecision(decision).row;
  assert.deepEqual(b.insertEvent({ ...ev, why: 'changed' }), { row: event, duplicate: true });
  assert.deepEqual(b.insertJob({ ...job, attempts: 4 }), { row: queued, duplicate: true });
  assert.deepEqual(b.raiseDecision({ ...decision, why: 'changed' }), { row: opened, duplicate: true });
  for (const user_id of ['u2']) {
    assert.equal(b.insertEvent({ ...ev, user_id }).duplicate, false);
    assert.equal(b.insertJob({ ...job, user_id }).duplicate, false);
    assert.equal(b.raiseDecision({ ...decision, user_id }).duplicate, false);
  }
  b.updateDecision(opened.id, { state: 'answered' });
  assert.equal(a.raiseDecision(decision).duplicate, false);
  assert.match(event.id, /^ev_[a-f0-9]{16}$/);
  assert.match(queued.id, /^job_[a-f0-9]{16}$/);
  assert.match(opened.id, /^dec_[a-f0-9]{16}$/);
});

test('reopening preserves updated rows and pipeline job kinds without automatically recovering running work', t => {
  const { reopen } = fixture(t), a = reopen();
  const event = a.insertEvent(ev).row;
  const queued = a.insertJob({ ...job, kind: 'unlink' as JobRow['kind'] }).row;
  const opened = a.raiseDecision(decision).row;
  a.updateJob(queued.id, { attempts: 1, state: 'running' });
  a.updateDecision(opened.id, { state: 'answered' });
  const item = a.put('item', { id: 'it_1', user_id: 'u1', state: 'review' });
  const loaded = reopen();
  assert.deepEqual(loaded.events(), [event]);
  assert.deepEqual(loaded.getJob(queued.id), { ...queued, attempts: 1, state: 'running' });
  assert.equal(loaded.decisions()[0].state, 'answered');
  assert.deepEqual(loaded.get('item', 'u1', item.id), item);
});

test('transactions hide partial writes and outer rollback undoes nested writes, updates, deletion and claims', t => {
  const { reopen } = fixture(t), a = reopen(), observer = reopen();
  const item = a.put('item', { id: 'it_1', user_id: 'u1' });
  const queued = a.insertJob(job).row;
  a.claimJobs(1, 'worker');
  const before = a.exportUser('u1');
  assert.throws(() => a.tx(s => {
    s.put('order', { id: 'ord_1', user_id: 'u1' });
    s.tx(inner => { inner.insertEvent(ev); inner.raiseDecision(decision); inner.beginOperation(operation); });
    s.put('item', { ...item, state: 'changed' });
    s.updateJob(queued.id, { state: 'running' });
    s.deleteUser('u1');
    assert.deepEqual(observer.exportUser('u1'), before);
    throw new Error('abort');
  }), /abort/);
  assert.deepEqual(reopen().exportUser('u1'), before);
  assert.deepEqual(observer.claimJobs(1, 'other'), [], 'deleted claims must roll back too');
  a.tx(s => {
    s.put('order', { id: 'ord_2', user_id: 'u1' });
    s.tx(inner => inner.insertEvent(ev));
    assert.deepEqual(observer.events(), []);
  });
  assert.equal(observer.events().length, 1);
  assert.equal(observer.rows('order', { user_id: 'u1' }).length, 1);
});

test('caught nested rollback preserves outer writes and Promise transactions leave nothing written', t => {
  const { reopen } = fixture(t), a = reopen();
  a.tx(s => {
    s.put('item', { id: 'kept', user_id: 'u1' });
    assert.throws(() => s.tx(inner => { inner.insertEvent(ev); throw new Error('inner'); }), /inner/);
    assert.deepEqual(s.events(), []);
  });
  assert.throws(() => a.tx(s => { s.put('item', { id: 'async', user_id: 'u1' }); return Promise.resolve(); }), /synchronous|Promise/);
  assert.deepEqual(reopen().rows('item', { user_id: 'u1' }).map(row => row.id), ['kept']);
});

test('claims exclude paused, running and already claimed jobs across handles; explicit recovery preserves checkpoints', t => {
  const { reopen } = fixture(t), a = reopen(), b = reopen();
  const first = a.insertJob(job).row;
  const second = b.insertJob({ ...job, idempotency_key: 'second' }).row;
  const paused = a.insertJob({ ...job, idempotency_key: 'paused', paused: 'account_stale' }).row;
  const done = a.insertJob({ ...job, idempotency_key: 'done', state: 'done' }).row;
  assert.deepEqual(a.claimJobs(1, 'worker-a'), [first]);
  assert.deepEqual(b.claimJobs(10, 'worker-b'), [second]);
  assert.deepEqual(a.claimJobs(10, 'worker-c'), []);
  b.release(first.id);
  assert.deepEqual(a.claimJobs(1, 'worker-c'), [first]);
  const stages = [{ name: 'write', state: 'started' as const }, { name: 'read', state: 'arrived' as const, result: { id: 'synthetic' } }];
  a.updateJob(first.id, { state: 'running', stages });
  const loaded = reopen();
  assert.equal(loaded.getJob(first.id)?.state, 'running');
  assert.deepEqual(loaded.claimJobs(10, 'new-worker'), []);
  assert.equal(loaded.recover(), 1);
  assert.deepEqual(b.getJob(first.id)?.stages, stages);
  assert.equal(b.getJob(first.id)?.state, 'queued');
  assert.deepEqual(b.claimJobs(10, 'new-worker').map(row => row.id), [first.id, second.id]);
  assert.equal(b.getJob(paused.id)?.paused, 'account_stale');
  assert.equal(b.getJob(done.id)?.state, 'done');
  assert.equal(a.recover(), 0);
  assert.equal(b.claimJobs(10, 'again').length, 2, 'recover clears queued claims even with no running jobs');
});

test('deleteUser removes only that tenant from every table and their claims after reopening', t => {
  const { reopen, connect } = fixture(t), s = reopen();
  for (const user_id of ['u1', 'u2']) {
    for (const table of TABLES) s.put(table, { id: 'shared', user_id });
    s.insertEvent({ ...ev, user_id }); s.insertJob({ ...job, user_id });
    s.raiseDecision({ ...decision, user_id });
  }
  s.claimJobs(10, 'worker');
  const other = s.exportUser('u2'), handle = connect();
  assert.deepEqual(s.deleteUser('u1'), { events: 1, jobs: 1, decisions: 1, rows: Object.fromEntries(TABLES.map(table => [table, 1])) });
  const loaded = reopen();
  assert.deepEqual(loaded.exportUser('u2'), other);
  assert.deepEqual(loaded.events(), other.events); assert.deepEqual(loaded.jobs(), other.jobs); assert.deepEqual(loaded.decisions(), other.decisions);
  for (const table of TABLES) assert.deepEqual(loaded.systemRows(table), other.rows[table], table);
  assert.deepEqual(handle.prepare('SELECT job_id FROM claims').all().map(row => row.job_id), other.jobs.map(row => row.id));
});

test('renaming a claimed job retains its claim and deleteUser removes the renamed job claim', t => {
  const { reopen, connect } = fixture(t), a = reopen(), b = reopen(), handle = connect();
  const row = a.insertJob(job).row;
  a.claimJobs(1, 'worker');
  const renamed = a.updateJob(row.id, { id: 'seeded_job' });
  assert.equal(b.getJob(row.id), undefined);
  assert.deepEqual(b.getJob(renamed.id), renamed);
  assert.deepEqual(b.claimJobs(1, 'other'), []);
  b.deleteUser('u1');
  assert.deepEqual(handle.prepare('SELECT * FROM claims').all(), []);
});

test('updates including id patches preserve insertion order and lookup columns after reopening', t => {
  const { reopen } = fixture(t), a = reopen(), b = reopen();
  const jobs = [], events = [], decisions = [], rows = [];
  for (const suffix of ['z', 'a', 'm']) {
    jobs.push(a.insertJob({ ...job, idempotency_key: suffix }).row);
    events.push(a.insertEvent({ ...ev, dedupe_key: suffix }).row);
    decisions.push(a.raiseDecision({ ...decision, subject: suffix }).row);
    rows.push(a.put('item', { id: suffix, user_id: 'u1' }));
  }
  jobs[0] = b.updateJob(jobs[0].id, { id: 'renamed_job', user_id: 'u2', idempotency_key: 'moved', kind: 'reconcile', state: 'failed', site: 'ebay', account_id: 'acc_1', item_id: 'it_1', paused: 'account_stale' });
  decisions[0] = b.updateDecision(decisions[0].id, { id: 'renamed_decision', user_id: 'u2', kind: 'relink', subject: 'acc_1', state: 'answered' });
  rows[0] = b.put('item', { ...rows[0], state: 'live' });
  const loaded = reopen();
  assert.deepEqual(loaded.jobs(), jobs); assert.deepEqual(loaded.events(), events);
  assert.deepEqual(loaded.decisions(), decisions); assert.deepEqual(loaded.rows('item', { user_id: 'u1' }), rows);
  assert.equal(loaded.getJob(jobs[0].id)?.id, 'renamed_job');
  assert.deepEqual(loaded.jobs({ user_id: 'u2', kind: 'reconcile', state: 'failed', site: 'ebay', account_id: 'acc_1', item_id: 'it_1' }), [jobs[0]]);
  assert.deepEqual(loaded.decisions({ user_id: 'u2', kind: 'relink', subject: 'acc_1', state: 'answered' }), [decisions[0]]);
  assert.equal(loaded.insertJob({ ...job, user_id: 'u2', idempotency_key: 'moved' }).duplicate, true);
  assert.throws(() => loaded.updateJob('missing', {}), /no job missing/);
  assert.throws(() => loaded.updateDecision('missing', {}), /no decision missing/);
});

test('stored JSON filters use exact equality, while undefined event/job/decision filters are ignored like memoryStore', t => {
  const { reopen } = fixture(t), s = reopen(), memory = memoryStore();
  for (const st of [s, memory]) {
    st.put('account', { id: 'acc_a', user_id: 'u1', site: 'depop', count: 1 });
    st.put('account', { id: 'acc_b', user_id: 'u2', site: 'ebay', count: '1', optional: 'present' });
    st.insertEvent(ev); st.insertJob(job); st.raiseDecision(decision);
  }
  const loaded = reopen();
  for (const filter of [{}, { site: 'depop' }, { count: 1 }, { count: '1' }, { optional: undefined }, { site: undefined }]) {
    assert.deepEqual(loaded.systemRows('account', filter), memory.systemRows('account', filter));
  }
  assert.deepEqual(loaded.rows('account', { user_id: 'u1', count: 1 }), memory.rows('account', { user_id: 'u1', count: 1 }));
  assert.equal(loaded.events({ user_id: undefined }).length, 1);
  assert.equal(loaded.jobs({ site: undefined }).length, 1);
  assert.equal(loaded.decisions({ state: undefined }).length, 1);
});

test('operation ledger preserves claims, unknown and terminal results across reopening and rejects forbidden envelopes', t => {
  const { reopen } = fixture(t), s = reopen(), { row } = s.beginOperation(operation);
  const loaded = reopen();
  assert.deepEqual(loaded.get('operation', 'u1', operation.id), row);
  assert.deepEqual(loaded.rows('operation', { user_id: 'u1', state: 'started' }), [row]);
  assert.deepEqual(loaded.beginOperation(operation), { row, duplicate: true });
  const unknown = loaded.settleOperation('u1', operation.id, { state: 'unknown', at: 'read-back' });
  assert.deepEqual(reopen().get('operation', 'u1', operation.id), unknown);
  assert.throws(() => loaded.tx(st => { st.beginOperation({ ...operation, id: 'op_2' }); throw new Error('abort claim'); }), /abort claim/);
  assert.equal(reopen().get('operation', 'u1', 'op_2'), undefined);
  for (const key of ['cookie', 'token', 'authorization', 'password', 'set-cookie', 'buyer_name', 'address']) {
    assert.throws(() => loaded.settleOperation('u1', operation.id, { state: 'done', envelope: { data: [{ [key]: 'synthetic' }] }, at: 'later' }), /envelope/);
    assert.deepEqual(reopen().get('operation', 'u1', operation.id), unknown);
  }
  const done = loaded.settleOperation('u1', operation.id, { state: 'done', envelope: { ok: true, data: { id: 'listing_1' } }, at: 'settled' });
  assert.deepEqual(reopen().settleOperation('u1', operation.id, { state: 'done', envelope: { ok: false }, at: 'later' }), done);
  assert.throws(() => loaded.settleOperation('u1', operation.id, { state: 'done', envelope: { cookie: 'synthetic' }, at: 'later' }), /envelope/);
  assert.throws(() => loaded.settleOperation('u1', 'missing', { state: 'unknown', at: 'later' }), /no operation missing/);
});

test('database write errors surface and roll back prior writes and deleted claims', t => {
  const { reopen, connect } = fixture(t), s = reopen(), handle = connect();
  const row = s.insertJob(job).row; s.claimJobs(1, 'worker');
  s.put('item', { id: 'it_1', user_id: 'u1' });
  const before = s.exportUser('u1');
  handle.exec("CREATE TRIGGER refuse_delete BEFORE DELETE ON rows BEGIN SELECT RAISE(ABORT, 'synthetic write failure'); END;");
  assert.throws(() => s.deleteUser('u1'), /synthetic write failure/);
  assert.deepEqual(reopen().exportUser('u1'), before);
  assert.deepEqual(reopen().claimJobs(1, 'other'), []);
  assert.equal(handle.prepare('SELECT worker FROM claims WHERE job_id = ?').get(row.id)?.worker, 'worker');
  handle.exec("CREATE TRIGGER refuse_insert BEFORE INSERT ON rows BEGIN SELECT RAISE(ABORT, 'synthetic write failure'); END;");
  assert.throws(() => s.tx(st => { st.insertEvent(ev); st.put('order', { id: 'ord_1', user_id: 'u1' }); }), /synthetic write failure/);
  assert.deepEqual(reopen().exportUser('u1'), before);
});

test('corrupt JSON and invalid row shapes name the table and id without replacing saved data', t => {
  const { reopen, connect } = fixture(t), s = reopen(), handle = connect();
  const item = s.put('item', { id: 'it_1', user_id: 'u1' });
  const event = s.insertEvent(ev).row, queued = s.insertJob(job).row, opened = s.raiseDecision(decision).row;
  const cases = [
    { table: 'rows', id: item.id, read: () => reopen().get('item', 'u1', item.id), valid: item, invalid: { ...item, version: 0 } },
    { table: 'events', id: event.id, read: () => reopen().events(), valid: event, invalid: { ...event, action: 'invalid' } },
    { table: 'jobs', id: queued.id, read: () => reopen().getJob(queued.id), valid: queued, invalid: { ...queued, kind: '' } },
    { table: 'decisions', id: opened.id, read: () => reopen().decisions(), valid: opened, invalid: { ...opened, options: [null] } },
  ];
  for (const entry of cases) {
    for (const body of ['{', 'null', '{}', JSON.stringify(entry.invalid)]) {
      handle.prepare(`UPDATE ${entry.table} SET body = ? WHERE id = ?`).run(body, entry.id);
      assert.throws(entry.read, e => e instanceof Error && e.message.includes(entry.table === 'rows' ? 'item' : entry.table) && e.message.includes(entry.id));
      assert.equal(handle.prepare(`SELECT body FROM ${entry.table} WHERE id = ?`).get(entry.id)?.body, body);
    }
    handle.prepare(`UPDATE ${entry.table} SET body = ? WHERE id = ?`).run(JSON.stringify(entry.valid), entry.id);
  }
});
