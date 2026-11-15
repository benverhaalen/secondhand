import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { SseFrame } from '../edge/api/jobs.ts';
import { createSseParser } from './sse.ts';

const frame = (id: number): SseFrame => ({ id, event: 'job.stage', data: { stage: 'search', state: 'running' } });
const encode = (f: SseFrame) => `id: ${f.id}\nevent: ${f.event}\ndata: ${JSON.stringify(f.data)}\n\n`;

test('a frame split across chunks waits for its final blank line', () => {
  const parser = createSseParser(), text = encode(frame(1));
  assert.deepEqual(parser.push(text.slice(0, -1)), []);
  assert.deepEqual(parser.push(text.slice(-1)), [frame(1)]);
});

test('three frames and half a fourth preserve the partial block for the next push', () => {
  const parser = createSseParser(), fourth = encode(frame(4)), half = Math.floor(fourth.length / 2);
  assert.deepEqual(parser.push([1, 2, 3].map(id => encode(frame(id))).join('') + fourth.slice(0, half)), [1, 2, 3].map(frame));
  assert.deepEqual(parser.push(fourth.slice(half)), [frame(4)]);
});

test('heartbeat comments between frames produce no frame', () => {
  const parser = createSseParser();
  assert.deepEqual(parser.push(`: heartbeat\n\n${encode(frame(1))}: heartbeat\n${encode(frame(2))}: heartbeat\n\n`), [frame(1), frame(2)]);
  assert.equal(parser.skipped, 0);
});

test('CRLF line endings work even when a chunk splits the CR and LF', () => {
  const parser = createSseParser(), text = encode(frame(1)).replaceAll('\n', '\r\n');
  assert.deepEqual(parser.push(text.slice(0, -1)), []);
  assert.deepEqual(parser.push(text.slice(-1)), [frame(1)]);
});

test('multiple data lines join with a newline before JSON parsing', () => {
  assert.deepEqual(createSseParser().push('id: 7\nevent: job.state\ndata: {"state":\ndata: "done"}\n\n'), [{ id: 7, event: 'job.state', data: { state: 'done' } }]);
});

test('invalid JSON is counted and skipped without losing the next valid frame', () => {
  const parser = createSseParser();
  assert.deepEqual(parser.push(`id: 1\nevent: job.state\ndata: broken\n\n${encode(frame(2))}`), [frame(2)]);
  assert.equal(parser.skipped, 1);
  assert.deepEqual(parser.push(''), []);
  assert.equal(parser.skipped, 1);
});

test('invalid ids and non-object JSON cannot enter the typed frame boundary', () => {
  const parser = createSseParser();
  assert.deepEqual(parser.push('id: nope\ndata: {}\n\nid: 2\ndata: null\n\nid: 3\ndata: []\n\n'), []);
  assert.equal(parser.skipped, 3);
});

test('the whole recorded fixture survives 64-byte chunks in its original order', () => {
  const fixture = JSON.parse(readFileSync(new URL('../buy/fixtures/search-live-levi.json', import.meta.url), 'utf8')) as { frames: SseFrame[] };
  const bytes = new TextEncoder().encode(fixture.frames.map(encode).join(''));
  const decoder = new TextDecoder(), parser = createSseParser(), frames: SseFrame[] = [];
  for (let i = 0; i < bytes.length; i += 64) frames.push(...parser.push(decoder.decode(bytes.slice(i, i + 64), { stream: true })));
  frames.push(...parser.push(decoder.decode()));
  assert.deepEqual(frames, fixture.frames);
  assert.equal(parser.skipped, 0);
});
