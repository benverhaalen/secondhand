import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLog } from './index.js';
import { createCrashRecorder, parseLines } from './crash.js';

test('persists shared masked events, captures errors, uploads once after restart', async () => {
  let disk = '', sent = ''; const printed = [], requests = [];
  const storage = { read: () => disk, append: s => { disk += s; }, sent: () => sent, acknowledge: s => { sent += s; } };
  const recorder = createCrashRecorder({ storage, build: '1', print: s => printed.push(s), origin: () => 'http://localhost', fetch: async (_url, options) => { requests.push(options); return { ok: true }; } });
  const ui = createLog({ src: 'app', build: '1', sink: () => {} });
  ui.input('sell', 'post', { text: 'private' });
  recorder.recordError(new TypeError('broken'), true);
  assert.equal(parseLines(disk).find(e => e.event === 'user.input').text.masked, 'key');
  const crash = recorder.readCrashes()[0];
  assert.equal(crash.error.type, 'TypeError'); assert.equal(crash.error.msg, 'broken');
  assert.equal(crash.event, 'error'); assert.equal(crash.fatal, true);
  assert.ok(printed[0].startsWith('SH_CRASH '));
  recorder.dispose();
  const next = createCrashRecorder({ storage, build: '1', print: () => {}, origin: () => 'http://localhost', fetch: async (_url, options) => { requests.push(options); return { ok: true }; } });
  await next.upload();
  assert.ok(parseLines(requests[0].body).some(e => e.session === crash.session && e.seq === crash.seq));
  await next.upload(); assert.equal(requests.length, 1);
  next.dispose();
});
test('torn lines do not hide the next complete entry', () => {
  const entry = { ts: '2026', session: 's', seq: 1, src: 'app', level: 'error', event: 'error' };
  assert.deepEqual(parseLines('{"torn":\n' + JSON.stringify(entry) + '\n'), [entry]);
});
test('console evidence survives a disk failure and handlers chain', () => {
  const printed = []; let handler, tracker, previous = false;
  const recorder = createCrashRecorder({ storage: { read: () => '', append: () => { throw new Error('disk full'); }, sent: () => '', acknowledge: () => {} }, build: 'test', print: line => printed.push(line), origin: () => null, fetch: async () => {} });
  recorder.install({ ErrorUtils: { getGlobalHandler: () => () => { previous = true; }, setGlobalHandler: fn => { handler = fn; } }, HermesInternal: { enablePromiseRejectionTracker: options => { tracker = options; } } }, () => {});
  handler(new Error('fatal'), true);
  tracker.onUnhandled(1, new Error('rejected'));
  assert.equal(previous, true);
  assert.equal(printed.length, 2);
  assert.equal(JSON.parse(printed[0].slice(9)).fatal, true);
  recorder.dispose();
});
