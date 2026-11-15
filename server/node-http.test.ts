import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { IncomingMessage, type ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { test } from 'node:test';
import { send, toRequest } from './node-http.ts';

test('a streamed request body requires duplex and preserves host, protocol, method and headers', async () => {
  const incoming = new IncomingMessage(new Socket());
  incoming.method = 'POST';
  incoming.url = '/v1/search?q=1';
  incoming.headers = { host: 'secondhand.local:8080', 'x-forwarded-proto': 'https', 'content-type': 'application/json' };
  incoming.rawHeaders = ['Host', 'secondhand.local:8080', 'X-Forwarded-Proto', 'https', 'Content-Type', 'application/json', 'X-Tag', 'a', 'X-Tag', 'b'];
  const request = toRequest(incoming, 'http://fallback.local');
  incoming.push('{"text":"levis 501"}');
  incoming.push(null);
  assert.equal(request.url, 'https://secondhand.local:8080/v1/search?q=1');
  assert.equal(request.method, 'POST');
  assert.equal(request.headers.get('x-tag'), 'a, b');
  assert.deepEqual(await request.json(), { text: 'levis 501' });
});

test('GET and HEAD requests have no body and a missing Host falls back to the origin', () => {
  for (const method of ['GET', 'HEAD']) {
    const incoming = new IncomingMessage(new Socket());
    incoming.method = method;
    incoming.url = '/healthz';
    const request = toRequest(incoming, 'http://127.0.0.1:8080');
    assert.equal(request.url, 'http://127.0.0.1:8080/healthz');
    assert.equal(request.body, null);
  }
});

class Output extends EventEmitter {
  statusCode = 0;
  destroyed = false;
  writableEnded = false;
  headers = new Map<string, string | string[]>();
  chunks: Uint8Array[] = [];
  blocked = false;
  setHeader(name: string, value: string | string[]) { this.headers.set(name.toLowerCase(), value); }
  flushHeaders() {}
  write(chunk: Uint8Array) { this.chunks.push(chunk); this.emit('chunk'); return !this.blocked; }
  end() { this.writableEnded = true; this.emit('finish'); }
  get response() { return this as unknown as ServerResponse; }
}

test('backpressure pauses streaming until drain and separate Set-Cookie headers survive', async () => {
  const out = new Output();
  out.blocked = true;
  const headers = new Headers([['set-cookie', 'a=1; Path=/'], ['set-cookie', 'b=2; Path=/'], ['x-test', 'yes']]);
  const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array([1])); c.enqueue(new Uint8Array([2])); c.close(); } });
  const first = once(out, 'chunk');
  const pending = send(out.response, new Response(body, { status: 202, headers }), new AbortController().signal);
  await first;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(out.chunks.length, 1);
  assert.equal(out.writableEnded, false);
  out.blocked = false;
  out.emit('drain');
  await pending;
  assert.equal(out.statusCode, 202);
  assert.deepEqual(out.headers.get('set-cookie'), ['a=1; Path=/', 'b=2; Path=/']);
  assert.equal(out.headers.get('x-test'), 'yes');
  assert.equal(out.chunks.length, 2);
  assert.equal(out.writableEnded, true);
});

for (const cause of ['client disconnect', 'shutdown signal', 'already aborted signal', 'disconnect during backpressure']) {
  test(`${cause} cancels a pending SSE reader and releases its timer`, async () => {
    const out = new Output();
    const controller = new AbortController();
    let cancelled = false;
    let timer: ReturnType<typeof setInterval>;
    const body = new ReadableStream<Uint8Array>({
      start(c) { timer = setInterval(() => {}, 60_000); c.enqueue(new TextEncoder().encode('event: job.state\n\n')); },
      cancel() { clearInterval(timer); cancelled = true; },
    });
    const first = once(out, 'chunk');
    if (cause === 'disconnect during backpressure') out.blocked = true;
    if (cause === 'already aborted signal') controller.abort();
    const pending = send(out.response, new Response(body), controller.signal);
    if (cause !== 'already aborted signal') {
      await first;
      if (cause === 'shutdown signal') controller.abort(); else out.emit('close');
    }
    await pending;
    assert.equal(cancelled, true);
    assert.equal(out.listenerCount('drain'), 0);
    assert.equal(out.listenerCount('close'), 0);
  });
}

test('a throwing response body rejects send instead of swallowing the error', async () => {
  const body = new ReadableStream<Uint8Array>({ start(c) { c.error(new Error('response source failed')); } });
  await assert.rejects(send(new Output().response, new Response(body), new AbortController().signal), /response source failed/);
});

test('a failed socket write cancels its still-open response body before rejecting', async () => {
  const out = new Output();
  out.write = () => { throw new Error('socket write failed'); };
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(c) { c.enqueue(new Uint8Array([1])); },
    cancel() { cancelled = true; },
  });
  await assert.rejects(send(out.response, new Response(body), new AbortController().signal), /socket write failed/);
  assert.equal(cancelled, true);
});

test('a response transport error cancels the reader and is reported to the caller', async () => {
  const out = new Output();
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } });
  const pending = send(out.response, new Response(body), new AbortController().signal);
  out.emit('error', new Error('socket failed'));
  await assert.rejects(pending, /socket failed/);
  assert.equal(cancelled, true);
});

test('a throwing response cancellation is reported to the caller', async () => {
  const controller = new AbortController();
  const body = new ReadableStream<Uint8Array>({ cancel() { throw new Error('cancel failed'); } });
  const pending = send(new Output().response, new Response(body), controller.signal);
  controller.abort();
  await assert.rejects(pending, /cancel failed/);
});
