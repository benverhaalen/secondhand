// runs.mjs on planted logs in a temp dir. Run: node --test scripts/runs.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const runs = join(dirname(fileURLToPath(import.meta.url)), 'runs.mjs');
const dir = mkdtempSync(join(tmpdir(), 'runs-'));
const line = (seq, ms, event, extra = {}) => JSON.stringify({ ts: new Date(Date.UTC(2026, 10, 14, 12, 0, 0) + ms).toISOString(), session: 's1', seq, src: 'job.x', level: 'info', event, ...extra });
const write = (name, lines) => { const p = join(dir, name); writeFileSync(p, lines.join('\n') + '\n'); return p; };
const run = (...args) => spawnSync(process.execPath, [runs, ...args, '--out', dir], { encoding: 'utf8' });
const good = write('good.jsonl', [
  line(0, 0, 'session.start', { build: 'b1', seed: 1 }),
  line(1, 100, 'call.start', { call: 'c1', kind: 'http', name: 'ebay.list', item: 'it_1' }),
  line(2, 900, 'call.end', { call: 'c1', ok: true, ms: 800 }),
  line(3, 1000, 'session.end'),
]);

test('record writes <task>.md with steps, per-step and total time', () => {
  const r = run('record', 'T-1', '--log', good); assert.equal(r.status, 0, r.stderr);
  const md = readFileSync(join(dir, 'T-1.md'), 'utf8');
  assert.match(md, /call\.start/); assert.match(md, /ebay\.list/); assert.match(md, /it_1/);
  assert.match(md, /\+800 ms/); assert.match(md, /total[^\n]*1000 ms/i);
});
test('last prints the latest trace; no trace exits non-zero', () => {
  run('record', 'T-2', '--log', good);
  const r = run('last', 'T-2'); assert.equal(r.status, 0); assert.match(r.stdout, /ebay\.list/);
  assert.notEqual(run('last', 'never-recorded').status, 0);
});
test('ids with a colon become a safe file name', () => {
  assert.equal(run('record', 'rt-out:', '--log', good).status, 0);
  assert.ok(existsSync(join(dir, 'rt-out_.md')));
  assert.notEqual(run('record', '../escape', '--log', good).status, 0);
});
test('missing field listed under missing', () => {
  const bad = write('nofield.jsonl', [
    line(0, 0, 'session.start', { build: 'b1', seed: 1 }),
    line(1, 10, 'call.start', { call: 'c1', kind: 'http', name: 'x' }),
    line(2, 20, 'call.end', { call: 'c1', ok: true }),
    line(3, 30, 'session.end'),
  ]);
  assert.equal(run('record', 'T-3', '--log', bad).status, 0);
  const md = readFileSync(join(dir, 'T-3.md'), 'utf8');
  assert.match(md, /## Missing[\s\S]*call\.end[^\n]*\bms\b/);
});
test('not: a cookie, token, password or address reaches a trace', () => {
  const leaky = write('leaky.jsonl', [
    line(0, 0, 'session.start', { build: 'b1', seed: 1 }),
    line(1, 10, 'call.start', { call: 'c1', kind: 'http', name: 'GET with Bearer abcdefghijklmnop1234 for bob@example.com', headers: { cookie: 'sid=SECRETCOOKIE99' }, password: 'hunter2xyz', ship: '12 Main Street' }),
    line(2, 20, 'call.end', { call: 'c1', ok: true, ms: 10 }),
    line(3, 30, 'session.end'),
  ]);
  assert.equal(run('record', 'T-4', '--log', leaky).status, 0);
  const md = readFileSync(join(dir, 'T-4.md'), 'utf8');
  for (const s of ['SECRETCOOKIE99', 'hunter2xyz', 'abcdefghijklmnop1234', 'bob@example.com', 'Main Street']) assert.ok(!md.includes(s), s);
});
test('a log that is not a run fails and writes nothing', () => {
  const empty = write('empty.jsonl', []);
  assert.notEqual(run('record', 'T-5', '--log', empty).status, 0);
  assert.ok(!existsSync(join(dir, 'T-5.md')));
  assert.notEqual(run('record', 'T-6', '--log', join(dir, 'nope.jsonl')).status, 0);
});
