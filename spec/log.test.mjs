import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLog, summarize, replayActions, contract } from './log.mjs';
import { createLog, memorySink, httpSink, mask, maskText, isMaskedKey, MASK_WORDS, MASK_NOT_WHEN_LAST, MASK_PATTERNS, MAX_INLINE, BLOB_HEAD } from '../log/index.js';
import { fileSink, requestLogger } from '../log/node.js';
import { runExample } from '../log/example.mjs';

const logDir = fileURLToPath(new URL('../log/', import.meta.url)), checker = fileURLToPath(new URL('./log.mjs', import.meta.url));
const hasPython = spawnSync('python3', ['--version']).status === 0;
const python = (code, input = '') => execFileSync('python3', ['-I', '-c', `import sys; sys.path.insert(0, ${JSON.stringify(logDir)})\n${code}`], { input, encoding: 'utf8' });
const fixed = () => new Date('2026-11-14T20:00:00.000Z');
const start = (over = {}) => { const sink = memorySink(); return { sink, log: createLog({ src: 'test', build: '0.0.0+test', sink, seed: 1, session: 's_test', now: fixed, ...over }) }; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Built by joining parts, so this file holds no string that looks like a real secret.
const KEY = 'sk-' + 'a1B2'.repeat(8), DBX = 'dapi' + '0f'.repeat(16), STRIPE = 'sk_' + 'live_' + 'a1B2c3D4'.repeat(3), MAIL = 'pat' + '@example.com', PHONE = '608-555-' + '0123', HOME = '12 Oak Street';
// What must be masked inside a string, and what must be left alone because ordinary lines are full of it.
const LEAKS = [MAIL, PHONE, '(608)555-' + '0123', '608 555 ' + '0123', '+1608555' + '0123', '608 555 ' + '0123', KEY, DBX, STRIPE, `Bearer ${'x'.repeat(20)}`, `Bearer ${'x'.repeat(20)}`,
  'https://site.example/cb?access_token=' + 'abc123def456', HOME, '12 oak street', '500 5th Ave', '4242 4242 ' + '4242 4242'];
const PLAIN = ["Levi's 501 Jeans Size 32 Way Cool", 'Size 9 Black Dr Martens 1460', 'Nike Air Max 90 Triple White Court', 'secondhand@0.1.0+abc1234', '0.1.0+20261114093000', 'icon@2x.png',
  'react-native@0.81.4', '2026-11-14T20:00:00.000Z', '2026-11-14 20:00:00', '$1,234.50', 'https://ebay.example/itm/123456789012?var=5', '1700000000000', 's_mwgx7wn0hb9lvv#12'];
const MASKED_KEYS = ['token', 'access_token', 'Authorization', 'apiKey', 'api_key', 'x-api-key', 'APIKey', 'userName', 'user_name', 'messages', 'cookies', 'prompt', 'pwd', 'shippingAddress', 'addresses', 'buyerEmail', 'phoneNumber', 'text', 'body', 'content', 'card'];
const PLAIN_KEYS = ['ms', 'card_ms', 'message_id', 'messageIds', 'content_type', 'token_count', 'tokens_in', 'tokens_out', 'email_hash', 'context', 'build', 'input', 'result', 'title', 'name', 'price'];
const line = (seq, event, more = {}) => JSON.stringify({ ts: '2026-11-14T20:00:00.000Z', session: 's1', seq, src: 'test', level: 'info', event, ...more });
const good = [line(0, 'session.start', { build: 'b', seed: 1 }), line(1, 'ui.show', { screen: 'today' })];
const problemsOf = lines => checkLog(lines.join('\n')).problems.join('\n');

test('the worked example covers every event, follows the contract and replays against the lifecycle spec', async () => {
  const sinks = {}; await runExample(name => (sinks[name] = memorySink()));
  const text = Object.values(sinks).map(s => s.text()).join('');
  const { problems, warnings, events } = checkLog(Object.entries(sinks).map(([name, s]) => [name, s.text()]));
  assert.deepEqual(problems, []);
  assert.deepEqual(warnings, []);
  assert.deepEqual(replayActions(events, ['ebay', 'depop']), []);
  const seen = new Set(events.map(e => e.event));
  assert.deepEqual(Object.keys(contract.events).filter(e => !seen.has(e)), [], 'add each new event to log/example.mjs');
  assert.ok(!text.includes('Oak Street'), 'typed words are masked');
  assert.ok(!text.includes('"masked":"key"}') || !/"(card_ms|ms|tokens_in)":\{"masked"/.test(text), 'the contract\'s own fields are never masked');
  assert.equal(events.find(e => e.event === 'decision.answer').card_ms, 4200);
});

test('personal data and secrets are masked by the writer, by key and inside any string, and ordinary values are left alone', () => {
  for (const k of MASKED_KEYS) assert.ok(isMaskedKey(k), `${k} should be a masked key`);
  for (const k of PLAIN_KEYS) assert.ok(!isMaskedKey(k), `${k} should not be a masked key`);
  for (const s of LEAKS) assert.ok(!maskText(`a ${s} b`).includes(s), `${s} got through`);
  for (const s of PLAIN) assert.equal(maskText(s), s, `${s} was wrecked`);
  const { sink, log } = start();
  const e = log.event('note', { msg: `mail ${MAIL} call ${PHONE} key ${KEY} at ${HOME}`, headers: { Authorization: `Bearer ${KEY}`, 'x-id': 'ok' }, [MAIL]: 1,
    buyer: { email: MAIL, shippingAddress: { line1: HOME }, id: 'by_1' }, items: [{ message: 'is this still available?' }, DBX], tokens_in: 12, card_ms: 900, leaks: LEAKS, plain: PLAIN, undefinedField: undefined });
  const text = sink.text();
  for (const raw of [...LEAKS, 'still available']) assert.ok(!text.includes(raw), `${raw} reached the log`);
  assert.equal(e.msg, 'mail [email] call [phone] key [secret] at [address]');
  assert.deepEqual(e.headers, { Authorization: { masked: 'key' }, 'x-id': 'ok' });
  assert.deepEqual(e.buyer, { email: { masked: 'key' }, shippingAddress: { masked: 'key' }, id: 'by_1' });
  assert.deepEqual(e.items, [{ message: { masked: 'key' } }, '[secret]']);
  assert.deepEqual([e.tokens_in, e.card_ms, e['[email]'], e.plain], [12, 900, 1, PLAIN]);
  assert.deepEqual(checkLog(text).problems, []);
});

test('masking a large value with no match stays fast', () => {
  const t0 = Date.now();
  for (const big of ['a'.repeat(300_000), '0123456789abcdef'.repeat(20_000), 'aZ09_-'.repeat(50_000)]) assert.equal(maskText(big), big);
  assert.ok(Date.now() - t0 < 2000, `took ${Date.now() - t0} ms`);
});

test('the checker catches a line that leaks, even when the writer was bypassed', () => {
  const leak = more => problemsOf([...good.slice(0, 1), line(1, 'note', more)]);
  assert.match(leak({ msg: `reach me at ${MAIL}` }), /line 2: msg holds an email address/);
  assert.match(leak({ msg: 'x', to: PHONE }), /to holds a phone number/);
  assert.match(leak({ msg: 'x', auth: { key: KEY } }), /auth\.key holds a secret/);
  assert.match(leak({ msg: 'x', buyer: { address: HOME } }), /buyer\.address is a masked key but holds a value/);
  assert.match(leak({ msg: 'x', headers: { apiKey: 'k' } }), /headers\.apiKey is a masked key/);
  assert.match(leak({ msg: 'x', _raw: MAIL }), /_raw holds an email address/);
  assert.match(leak({ msg: 'x', seen: { [MAIL]: true } }), /a key under seen holds an email address/);
  assert.equal(leak({ msg: 'x', buyer: { address: { masked: 'key' }, email: null } }), '');
});

test('the checker catches a broken log: unknown event, missing or mistyped field, lost line, bad order, unfinished work, nothing at all', () => {
  assert.equal(problemsOf(good), '');
  assert.equal(problemsOf(['﻿' + good[0] + '\r', good[1] + '\r']), '', 'a byte order mark and Windows line endings are fine');
  assert.match(problemsOf([]), /no log lines/);
  assert.match(problemsOf(['{oops', ...good]), /line 1: not JSON/);
  assert.match(problemsOf([good[0], line(1, 'photo.taken', {})]), /photo\.taken is not in spec\/events\.json/);
  assert.match(problemsOf([good[0], line(1, 'ui.show', {})]), /ui\.show needs screen/);
  assert.match(problemsOf([good[0], line(1, 'ui.show', { screen: null })]), /ui\.show needs screen/);
  assert.match(problemsOf([line(0, 'session.start', { build: null, seed: null })]), /session\.start needs build, seed/);
  assert.match(problemsOf([good[0], line(1, 'ui.show', { screen: 'x', src: { a: 1 } })]), /session and src are strings/);
  assert.match(problemsOf([good[0], line(1, 'call.start', { call: 'c1', kind: 'http', name: 'x' }), line(2, 'call.end', { call: 'c1', ok: 'yes', ms: 'fast' })]), /ms must be number, got string[\s\S]*ok must be boolean, got string/);
  assert.match(problemsOf([good[0], line(1, 'job.state', { job: 'j', kind: 'post', state: 'paused' })]), /state "paused" is not one of queued, running, done, failed/);
  assert.match(problemsOf([good[0], line(1, 'job.state', { job: 'j', kind: 'post', state: 'failed' })]), /a failed job needs its error/);
  assert.match(problemsOf([good[0], line(2, 'ui.show', { screen: 'x' })]), /seq is 2, expected 1/);
  assert.match(problemsOf([line(0, 'ui.show', { screen: 'x' })]), /does not start with session\.start/);
  assert.match(problemsOf([good[0], line(1, 'session.start', { build: 'b', seed: 2 })]), /session\.start is only ever the first line/);
  assert.match(problemsOf([good[0], JSON.stringify({ ...JSON.parse(good[1]), level: 'loud' })]), /level loud/);
  assert.match(problemsOf([good[0], line(1, 'item.action', { item: 'i', action: 'teleport', actor: 'user' })]), /teleport is not in spec\/lifecycle\.mjs/);
  assert.match(problemsOf([good[0], line(1, 'call.end', { call: 'c9', ok: true, ms: 1 })]), /call\.end for c9 has no call\.start/);
  assert.match(problemsOf([good[0], line(1, 'call.start', { call: 'c1', kind: 'http', name: 'x' }), line(2, 'call.end', { call: 'c1', ok: false, ms: 1 })]), /a failed call needs its error/);
  assert.match(problemsOf([good[0], line(1, 'agent.start', { run: 'r1', agent: 'a' }), line(2, 'agent.end', { run: 'r1', ok: true, steps: 0, ms: 1 }), line(3, 'agent.step', { run: 'r1', n: 1 })]), /agent\.step for run r1 comes after its agent\.end/);
  assert.match(problemsOf([good[0], line(1, 'session.end'), line(2, 'ui.show', { screen: 'x' })]), /wrote after session\.end/);
  const hanging = [good[0], line(1, 'call.start', { call: 'c1', kind: 'model', name: 'gpt' }), line(2, 'agent.start', { run: 'r1', agent: 'a' }), line(3, 'request.start', { req: 'q1', method: 'POST', route: '/hooks/ebay' })];
  const crashed = checkLog(hanging.join('\n'));
  assert.deepEqual(crashed.problems, [], 'a session that crashed mid-call is a warning to read, not a broken log');
  assert.match(crashed.warnings.join('\n'), /call c1 \(model gpt, line 2\) never finished.*crashed or is still running/);
  assert.match(crashed.warnings.join('\n'), /run r1 \(a, line 3\) never finished/);
  assert.match(crashed.warnings.join('\n'), /request q1 \(POST \/hooks\/ebay, line 4\) never finished/);
  assert.match(problemsOf([...hanging, line(4, 'session.end')]), /call c1 \(model gpt, line 2\) never finished/);
  assert.match(checkLog([...good, line(2, 'decision.answer', { decision: 'dc_9', option: 'post' })].join('\n')).warnings.join(), /decision dc_9 was answered or closed but never opened/);
});

test('the command names the file and line, fails on an empty or broken log, and survives a missing --sites value', () => {
  const dir = mkdtempSync(join(tmpdir(), 'log-'));
  const run = (...args) => spawnSync(process.execPath, [checker, ...args], { encoding: 'utf8' });
  try {
    const a = join(dir, 'a.jsonl'), b = join(dir, 'b.jsonl'), empty = join(dir, 'empty.jsonl');
    writeFileSync(a, good.join('\n') + '\n'); writeFileSync(empty, '');
    writeFileSync(b, [line(0, 'session.start', { build: 'b', seed: 1 }), line(1, 'ui.show', {})].map(l => l.replace('"s1"', '"s2"')).join('\n') + '\n');
    assert.deepEqual([run(a).status, run(a).stdout.includes('log follows the contract')], [0, true]);
    const two = run(a, b);
    assert.equal(two.status, 1);
    assert.match(two.stdout, /ERROR .*b\.jsonl:2: ui\.show needs screen/);
    assert.deepEqual([run(empty).status, /no log lines/.test(run(empty).stdout)], [1, true]);
    assert.deepEqual([run(a, '--sites').status, /usage/.test(run(a, '--sites').stderr)], [2, true]);
  } finally { rmSync(dir, { recursive: true }); }
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

test('the logger never throws into the program and never leaves a gap, whatever it is handed', async () => {
  const blobs = []; const { sink, log } = start({ blob: (id, json) => blobs.push([id, json.length]) });
  const big = 'x'.repeat(MAX_INLINE + 1), loop = {}; loop.self = loop;
  const e = log.event('note', { msg: 'big', html: big, seq: 99, session: 'mine', fn: () => 1, when: new Date(0), never: new Date('garbage'), bytes: new Uint8Array(3), n: NaN,
    map: new Map([['a', 1]]), set: new Set([1, 2]), url: new URL('https://site.example/a?token=' + 'abcdefgh'), loop, get boom() { throw new Error('no'); } });
  assert.deepEqual([e.seq, e.session, e.when, e.never, e.bytes, e.n, 'fn' in e, e.map, e.set, e.url, e.boom], [1, 's_test', '1970-01-01T00:00:00.000Z', null, { bytes: 3 }, null, false, { a: 1 }, [1, 2], 'https://site.example/a?[secret]', '[unreadable]']);
  assert.deepEqual(e.html, { blob: 's_test-1-html', chars: MAX_INLINE + 3, head: '"' + 'x'.repeat(BLOB_HEAD - 1) }, 'a cut value keeps its size and its start on the line');
  assert.deepEqual(blobs, [['s_test-1-html', MAX_INLINE + 3]]);
  assert.ok(sink.lines.every(l => l.length < MAX_INLINE + 1000));
  // the outside call is made once, its result comes back, and call.end is written, even when the result cannot be read or described
  let made = 0;
  const out = await log.call('http', 'GET /x', {}, async () => { made++; return { get bad() { throw new Error('no'); }, fine: 1 }; });
  await log.call('http', 'GET /y', {}, async () => 7, () => { throw new Error('describe broke'); });
  await log.call('http', 'GET /z', {}, async () => 7, () => 'kept');
  await log.call('http', 'GET /u', {}, async () => undefined);
  const ends = sink.lines.map(l => JSON.parse(l)).filter(l => l.event === 'call.end');
  assert.deepEqual([made, out.fine, ends.length, ends[0].result, ends[1].describe_error.msg, ends[2].result, ends[3].ok], [1, 1, 4, { bad: '[unreadable]', fine: 1 }, 'describe broke', 'kept', true]);
  for (const bad of [null, undefined, 5, 'x', new Proxy({}, { ownKeys() { throw new Error('no keys'); } })]) assert.doesNotThrow(() => { log.note('m', bad); log.show('s', bad); log.child(bad).note('c'); log.agent('a', bad).end(bad); });
  const { problems, events } = checkLog(sink.text());
  assert.deepEqual(problems, []);
  assert.deepEqual(events.map(l => l.seq), events.map((_, i) => i), 'no gaps');
  const broken = createLog({ src: 'test', build: 'b', sink: () => { throw new Error('disk full'); }, now: () => { throw new Error('no clock'); } });
  assert.doesNotThrow(() => broken.note('still running'));
  assert.throws(() => createLog({ src: 'test', sink: () => {} }), /needs src, build and sink/);
  const odd = start({ seed: null, session: 5 }).sink;
  assert.deepEqual(checkLog(odd.text()).problems, [], 'a bad seed or session is replaced, not written');
});

test('the same seed gives the same random numbers, so a run can be replayed', () => {
  const a = start({ seed: 42 }).log, b = start({ seed: 42 }).log, c = start({ seed: 43 }).log;
  const draw = l => [l.random(), l.random(), l.random()];
  const first = draw(a);
  assert.deepEqual(first, draw(b));
  assert.notDeepEqual(first, draw(c));
  assert.ok(first.every(x => x >= 0 && x < 1));
});

test('the app sink sends every line: in batches, after a failed send without waiting for a new line, and when one arrives mid-send', async () => {
  const sent = []; let fail = true, release;
  const sink = httpSink('https://server.example/api/log', { size: 2, everyMs: 5, fetch: async (url, req) => { if (fail) throw new Error('offline'); if (release) await release; sent.push(req.body); return { ok: true }; } });
  sink('{"a":1}'); sink('{"a":2}');
  await sleep(20);
  assert.deepEqual(sent, [], 'nothing arrives while offline');
  fail = false; await sleep(30);
  assert.deepEqual(sent, ['{"a":1}\n{"a":2}\n'], 'the kept lines are retried on the timer, with no new line needed');
  let open; release = new Promise(r => { open = r; });
  sink('{"a":3}'); sink('{"a":4}'); // a full batch: the send starts and waits
  await sleep(5); sink('{"a":5}'); // arrives while that send is in flight
  open(); release = null; await sink.flush();
  assert.deepEqual(sent.slice(1), ['{"a":3}\n{"a":4}\n', '{"a":5}\n']);
  const one = httpSink('https://server.example/api/log', { fetch: async (url, req) => { sent.push(req.body); return { ok: true }; } });
  one('{"last":1}'); await one.flush();
  assert.equal(sent.at(-1), '{"last":1}\n', 'flush sends at once, for the line written just before a crash or going to the background');
});

test('the file sink appends one line at a time, and the request logger logs each request with its input and its answer', () => {
  const dir = mkdtempSync(join(tmpdir(), 'log-'));
  try {
    const path = join(dir, 'logs', 'server.jsonl'), log = createLog({ src: 'server', build: 'b', sink: fileSink(path) });
    const use = requestLogger(log), fake = (more, statusCode) => [{ method: 'POST', headers: {}, ...more }, Object.assign(new EventEmitter(), { statusCode })];
    const [req, res] = fake({ path: '/hooks/ebay', headers: { 'x-secondhand-from': 's_app#6' }, query: { topic: 'ORDER_CONFIRMATION' }, body: { orderId: 'o_1', buyer: { email: MAIL }, shippingAddress: HOME } }, 500);
    let nexted = false; use(req, res, () => { nexted = true; });
    req.log.note('inside the handler'); res.emit('finish'); res.emit('close');
    const [req2, res2] = fake({ path: '/api/items' }, 200); use(req2, res2, () => {}); res2.emit('close'); // the caller went away
    const text = readFileSync(path, 'utf8'), { problems, events } = checkLog(text);
    assert.ok(nexted); assert.deepEqual(problems, []);
    assert.deepEqual(events.map(e => [e.event, e.req, e.level]), [['session.start', undefined, 'info'], ['request.start', 'q1', 'info'], ['note', 'q1', 'debug'], ['request.end', 'q1', 'error'], ['request.start', 'q2', 'info'], ['request.end', 'q2', 'error']]);
    assert.deepEqual([events[1].route, events[1].from, events[1].query, events[1].input, events[3].status, events[5].aborted],
      ['/hooks/ebay', 's_app#6', { topic: 'ORDER_CONFIRMATION' }, { orderId: 'o_1', buyer: { email: { masked: 'key' } }, shippingAddress: { masked: 'key' } }, 500, true]);
    assert.deepEqual(readdirSync(join(dir, 'logs')), ['server.jsonl']);
  } finally { rmSync(dir, { recursive: true }); }
});

test('the JS writer repeats the contract exactly', () => {
  assert.deepEqual([MASK_WORDS, MASK_NOT_WHEN_LAST, MASK_PATTERNS, MAX_INLINE, BLOB_HEAD], [contract.maskWords, contract.maskNotWhenLast, contract.maskPatterns, contract.maxInline, contract.blobHead]);
});

test('the Python writer repeats the contract and writes the same lines as the JS writer', { skip: !hasPython && 'python3 is not installed' }, () => {
  const py = JSON.parse(python('import json, secondhand_log as s; print(json.dumps([s.MASK_WORDS, s.MASK_NOT_WHEN_LAST, s.MASK_PATTERNS, s.MAX_INLINE, s.BLOB_HEAD]))'));
  assert.deepEqual(py, [contract.maskWords, contract.maskNotWhenLast, contract.maskPatterns, contract.maxInline, contract.blobHead]);
  const vector = [
    ['ui.show', { screen: 'today', state: 'card', item: 'it_1' }],
    ['user.input', { screen: 'capture', control: 'note', text: 'typed words', value: 3 }],
    ['state.change', { entity: 'conversation', id: 'cv_1', to: 'answered', was: null }],
    ['note', { msg: `mail ${MAIL} call ${PHONE} key ${KEY} at ${HOME}`, leaks: LEAKS, plain: PLAIN, [MAIL]: 1 }],
    ['note', { msg: 'keys', ...Object.fromEntries([...MASKED_KEYS, ...PLAIN_KEYS].filter(k => !(k in contract.types)).map(k => [k, 'v'])) }],
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

test('a Python session with calls, an agent run, threads and odd values follows the contract and leaks nothing', { skip: !hasPython && 'python3 is not installed' }, () => {
  const out = python(`
import asyncio, dataclasses, decimal, threading, secondhand_log as s
sink = s.memory_sink()
log = s.create_log('job.relight', '0.0.0+test', sink, seed=5, origin='s_server#2', config={'model': 'seedream-5'}).child({'item': 'it_1'}, job='jb_1')
log.job('jb_1', 'relight', 'running')
run = log.agent('studio.relight', goal='keep the real logo')
run.step(action='render', why='no candidate yet')
out = run.call('model', 'seedream-5', {'scene': 'studio'}, lambda: {'image': 'rn_1', 'usd': 0.04}, lambda o: {'model': 'seedream-5', 'cost_usd': o['usd'], 'result': {'image': o['image']}})
assert out['image'] == 'rn_1'
async def post(ctx): return {'url': 'https://depop.example/listing/1', 'from': ctx['from']}
posted = asyncio.run(run.acall('browser', 'depop.post', {'item': 'it_1'}, post))
assert posted['from'] == log.session + '#6', posted
try:
    run.call('tool', 'repair', {'image': 'rn_1'}, lambda: 1 / 0)
except ZeroDivisionError as e:
    log.error('studio.repair', e)
@dataclasses.dataclass
class Resp:
    id: str
    api_key: str
    content: str
class Plain:
    def __init__(self): self.id, self.password, self._private = 'p1', 'hunter2', 'x'
class Loud:
    def __repr__(self): raise RuntimeError('no repr')
assert run.call('tool', 'odd', {}, lambda: 7, lambda o: None) == 7
assert run.call('tool', 'odd', {}, lambda: 7, lambda o: 'kept') == 7
log.note('odd', r=Resp('r1', 'abc123secretvalue', 'Dear Pat Smith'), p=Plain(), price=decimal.Decimal('10'), half=decimal.Decimal('10.5'), loud=Loud(), bad='\\ud83d', fn=len)
sys.setswitchinterval(1e-6)  # switch threads as often as possible, so a missing lock shows
threads = [threading.Thread(target=lambda: [log.note('t') for _ in range(100)]) for _ in range(8)]
[t.start() for t in threads]; [t.join() for t in threads]
run.end(ok=False, error={'type': 'GaveUp', 'msg': 'repair failed'})
log.job('jb_1', 'relight', 'failed', error={'type': 'GaveUp', 'msg': 'repair failed'})
assert log.random.random() == s.create_log('x', 'b', lambda l: None, seed=5).random.random()
log.end()
sys.stdout.write(sink.text())`);
  const { problems, warnings, events } = checkLog(out);
  assert.deepEqual(problems, []); assert.deepEqual(warnings, []);
  for (const raw of ['abc123secretvalue', 'Pat Smith', 'hunter2', 'Resp(', 'Decimal']) assert.ok(!out.includes(raw), `${raw} reached the log`);
  const odd = events.find(e => e.msg === 'odd');
  assert.deepEqual([odd.r, odd.p, odd.price, odd.half, odd.loud, 'fn' in odd], [{ id: 'r1', api_key: { masked: 'key' }, content: { masked: 'key' } }, { id: 'p1', password: { masked: 'key' } }, 10, 10.5, {}, false]);
  assert.equal(events.filter(e => e.msg === 't').length, 800, 'eight threads, no lost or repeated sequence numbers');
  assert.deepEqual([events[0].from, events[0].config, events[1].item, events[1].job, events[5].cost_usd, events[9].ok, events[9].error.type], ['s_server#2', { model: 'seedream-5' }, 'it_1', 'jb_1', 0.04, false, 'ZeroDivisionError']);
  const ends = events.filter(e => e.event === 'call.end'), last = events.at(-3);
  assert.deepEqual([ends[3].result, ends[4].result, last.event, last.steps, last.ok], [null, 'kept', 'agent.end', 1, false]);
});
