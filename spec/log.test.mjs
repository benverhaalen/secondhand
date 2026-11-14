import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLog, summarize, contract } from './log.mjs';
import { replay } from './replay.mjs';
import { createLog, memorySink, httpSink, mask, MASK_WORDS, MASK_PATTERNS, MAX_INLINE } from '../log/index.js';
import { fileSink, requestLogger } from '../log/node.js';
import { runExample } from '../log/example.mjs';

const logDir = fileURLToPath(new URL('../log/', import.meta.url));
const hasPython = spawnSync('python3', ['--version']).status === 0;
const python = (code, input = '') => execFileSync('python3', ['-I', '-c', `import sys; sys.path.insert(0, ${JSON.stringify(logDir)})\n${code}`], { input, encoding: 'utf8' });
const fixed = () => new Date('2026-11-14T20:00:00.000Z');
const start = (over = {}) => { const sink = memorySink(); return { sink, log: createLog({ src: 'test', build: '0.0.0+test', sink, seed: 1, session: 's_test', now: fixed, ...over }) }; };
// Built by joining parts, so this file holds no string that looks like a real secret.
const KEY = 'sk-' + 'a1B2'.repeat(8), DBX = 'dapi' + '0f'.repeat(16), MAIL = 'pat' + '@example.com', PHONE = '608-555-' + '0123', HOME = '12 Oak Street';
const line = (seq, event, more = {}) => JSON.stringify({ ts: '2026-11-14T20:00:00.000Z', session: 's1', seq, src: 'test', level: 'info', event, ...more });
const good = [line(0, 'session.start', { build: 'b', seed: 1 }), line(1, 'ui.show', { screen: 'today' })];
const problemsOf = lines => checkLog(lines.join('\n')).problems.join('\n');

test('the worked example covers every event, follows the contract and replays against the lifecycle spec', async () => {
  const sinks = {}; await runExample(name => (sinks[name] = memorySink()));
  const text = Object.values(sinks).map(s => s.text()).join('');
  const { problems, warnings, events } = checkLog(text);
  assert.deepEqual(problems, []);
  assert.deepEqual(warnings, []);
  assert.deepEqual(replay(text, ['ebay', 'depop']).problems, []);
  const seen = new Set(events.map(e => e.event));
  assert.deepEqual(Object.keys(contract.events).filter(e => !seen.has(e)), [], 'add each new event to log/example.mjs');
  assert.ok(!text.includes('Oak Street'), 'typed words are masked');
});

test('personal data and secrets are masked by the writer, by key and inside any string', () => {
  const { sink, log } = start();
  log.event('note', { msg: `mail ${MAIL} call ${PHONE} key ${KEY} at ${HOME}`, headers: { Authorization: `Bearer ${KEY}`, 'x-id': 'ok' },
    buyer: { email: MAIL, shippingAddress: { line1: HOME }, id: 'by_1' }, items: [{ message: 'is this still available?' }, DBX], tokens_in: 12, undefinedField: undefined });
  const text = sink.text(), e = JSON.parse(sink.lines[1]);
  for (const raw of [MAIL, PHONE, KEY, DBX, HOME, 'still available']) assert.ok(!text.includes(raw), `${raw} reached the log`);
  assert.equal(e.msg, 'mail [email] call [phone] key [secret] at [address]');
  assert.deepEqual(e.headers, { Authorization: { masked: 'key' }, 'x-id': 'ok' });
  assert.deepEqual(e.buyer, { email: { masked: 'key' }, shippingAddress: { masked: 'key' }, id: 'by_1' });
  assert.deepEqual(e.items, [{ message: { masked: 'key' } }, '[secret]']);
  assert.equal(e.tokens_in, 12, 'a token count is not a token');
  assert.deepEqual(checkLog(text).problems, []);
});

test('the checker catches a line that leaks, even when the writer was bypassed', () => {
  const leak = more => problemsOf([...good.slice(0, 1), line(1, 'note', more)]);
  assert.match(leak({ msg: `reach me at ${MAIL}` }), /line 2: msg holds an email address/);
  assert.match(leak({ msg: 'x', to: PHONE }), /to holds a phone number/);
  assert.match(leak({ msg: 'x', auth: { key: KEY } }), /auth\.key holds a secret/);
  assert.match(leak({ msg: 'x', buyer: { address: HOME } }), /buyer\.address is a masked key but holds a value/);
  assert.equal(leak({ msg: 'x', buyer: { address: { masked: 'key' }, email: null } }), '');
});

test('the checker catches a broken log: unknown event, missing field, bad value, lost line, missing start, unfinished work', () => {
  assert.equal(problemsOf(good), '');
  assert.match(problemsOf(['{oops', ...good]), /line 1: not JSON/);
  assert.match(problemsOf([good[0], line(1, 'photo.taken', {})]), /photo\.taken is not in spec\/events\.json/);
  assert.match(problemsOf([good[0], line(1, 'ui.show', {})]), /ui\.show needs screen/);
  assert.match(problemsOf([good[0], line(1, 'job.state', { job: 'j', kind: 'post', state: 'paused' })]), /state "paused" is not one of queued, running, done, failed/);
  assert.match(problemsOf([good[0], line(1, 'job.state', { job: 'j', kind: 'post', state: 'failed' })]), /a failed job needs its error/);
  assert.match(problemsOf([good[0], line(2, 'ui.show', { screen: 'x' })]), /seq is 2, expected 1/);
  assert.match(problemsOf([line(0, 'ui.show', { screen: 'x' })]), /does not start with session\.start/);
  assert.match(problemsOf([good[0], JSON.stringify({ ...JSON.parse(good[1]), level: 'loud' })]), /level loud/);
  assert.match(problemsOf([good[0], line(1, 'item.action', { item: 'i', action: 'teleport', actor: 'user' })]), /teleport is not in spec\/lifecycle\.mjs/);
  assert.match(problemsOf([good[0], line(1, 'call.end', { call: 'c9', ok: true, ms: 1 })]), /call\.end for c9 has no call\.start/);
  assert.match(problemsOf([good[0], line(1, 'call.start', { call: 'c1', kind: 'http', name: 'x' }), line(2, 'call.end', { call: 'c1', ok: false, ms: 1 })]), /a failed call needs its error/);
  assert.match(problemsOf([good[0], line(1, 'session.end'), line(2, 'ui.show', { screen: 'x' })]), /wrote after session\.end/);
  const hanging = [good[0], line(1, 'call.start', { call: 'c1', kind: 'model', name: 'gpt' }), line(2, 'agent.start', { run: 'r1', agent: 'a' })];
  const crashed = checkLog(hanging.join('\n'));
  assert.deepEqual(crashed.problems, [], 'a session that crashed mid-call is a warning to read, not a broken log');
  assert.match(crashed.warnings.join('\n'), /call c1 \(model gpt, line 2\) never finished.*crashed or is still running/);
  assert.match(crashed.warnings.join('\n'), /run r1 \(a, line 3\) never finished/);
  assert.match(problemsOf([...hanging, line(3, 'session.end')]), /call c1 \(model gpt, line 2\) never finished/);
});

test('log.call logs the input, the result, the time and the error, and hands back what the call returned', async () => {
  let t = 0; const { sink, log } = start({ now: () => new Date(Date.UTC(2026, 10, 14) + (t += 50)) });
  const out = await log.call('model', 'gpt-6-luna', { q: 'category?' }, async ({ from }) => ({ label: 'jacket', p: 0.93, from }), o => ({ model: 'gpt-6-luna', cost_usd: 0.002, result: { label: o.label, p: o.p } }));
  assert.equal(out.label, 'jacket');
  assert.equal(out.from, 's_test#1', 'the call hands fn the link to its own start line');
  await assert.rejects(log.call('http', 'POST /x', {}, async () => { throw new TypeError('socket hang up'); }), /socket hang up/);
  const [, s1, e1, s2, e2] = sink.lines.map(l => JSON.parse(l));
  assert.deepEqual([s1.event, s1.call, s1.kind, s1.name, s1.input], ['call.start', 'c1', 'model', 'gpt-6-luna', { q: 'category?' }]);
  assert.deepEqual([e1.event, e1.call, e1.ok, e1.ms, e1.cost_usd, e1.result], ['call.end', 'c1', true, 100, 0.002, { label: 'jacket', p: 0.93 }]);
  assert.deepEqual([e2.call, e2.ok, e2.level, e2.error.type, e2.error.msg], ['c2', false, 'error', 'TypeError', 'socket hang up']);
  assert.equal(s2.call, 'c2');
  assert.deepEqual(checkLog(sink.text()).problems, []);
  const sum = summarize(checkLog(sink.text()).events);
  assert.deepEqual([sum.errors, sum.cost_usd, sum.calls['model gpt-6-luna'].n, sum.calls['http POST /x'].failed], [1, 0.002, 1, 1]);
});

test('a line survives a large value, a field named like the envelope, a failing sink and a value that is not data', () => {
  const blobs = []; const { sink, log } = start({ blob: (id, json) => blobs.push([id, json.length]) });
  const big = 'x'.repeat(MAX_INLINE + 1);
  const e = log.event('note', { msg: 'big', html: big, seq: 99, session: 'mine', fn: () => 1, when: new Date(0), bytes: new Uint8Array(3), n: NaN });
  assert.deepEqual([e.seq, e.session, e.html, e.when, e.bytes, e.n, 'fn' in e], [1, 's_test', { blob: 's_test-1-html' }, '1970-01-01T00:00:00.000Z', { bytes: 3 }, null, false]);
  assert.deepEqual(blobs, [['s_test-1-html', MAX_INLINE + 3]]);
  assert.ok(sink.lines.every(l => l.length < MAX_INLINE + 500));
  const loop = {}; loop.self = loop;
  assert.doesNotThrow(() => mask(loop));
  const broken = createLog({ src: 'test', build: 'b', sink: () => { throw new Error('disk full'); } });
  assert.doesNotThrow(() => broken.note('still running'));
  assert.throws(() => createLog({ src: 'test', sink: () => {} }), /needs src, build and sink/);
});

test('the same seed gives the same random numbers, so a run can be replayed', () => {
  const a = start({ seed: 42 }).log, b = start({ seed: 42 }).log, c = start({ seed: 43 }).log;
  const draw = l => [l.random(), l.random(), l.random()];
  const first = draw(a);
  assert.deepEqual(first, draw(b));
  assert.notDeepEqual(first, draw(c));
  assert.ok(first.every(x => x >= 0 && x < 1));
});

test('the app sink sends lines in batches and keeps them when a send fails', async () => {
  const sent = []; let fail = true;
  const sink = httpSink('https://server.example/api/log', { size: 2, everyMs: 5, fetch: async (url, req) => { if (fail) throw new Error('offline'); sent.push(req.body); return { ok: true }; } });
  sink('{"a":1}'); sink('{"a":2}');
  await new Promise(r => setTimeout(r, 20));
  assert.deepEqual(sent, [], 'nothing arrives while offline');
  fail = false; sink('{"a":3}'); await sink.flush();
  assert.deepEqual(sent, ['{"a":1}\n{"a":2}\n{"a":3}\n'], 'the kept lines go first, in order');
});

test('the file sink appends one line at a time, and the request logger logs each request with its answer', () => {
  const dir = mkdtempSync(join(tmpdir(), 'log-'));
  try {
    const path = join(dir, 'logs', 'server.jsonl'), log = createLog({ src: 'server', build: 'b', sink: fileSink(path) });
    const req = { method: 'POST', path: '/api/items', headers: { 'x-secondhand-from': 's_app#6' } }, res = Object.assign(new EventEmitter(), { statusCode: 500 });
    let nexted = false; requestLogger(log)(req, res, () => { nexted = true; });
    req.log.note('inside the handler'); res.emit('finish');
    const { problems, events } = checkLog(readFileSync(path, 'utf8'));
    assert.ok(nexted); assert.deepEqual(problems, []);
    assert.deepEqual(events.map(e => [e.event, e.req, e.level]), [['session.start', undefined, 'info'], ['request.start', 'q1', 'info'], ['note', 'q1', 'debug'], ['request.end', 'q1', 'error']]);
    assert.deepEqual([events[1].route, events[1].from, events[3].status], ['/api/items', 's_app#6', 500]);
    assert.deepEqual(readdirSync(join(dir, 'logs')), ['server.jsonl']);
  } finally { rmSync(dir, { recursive: true }); }
});

test('the JS writer repeats the contract exactly', () => {
  assert.deepEqual(MASK_WORDS, contract.maskWords);
  assert.deepEqual(MASK_PATTERNS, contract.maskPatterns);
  assert.equal(MAX_INLINE, contract.maxInline);
});

test('the Python writer repeats the contract and writes the same lines as the JS writer', { skip: !hasPython && 'python3 is not installed' }, () => {
  const py = JSON.parse(python('import json, secondhand_log as s; print(json.dumps([s.MASK_WORDS, s.MASK_PATTERNS, s.MAX_INLINE]))'));
  assert.deepEqual(py, [contract.maskWords, contract.maskPatterns, contract.maxInline]);
  const vector = [
    ['ui.show', { screen: 'today', state: 'card', item: 'it_1' }],
    ['user.input', { screen: 'capture', control: 'note', text: 'typed words', value: 3 }],
    ['note', { msg: `mail ${MAIL} call ${PHONE} key ${KEY} at ${HOME}`, headers: { Authorization: `Bearer ${KEY}`, apiKey: 'k', api_key: 'k', tokens_out: 9 } }],
    ['note', { msg: 'big', html: 'x'.repeat(MAX_INLINE + 1), seq: 99, list: [1, 'a', null, { phoneNumber: PHONE, deep: { ok: true, price: 12.5 } }] }],
    ['item.action', { item: 'it_1', action: 'post', actor: 'user', site: 'ebay', price: 60, floor: 50 }],
    ['job.state', { job: 'jb_1', kind: 'relight', state: 'failed', error: { type: 'Error', msg: `no reply from ${MAIL}` } }],
  ];
  const { sink, log } = start();
  for (const [name, fields] of vector) log.event(name, fields, name === 'job.state' ? 'error' : 'info');
  const out = python(`
import datetime, json, secondhand_log as s
sink = s.memory_sink()
log = s.create_log('test', '0.0.0+test', sink, seed=1, session='s_test', now=lambda: datetime.datetime(2026, 11, 14, 20, 0, 0, tzinfo=datetime.timezone.utc))
for name, fields in json.load(sys.stdin):
    log.event(name, fields, 'error' if name == 'job.state' else 'info')
sys.stdout.write(sink.text())`, JSON.stringify(vector));
  assert.deepEqual(out.trim().split('\n').map(l => JSON.parse(l)), sink.lines.map(l => JSON.parse(l)));
  assert.deepEqual(checkLog(out).problems, []);
});

test('a Python session with calls, an agent run and an error follows the contract', { skip: !hasPython && 'python3 is not installed' }, () => {
  const out = python(`
import asyncio, secondhand_log as s
sink = s.memory_sink()
log = s.create_log('job.relight', '0.0.0+test', sink, seed=5, origin='s_server#2').child(item='it_1', job='jb_1')
log.job('jb_1', 'relight', 'running')
run = log.agent('studio.relight', goal='keep the real logo')
run.step(action='render', why='no candidate yet')
out = run.call('model', 'seedream-5', {'scene': 'studio'}, lambda: {'image': 'rn_1', 'usd': 0.04}, lambda o: {'model': 'seedream-5', 'cost_usd': o['usd'], 'result': {'image': o['image']}})
assert out['image'] == 'rn_1'
async def post(): return {'url': 'https://depop.example/listing/1'}
asyncio.run(run.acall('browser', 'depop.post', {'item': 'it_1'}, post))
try:
    run.call('tool', 'repair', {'image': 'rn_1'}, lambda: 1 / 0)
except ZeroDivisionError as e:
    log.error('studio.repair', e)
run.end(ok=False, error={'type': 'GaveUp', 'msg': 'repair failed'})
log.job('jb_1', 'relight', 'failed', error={'type': 'GaveUp', 'msg': 'repair failed'})
assert log.random.random() == s.create_log('x', 'b', lambda l: None, seed=5).random.random()
log.end()
sys.stdout.write(sink.text())`);
  const { problems, warnings, events } = checkLog(out);
  assert.deepEqual(problems, []); assert.deepEqual(warnings, []);
  assert.deepEqual(events.map(e => e.event), ['session.start', 'job.state', 'agent.start', 'agent.step', 'call.start', 'call.end', 'call.start', 'call.end', 'call.start', 'call.end', 'error', 'agent.end', 'job.state', 'session.end']);
  assert.deepEqual([events[0].from, events[5].cost_usd, events[9].ok, events[9].error.type, events[11].steps, events[4].run, events[4].item], ['s_server#2', 0.04, false, 'ZeroDivisionError', 1, 'r1', 'it_1']);
});
