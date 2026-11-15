import assert from 'node:assert/strict';
import { test, beforeEach, type TestContext } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createLog, memorySink } from '../../../../log/index.js';
import { checkLog } from '../../../../spec/log.mjs';
import type { JobRow } from '../events/ports.ts';
import { ApiError, deps, route } from './http.ts';
import { EXAMPLES, STREAMS, example, examplesServed } from './examples.ts';
import { getJob, jobEvents, jobsOn, memoryJobs, seedExamples, streamOpts, userStream, type JobStore, type SseFrame } from './jobs.ts';
import { sqliteStore } from '../events/sqlite-store.ts';
import { searchParams } from '../intel/run.ts';

test('prune expires terminal frames after the TTL, retaining running jobs and the exact boundary', () => {
  const s = memoryJobs(), at = Date.now();
  const ttl = (searchParams.read('search_frame_ttl_s', {}).value as number) * 1000;
  for (const id of ['ended', 'running', 'failed']) {
    s.put({ id, kind: 'assist', state: 'running' }, 'u');
    s.append(id, 'job.state', { state: 'running', at: new Date(at - ttl * 2).toISOString() });
  }
  s.append('ended', 'job.state', { state: 'done', at: new Date(at).toISOString() });
  s.append('failed', 'job.state', { state: 'failed', at: new Date(at).toISOString() });
  s.prune(at + ttl);
  assert.equal(s.framesAfter('ended', 0).length, 2);
  s.prune(at + ttl + 1);
  for (const id of ['ended', 'failed']) {
    assert.deepEqual(s.framesAfter(id, 0), []);
    assert.equal(s.get(id, 'u'), undefined);
  }
  assert.equal(s.framesAfter('running', 0).length, 1);
  assert.equal(s.get('running', 'u')?.state, 'running');
});

test('prune also expires an assist row initially written as terminal', () => {
  const s = memoryJobs(), now = Date.now();
  s.put({ id: 'terminal', kind: 'assist', state: 'done' }, 'u');
  const ttl = (searchParams.read('search_frame_ttl_s', {}).value as number) * 1000;
  s.prune(now + ttl + 100);
  assert.equal(s.get('terminal', 'u'), undefined);
});

test('prune drops ordinary search frames but never running search frames', () => {
  const s = memoryJobs(), now = Date.now();
  for (const id of ['ended_search', 'running_search']) {
    s.put({ id, kind: 'search', state: 'running' }, 'u');
    s.append(id, 'job.state', { state: 'running' });
  }
  s.append('ended_search', 'job.state', { state: 'done', at: new Date(now).toISOString() });
  const ttl = (searchParams.read('search_frame_ttl_s', {}).value as number) * 1000;
  s.prune(now + ttl + 1);
  assert.deepEqual(s.framesAfter('ended_search', 0), []);
  assert.equal(s.framesAfter('running_search', 0).length, 1);
});

beforeEach(() => {
  deps.log = createLog({ src: 'test', build: 'test', sink: memorySink() });
  deps.verify = async (t) => (t === 'good' ? 'usr_8f2k' : t === 'other' ? 'usr_other' : null);
  deps.idem.clear(); deps.visits.clear(); deps.now = () => Date.now();
});

const seeded = () => { const s = memoryJobs(); seedExamples(s); return s; };
const handlers = (s: JobStore) => ({
  get: route('GET /v1/jobs/:id', getJob(s)),
  events: route('GET /v1/jobs/:id/events', jobEvents(s), { auth: 'visitor' }),
  stream: route('GET /v1/stream', userStream(s)),
});
const call = (h: (r: Request) => Promise<Response>, path: string, headers: Record<string, string> = {}, token: string | null = 'good') =>
  h(new Request(`http://edge.test${path}`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers } }));

// Read frames off an SSE response until `n` blank-line-terminated frames (comments count) arrive, then cancel the reader.
async function read(res: Response, n: number) {
  const r = res.body!.getReader(), dec = new TextDecoder(); let text = '';
  while (text.split('\n\n').length - 1 < n) { const c = await r.read(); if (c.done) break; text += dec.decode(c.value); }
  await r.cancel();
  return text;
}
const readAll = async (res: Response) => {
  const r = res.body!.getReader(), dec = new TextDecoder(); let text = '';
  for (;;) { const c = await r.read(); if (c.done) return text; text += dec.decode(c.value); }
};
const ids = (text: string) => [...text.matchAll(/^id: (\d+)$/gm)].map((m) => Number(m[1]));
const job = (id: string, extra: Partial<JobRow> = {}): Pick<JobRow, 'id' | 'kind' | 'state' | 'stages'> => ({ id, kind: 'identify', state: 'running', stages: [], ...extra });

test('seeded example jobs answer their examples, and the stream formats frames as id/event/data', async () => {
  const h = handlers(seeded());
  for (const name of ['jobs.get', 'jobs.get.sweep', 'jobs.get.relink_paused']) {
    const ex = example(name), r = await call(h.get, ex.path);
    assert.equal(r.status, ex.status); assert.deepEqual(await r.json(), ex.response);
  }
  const nf = example('jobs.get.not_found'), r = await call(h.get, nf.path);
  assert.equal(r.status, 404); assert.deepEqual(await r.json(), nf.response);
});

test('the wrong user gets 404, a visitor sees only its own vis_ jobs', async () => {
  const s = seeded(); const h = handlers(s);
  s.put(job('job_mine'), 'usr_8f2k'); s.put(job('job_vis'), 'vis_abcdefgh1');
  assert.equal((await call(h.get, '/v1/jobs/job_mine')).status, 200);
  const other = await call(h.get, '/v1/jobs/job_mine', {}, 'other');
  assert.equal(other.status, 404); assert.equal((await other.json()).code, 'not_found');
  assert.equal((await call(h.events, '/v1/jobs/job_mine/events', {}, 'other')).status, 404);
  const own = await call(h.events, '/v1/jobs/job_vis/events', { 'X-Visitor-Id': 'vis_abcdefgh1' }, null);
  assert.equal(own.status, 200); await own.body!.cancel();
  assert.equal((await call(h.events, '/v1/jobs/job_vis/events', { 'X-Visitor-Id': 'vis_zzzzzzzz2' }, null)).status, 404);
  assert.equal((await call(h.events, '/v1/jobs/job_vis/events', {}, 'good')).status, 404); // a signed-in user does not see a visitor's job
});

test('seeded example jobs belong to the example user; the example visitor job is open to any visitor', async () => {
  const h = handlers(seeded());
  assert.equal((await call(h.get, '/v1/jobs/job_9a', {}, 'other')).status, 404);
  const ev = await call(h.events, '/v1/jobs/job_sr1/events', {}, null); // visitor example
  assert.equal(ev.status, 200); await ev.body!.cancel();
});

test('a stage frame with no found{} is refused; fact.found needs attribute.name and value', () => {
  const s = memoryJobs(); s.put(job('job_a'), 'usr_8f2k');
  assert.throws(() => s.append('job_a', 'job.stage', { job_id: 'job_a', stage: 'x', state: 'running' }), (e: unknown) => e instanceof ApiError && e.code === 'invalid');
  assert.throws(() => s.append('job_a', 'fact.found', { job_id: 'job_a', attribute: { value: 'x' } }), (e: unknown) => e instanceof ApiError && e.code === 'invalid');
  assert.throws(() => s.append('job_a', 'fact.found', { job_id: 'job_a', attribute: { name: 'brand' } }), (e: unknown) => e instanceof ApiError && e.code === 'invalid');
  assert.equal(s.framesAfter('job_a', 0).length, 0);
  s.append('job_a', 'job.stage', { job_id: 'job_a', stage: 'x', state: 'running', found: {} });
  s.append('job_a', 'fact.found', { job_id: 'job_a', attribute: { name: 'size', value: null, unknown_reason: 'not_visible' } });
  assert.deepEqual(s.framesAfter('job_a', 0).map((f) => f.id), [1, 2]);
});

test('frame ids count per job from 1 and framesAfter skips what was seen', () => {
  const s = memoryJobs(); s.put(job('job_a'), 'u'); s.put(job('job_b'), 'u');
  s.append('job_a', 'job.state', { job_id: 'job_a', kind: 'identify', state: 'running' });
  s.append('job_a', 'job.state', { job_id: 'job_a', kind: 'identify', state: 'running' });
  assert.equal(s.append('job_b', 'job.state', { job_id: 'job_b', kind: 'identify', state: 'running' }).id, 1);
  assert.deepEqual(s.framesAfter('job_a', 1).map((f) => f.id), [2]);
});

test('every frame of the example stream is sent as id/event/data, and the stream ends after done', async () => {
  const h = handlers(seeded());
  const res = await call(h.events, '/v1/jobs/job_9a/events');
  assert.equal(res.headers.get('content-type'), 'text/event-stream');
  const text = await readAll(res); // resolves only because the stream closes
  const want = STREAMS.identify_then_valuate.filter((f) => f.id && f.data!.job_id === 'job_9a');
  assert.deepEqual(ids(text), want.map((f) => Number(f.id)));
  assert.ok(text.startsWith(`id: 1\nevent: job.state\ndata: ${JSON.stringify(want[0].data)}\n\n`));
});

test('a client reconnects with Last-Event-ID and resumes from the next frame', async () => {
  const h = handlers(seeded());
  const ex = example('jobs.events.resume');
  const text = await readAll(await call(h.events, ex.path, ex.request!.headers));
  assert.equal(ids(text)[0], ex.from_id);
  assert.deepEqual(ids(text), [5, 6, 7]);
  assert.equal(await readAll(await call(h.events, ex.path, { 'Last-Event-ID': '7' })), ''); // done and nothing left: closes at once
});

test('a live stream wakes on append, then ends after job.state done; listener and timer are cleaned up', async () => {
  const s = memoryJobs(); const h = handlers(s); s.put(job('job_live'), 'usr_8f2k');
  const res = await call(h.events, '/v1/jobs/job_live/events');
  const all = readAll(res);
  s.append('job_live', 'job.stage', { job_id: 'job_live', stage: 'read_label', state: 'running', found: { results_found: 0 } });
  s.append('job_live', 'job.state', { job_id: 'job_live', kind: 'identify', state: 'done' });
  assert.deepEqual(ids(await all), [1, 2]);
  assert.equal(s.listenerCount('job_live'), 0);
  assert.equal(s.get('job_live', 'usr_8f2k')!.state, 'done');
});

test('the heartbeat is sent, and cancelling removes the listener', async () => {
  const s = memoryJobs(); const h = handlers(s); s.put(job('job_hb'), 'usr_8f2k');
  const was = streamOpts.heartbeatMs; streamOpts.heartbeatMs = 10;
  try {
    const res = await call(h.events, '/v1/jobs/job_hb/events');
    assert.equal(s.listenerCount('job_hb'), 1);
    const text = await read(res, 2);
    assert.ok(text.startsWith(': heartbeat\n\n: heartbeat\n\n'));
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(s.listenerCount('job_hb'), 0);
  } finally { streamOpts.heartbeatMs = was; }
});

test('GET /v1/stream sends the signed-in user\'s example frames and stays open', async () => {
  const h = handlers(seeded());
  const want = STREAMS.user_stream;
  const text = await read(await call(h.stream, '/v1/stream'), want.length);
  assert.deepEqual(ids(text), want.map((f) => Number(f.id)));
  assert.equal(ids(await read(await call(h.stream, '/v1/stream', { 'Last-Event-ID': '107' }), 1))[0], 108);
});

test('every jobs example endpoint has a handler that answers its status', () => {
  assert.ok(EXAMPLES.filter((e) => e.endpoint.includes('/v1/jobs') || e.endpoint === 'GET /v1/stream').length >= 8);
});

test('an engine completion finishes both ordinary and assist jobs with a replayable terminal frame', () => {
  const s = memoryJobs();
  for (const kind of ['search', 'assist'] as const) {
    const row = s.put({ kind, state: 'running', stages: [{ name: 'engine', state: 'running' }] }, 'usr_test');
    s.finish(row.id, { found: 1 });
    const saved = s.get(row.id, 'usr_test');
    assert.equal(saved?.state, 'done');
    assert.deepEqual(saved?.result, { found: 1 });
    assert.equal(saved?.stages[0].state, 'arrived');
    assert.equal(s.framesAfter(row.id, 0).at(-1)?.data.state, 'done');
  }
});

function disk(t: TestContext, env: Record<string, string | undefined> = { SECONDHAND_EXAMPLES: '0' }) {
  const dir = mkdtempSync(join(tmpdir(), 'jobs-test-')), path = join(dir, 'jobs.db');
  const handles: DatabaseSync[] = [];
  const open = () => {
    const db = new DatabaseSync(path); handles.push(db);
    return { db, s: jobsOn(sqliteStore(db), db, env) };
  };
  t.after(() => { for (const db of handles) db.close(); rmSync(dir, { recursive: true }); });
  return open;
}

const searchResult = () => ({
  results: [
    { site: 'dupe', may_store: false, url: 'https://example.test/forbidden-row' },
    { site: 'poshmark', may_store: true, url: 'https://example.test/allowed-row' },
    { site: 'x', url: 'https://example.test/missing-rights' },
    { site: 'x', may_store: true, keep_until: '2000-01-01T00:00:00Z', url: 'https://example.test/expired' },
  ],
  found: { sources_searched: 4, results_found: 4, results_used: 4, sites: { dupe: 1, poshmark: 1, x: 2 } },
  searched: [{ site: 'dupe', outcome: 'hit', count: 1 }, { site: 'x', outcome: 'blocked', count: 0 }],
  identity: { by: 'codes' },
});

test('restart preserves search stages, found counts and frame ids on a fresh database handle', async t => {
  const open = disk(t), { s } = open();
  const stages = [{ name: 'site:x', state: 'failed' as const, found: { results_found: 4 }, error: { code: 'blocked', message: 'blocked' } }];
  s.put({ id: 'job_restart', kind: 'search', state: 'running', stages }, 'usr_8f2k');
  s.append('job_restart', 'job.state', { state: 'running' });
  s.append('job_restart', 'job.stage', { stage: 'site:x', state: 'failed', found: { results_found: 4 } });
  s.update('job_restart', { result: searchResult() });
  s.append('job_restart', 'job.state', { state: 'done' });
  const { s: restarted } = open();
  const response = await call(handlers(restarted).get, '/v1/jobs/job_restart');
  assert.equal(response.status, 200);
  const row = await response.json();
  assert.equal(row.state, 'done'); assert.deepEqual(row.stages, stages);
  assert.deepEqual(row.result.found, searchResult().found);
  assert.deepEqual(row.result.searched, searchResult().searched);
  assert.deepEqual(restarted.framesAfter('job_restart', 0), s.framesAfter('job_restart', 0));
  assert.deepEqual(restarted.framesAfter('job_restart', 0).map(f => f.id), [1, 2, 3]);
});

test('rights filtering removes forbidden URLs from job and frame SQL while live GET and frames retain every row', async t => {
  const open = disk(t), { db, s } = open(), result = searchResult();
  s.put({ id: 'job_rights', kind: 'search', state: 'running' }, 'usr_8f2k');
  s.update('job_rights', { result });
  s.append('job_rights', 'answer.settled', { result });
  s.append('job_rights', 'job.state', { state: 'done', result });
  assert.deepEqual((await (await call(handlers(s).get, '/v1/jobs/job_rights')).json()).result, result);
  assert.deepEqual(s.st.getJob('job_rights')?.result, result, 'existing in-process Store readers also receive the live result');
  assert.deepEqual(s.framesAfter('job_rights', 0)[0].data.result, result);
  const storedJob = db.prepare('SELECT body FROM jobs WHERE id = ?').get('job_rights')!.body as string;
  const storedFrames = db.prepare('SELECT data FROM frames WHERE key = ? ORDER BY id').all('job_rights').map(f => f.data as string);
  for (const text of [storedJob, ...storedFrames]) {
    assert.ok(!text.includes(result.results[0].url));
    const saved = JSON.parse(text);
    assert.deepEqual(saved.result.results, [result.results[1]]);
    assert.deepEqual(saved.result.found, result.found);
    assert.deepEqual(saved.result.searched, result.searched);
  }
  assert.deepEqual(open().s.get('job_rights', 'usr_8f2k')?.result, { ...result, results: [result.results[1]] });
});

test('a finished job logs its kept and dropped row counts once without logging listing data', t => {
  const { s } = disk(t)(), sink = memorySink();
  deps.log = createLog({ src: 'test', build: 'test', sink });
  s.put({ id: 'job_logged', kind: 'search', state: 'running' }, 'usr_8f2k');
  s.finish('job_logged', searchResult());
  const lines = sink.lines.map((line: string) => JSON.parse(line) as Record<string, unknown>).filter((line: Record<string, unknown>) => line.job === 'job_logged');
  assert.equal(lines.length, 1);
  assert.equal(lines[0].kept_rows, 1); assert.equal(lines[0].dropped_rows, 3);
  assert.ok(!sink.text().includes('https://example.test/'));
  assert.deepEqual(checkLog(sink.text()).problems, []);
});

test('finish retains failed and late source outcomes rather than claiming every source arrived', t => {
  const { s } = disk(t)();
  const stages: JobRow['stages'] = [{ name: 'site:x', state: 'failed', found: { results_found: 0 } },
    { name: 'site:y', state: 'late' as JobRow['stages'][number]['state'], found: { results_found: 0 } }];
  s.put({ id: 'job_failed_stage', kind: 'search', state: 'running', stages }, 'usr_8f2k');
  s.finish('job_failed_stage', searchResult());
  assert.deepEqual(s.get('job_failed_stage', 'usr_8f2k')?.stages, stages);
});

test('a second instance cannot reuse a stored frame id, including after its local log already exists', t => {
  const open = disk(t), a = open().s, b = open().s;
  assert.equal(a.append('key', 'state.change', {}).id, 1);
  assert.equal(b.append('key', 'state.change', {}).id, 2);
  assert.equal(a.append('key', 'state.change', {}).id, 3);
  assert.deepEqual(a.framesAfter('key', 0).map(f => f.id), [1, 2, 3]);
  assert.deepEqual(b.framesAfter('key', 0).map(f => f.id), [1, 2, 3]);
});

test('cross-bundle SSE polls stored frames even with a live log, and cancel clears every timer', async t => {
  const open = disk(t), a = open().s, b = open().s;
  const timers = new Set<ReturnType<typeof setInterval>>(), interval = globalThis.setInterval, clear = globalThis.clearInterval;
  t.mock.method(globalThis, 'setInterval', (...args: Parameters<typeof setInterval>) => {
    const timer = interval(...args); timers.add(timer); return timer;
  });
  t.mock.method(globalThis, 'clearInterval', (timer: ReturnType<typeof setInterval>) => { timers.delete(timer); clear(timer); });
  t.after(() => { for (const timer of timers) clear(timer); });
  a.put(job('job_cross'), 'usr_8f2k');
  a.append('job_cross', 'job.state', { state: 'running' });
  const response = await call(handlers(a).events, '/v1/jobs/job_cross/events');
  const reader = response.body!.getReader(); t.after(() => reader.cancel());
  assert.deepEqual(ids(new TextDecoder().decode((await reader.read()).value)), [1]);
  b.append('job_cross', 'answer.partial', { results: [] });
  const timeout = setTimeout(() => reader.cancel(), 2500);
  try {
    const received = await reader.read();
    assert.equal(received.done, false, 'a remote frame must arrive on the one-second poll');
    assert.deepEqual(ids(new TextDecoder().decode(received.value)), [2]);
    await reader.cancel();
    assert.equal(timers.size, 0, 'cancelling clears both polling and heartbeat timers');
    assert.equal(a.listenerCount('job_cross'), 0);
  } finally { clearTimeout(timeout); }
});

test('cross-bundle terminal state closes SSE and clears every timer', async t => {
  const open = disk(t), a = open().s, b = open().s;
  a.put(job('job_close'), 'usr_8f2k');
  const clear = t.mock.method(globalThis, 'clearInterval');
  const response = await call(handlers(a).events, '/v1/jobs/job_close/events');
  const reader = response.body!.getReader();
  const timeout = setTimeout(() => reader.cancel(), 2500);
  t.after(() => { clearTimeout(timeout); return reader.cancel(); });
  b.append('job_close', 'job.state', { state: 'done' });
  const received = await reader.read();
  assert.deepEqual(ids(new TextDecoder().decode(received.value)), [1]);
  assert.equal((await reader.read()).done, true);
  assert.equal(a.listenerCount('job_close'), 0);
  assert.equal(clear.mock.callCount(), 2);
});

test('examples disabled prevents seeding, visitor sharing and seed-id takeover', t => {
  assert.equal(examplesServed({ NODE_ENV: 'production' }), false);
  assert.equal(examplesServed({ NODE_ENV: 'production', SECONDHAND_EXAMPLES: '1' }), true);
  assert.equal(examplesServed({ SECONDHAND_EXAMPLES: '0' }), false);
  assert.equal(examplesServed({}), true);
  const { s } = disk(t)(); seedExamples(s);
  assert.equal(s.get('job_sr1', 'vis_other123'), undefined);
  assert.deepEqual(s.framesAfter('job_sr1', 0), []);
  s.put(job('job_private'), 'vis_example01');
  assert.equal(s.get('job_private', 'vis_other123'), undefined);
  assert.ok(s.get('job_private', 'vis_example01'));
  assert.notEqual(s.start(job('job_private'), 'vis_other123').id, 'job_private');
});

test('assist jobs and claimed seed ids survive a fresh instance', t => {
  const open = disk(t), a = open().s;
  a.start({ id: 'assist_saved', kind: 'assist', state: 'running' }, 'usr_8f2k');
  a.finish('assist_saved', searchResult());
  const b = open().s;
  assert.equal(b.get('assist_saved', 'usr_8f2k')?.state, 'done');
  assert.deepEqual((b.get('assist_saved', 'usr_8f2k')?.result as ReturnType<typeof searchResult>).results, [searchResult().results[1]]);
  assert.notEqual(b.start({ id: 'assist_saved', kind: 'assist' }, 'usr_8f2k').id, 'assist_saved');
});

test('prune uses persisted finish times to delete expired frames and assist jobs while retaining fresh frames', t => {
  const open = disk(t), { s } = open(), now = Date.now();
  const ttl = (searchParams.read('search_frame_ttl_s', {}).value as number) * 1000;
  for (const [id, kind, at] of [['old_search', 'search', now - ttl - 1], ['old_assist', 'assist', now - ttl - 1], ['fresh', 'search', now]] as const) {
    s.put({ id, kind, state: 'running' }, 'usr_8f2k');
    s.append(id, 'job.state', { state: 'done', at: new Date(at).toISOString() });
  }
  const { db, s: restarted } = open(); restarted.prune(now);
  assert.deepEqual(db.prepare('SELECT DISTINCT key FROM frames').all().map(r => r.key), ['fresh']);
  assert.equal(restarted.get('old_assist', 'usr_8f2k'), undefined);
  assert.equal(db.prepare("SELECT key FROM kv WHERE ns = 'assist_job'").all().length, 0);
  assert.equal(s.framesAfter('old_search', 0).length, 0);
});

test('rights expiring before the terminal write are removed again from the stored job result', t => {
  const { db, s } = disk(t)();
  let now = Date.parse('2026-11-15T12:00:00Z');
  t.mock.method(Date, 'now', () => now);
  s.put({ id: 'job_expiring', kind: 'search', state: 'running' }, 'usr_8f2k');
  const result = { results: [{ site: 'x', may_store: true, keep_until: new Date(now + 1).toISOString() }], found: { results_found: 1 } };
  s.update('job_expiring', { result });
  now += 2;
  s.append('job_expiring', 'job.state', { state: 'done' });
  const saved = JSON.parse(db.prepare('SELECT body FROM jobs WHERE id = ?').get('job_expiring')!.body as string);
  assert.deepEqual(saved.result, { ...result, results: [] });
  assert.deepEqual(s.get('job_expiring', 'usr_8f2k')?.result, result);
});

test('prune removes expired listing rights from retained jobs, assist rows and frames before the frame TTL', t => {
  const { db, s } = disk(t)(), now = Date.now();
  const result = { results: [{ site: 'x', may_store: true, keep_until: new Date(now + 1000).toISOString() },
    { site: 'y', may_store: true }], found: { results_found: 2 } };
  for (const kind of ['search', 'assist'] as const) {
    s.put({ id: `job_expiry_${kind}`, kind, state: 'running' }, 'usr_8f2k');
    s.append(`job_expiry_${kind}`, 'answer.partial', { result });
    s.finish(`job_expiry_${kind}`, result);
  }
  s.prune(now + 1001);
  const job = JSON.parse(db.prepare('SELECT body FROM jobs WHERE id = ?').get('job_expiry_search')!.body as string);
  const assist = JSON.parse(db.prepare("SELECT value FROM kv WHERE ns = 'assist_job'").get()!.value as string);
  const frame = JSON.parse(db.prepare("SELECT data FROM frames WHERE key = 'job_expiry_search' AND event = 'answer.partial'").get()!.data as string);
  for (const saved of [job, assist, frame]) assert.deepEqual(saved.result, { ...result, results: [result.results[1]] });
  assert.deepEqual(s.get('job_expiry_search', 'usr_8f2k')?.result, result, 'rights filtering on disk does not change the live answer');
});

test('a fractional or non-finite requested frame id cannot violate integer frame ordering', () => {
  const s = memoryJobs();
  for (const id of [1.5, NaN, Infinity]) assert.throws(() => s.append('key', 'state.change', {}, id), ApiError);
  assert.deepEqual(s.framesAfter('key', 0), []);
});

test('finish cannot expose a terminal job to another handle before its terminal frame is committed', t => {
  const open = disk(t), a = open().s, { db } = open();
  a.put({ id: 'job_atomic', kind: 'search', state: 'running' }, 'usr_8f2k');
  const append = a.append.bind(a);
  t.mock.method(a, 'append', (...args: Parameters<typeof a.append>) => {
    assert.equal(db.prepare('SELECT state FROM jobs WHERE id = ?').get('job_atomic')!.state, 'running');
    return append(...args);
  });
  a.finish('job_atomic', { found: 1 });
  assert.equal(db.prepare('SELECT state FROM jobs WHERE id = ?').get('job_atomic')!.state, 'done');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM frames WHERE key = ?').get('job_atomic')!.n, 1);
});

test('SSE drains a terminal frame committed between its frame scan and its job-state read', async t => {
  const open = disk(t), a = open().s, b = open().s;
  a.put(job('job_scan_race'), 'usr_8f2k');
  const framesAfter = a.framesAfter.bind(a);
  let appended = false;
  t.mock.method(a, 'framesAfter', (key: string, after: number) => {
    const frames = framesAfter(key, after);
    if (!appended) { appended = true; b.append(key, 'job.state', { state: 'done' }); }
    return frames;
  });
  const text = await readAll(await call(handlers(a).events, '/v1/jobs/job_scan_race/events'));
  assert.deepEqual(ids(text), [1]);
  assert.equal(a.listenerCount('job_scan_race'), 0);
});

test('removing the final listener releases its live key without removing a later listener set', t => {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close());
  const live = { log: new Map<string, SseFrame[]>(), results: new Map<string, unknown>(), ears: new Map<string, Set<() => void>>() };
  const s = jobsOn(sqliteStore(db), db, { SECONDHAND_EXAMPLES: '0' }, live);
  const off = s.listen('key', () => {});
  assert.equal(live.ears.size, 1);
  off(); assert.equal(live.ears.size, 0);
  const nextOff = s.listen('key', () => {});
  off(); assert.equal(s.listenerCount('key'), 1);
  nextOff(); assert.equal(live.ears.size, 0);
});
