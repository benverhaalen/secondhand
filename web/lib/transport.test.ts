import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ask, followJob, ApiFailure, JobFailure, type FollowOptions, type StreamPort } from './transport.ts';
import type { AssistEvent } from './types.ts';
import { replays } from './fixtures.ts';

test('ask posts to this origin with visitor and idempotency headers', async () => {
  let request: Request | undefined;
  const fetcher: typeof fetch = async (input, init) => {
    request = new Request(new URL(String(input), 'https://secondhand.test'), init);
    return Response.json({ id: 'job_test', kind: 'assist', state: 'queued', stages: [] }, { status: 202 });
  };
  assert.equal(await ask('Find this', undefined, 'vis_test1234', 'ask-one', fetcher), 'job_test');
  assert.equal(request?.url, 'https://secondhand.test/v1/assist');
  assert.equal(request?.headers.get('X-Visitor-Id'), 'vis_test1234');
  assert.equal(request?.headers.get('Idempotency-Key'), 'ask-one');
  assert.deepEqual(await request?.json(), { surface: 'buy', text: 'Find this' });
});
test('429 stays rate limited, server failure and malformed replies fail explicitly', async () => {
  await assert.rejects(ask('ask', undefined, 'vis_test1234', 'k', async () => new Response('', { status: 429 })), (e: unknown) => e instanceof ApiFailure && e.state === 'rate_limited');
  await assert.rejects(ask('ask', undefined, 'vis_test1234', 'k', async () => new Response('', { status: 503 })), /failed/);
  await assert.rejects(ask('ask', undefined, 'vis_test1234', 'k', async () => Response.json({ id: 2 }, { status: 202 })), /reply/);
});
test('stream failure closes it, polls after two seconds with visitor identity, and cancellation stops polls', async () => {
  let closed = 0;
  let callback: (() => void) | undefined;
  let delay = 0;
  const events: AssistEvent[] = [];
  const stream: StreamPort = { addEventListener() {}, close() { closed++; }, onerror: null };
  let requests = 0;
  const options: FollowOptions = {
    source: () => stream,
    fetcher: async (_input, init) => {
      assert.equal(new Headers(init?.headers).get('X-Visitor-Id'), 'vis_test1234');
      requests++;
      return Response.json({ state: 'running' });
    },
    schedule: (fn, ms) => { callback = fn; delay = ms; return () => { callback = undefined; }; },
    onEvent: e => events.push(e), onError: e => { throw e; },
  };
  const stop = followJob('job_test', 'vis_test1234', options);
  stream.onerror?.();
  assert.equal(closed, 1);
  assert.equal(delay, 2000);
  callback?.();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests, 1);
  assert.equal(delay, 2000);
  stop();
  assert.equal(callback, undefined);
  assert.deepEqual(events, []);
});
test('repeated frame ids do not duplicate text; settlement closes the stream and ignores late frames', () => {
  const handlers = new Map<string, (frame: { data: string; lastEventId?: string }) => void>();
  const received: AssistEvent[] = [];
  let closed = false;
  let timer: (() => void) | undefined;
  const stream: StreamPort = { addEventListener: (name, fn) => { handlers.set(name, fn); }, onerror: null, close: () => { closed = true; } };
  followJob('job_test', 'vis_test1234', { source: () => stream, onEvent: e => received.push(e), onError: e => { throw e; }, schedule: fn => { timer = fn; return () => { timer = undefined; }; } });
  const text = { data: JSON.stringify({ delta: 'Once' }), lastEventId: '1' };
  handlers.get('assist.text')?.(text);
  handlers.get('assist.text')?.(text);
  const settled = replays['words-fixture-prices-counts'].events.at(-1)!;
  handlers.get('assist.settled')?.({ data: JSON.stringify(settled.data), lastEventId: '2' });
  handlers.get('assist.text')?.({ data: JSON.stringify({ delta: 'Late' }), lastEventId: '3' });
  assert.deepEqual(received.map(e => e.event), ['assist.text', 'assist.settled']);
  assert.equal(closed, true);
  assert.equal(timer, undefined);
});
test('fallback reads the settled Answer from job.result and stops; terminal job failures surface once', async () => {
  const settled = replays['photo-fixture-prices-counts'].events.at(-1)!;
  for (const job of [{ state: 'done', result: settled.data }, { state: 'failed' }, { state: 'done', result: { bad: true } }]) {
    let timer: (() => void) | undefined;
    const received: AssistEvent[] = [];
    const errors: unknown[] = [];
    followJob('job_test', 'vis_test1234', { source: () => { throw new Error('No EventSource'); }, fetcher: async () => Response.json(job), onEvent: e => received.push(e), onError: e => errors.push(e), schedule: fn => { timer = fn; return () => { timer = undefined; }; } });
    timer?.();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(timer, undefined);
    if ('result' in job && job.result === settled.data) assert.deepEqual(received, [settled]);
    else { assert.equal(errors.length, 1); assert.ok(errors[0] instanceof JobFailure); }
  }
});
