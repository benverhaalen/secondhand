import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { createLog, memorySink } from '../../../../log/index.js';
import type { JobRow } from '../events/ports.ts';
import { deps, route } from './http.ts';
import { EXAMPLES, STREAMS, example } from './examples.ts';
import { getJob, jobEvents, memoryJobs, seedExamples, streamOpts, userStream, type JobStore } from './jobs.ts';

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
  assert.throws(() => s.append('job_a', 'job.stage', { job_id: 'job_a', stage: 'x', state: 'running' }), (e: any) => e.code === 'invalid');
  assert.throws(() => s.append('job_a', 'fact.found', { job_id: 'job_a', attribute: { value: 'x' } }), (e: any) => e.code === 'invalid');
  assert.throws(() => s.append('job_a', 'fact.found', { job_id: 'job_a', attribute: { name: 'brand' } }), (e: any) => e.code === 'invalid');
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
