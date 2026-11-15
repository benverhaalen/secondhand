// prove.mjs against a fixture plan, never the real plan's checks. Run: node --test scripts/prove.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const prove = join(dirname(fileURLToPath(import.meta.url)), 'prove.mjs');
const dir = mkdtempSync(join(tmpdir(), 'prove-'));
const js = (code, expectExit = 0) => ({ argv: ['node', '-e', code], expectExit });
const breaks = [{ what: 'a thing breaks', test: 'x.test.mjs: boom case', code: 'BOOM' }, { what: 'other', test: 'y.test.mjs: other', code: 'NOPE' }];
const plan = { tasks: [
  { id: 'ok-1', wave: 0, check: js('process.exit(0)') },
  { id: 'bad-1', wave: 0, check: js('console.log("BOOM happened");process.exit(1)'), breaks },
  { id: 'five-1', wave: 0, check: js('process.exit(5)') },
  { id: 'nocheck-1', wave: 0 },
  { id: 'empty-1', wave: 0, check: { argv: [], expectExit: 0 } },
  { id: 'rt-out:', wave: 0, check: js('process.exit(0)') },
  { id: 'w1-bad', wave: 1, check: js('process.exit(1)') },
  { id: 'w1-ok', wave: 1, check: js('process.exit(0)') },
] };
const planPath = join(dir, 'plan.json');
writeFileSync(planPath, JSON.stringify(plan));
const okWalk = join(dir, 'walk-ok.mjs'); writeFileSync(okWalk, 'process.exit(0)');
const run = (...args) => spawnSync(process.execPath, [prove, '--plan', planPath, ...args], { encoding: 'utf8', env: { ...process.env, PROVE_RUNNING: '' } });
const out = r => r.stdout + r.stderr;

test('--task passing task exits 0', () => {
  const r = run('--task', 'ok-1'); assert.equal(r.status, 0, out(r));
});
test('colon ids are opaque strings', () => {
  const r = run('--task', 'rt-out:'); assert.equal(r.status, 0, out(r));
});
test('unknown task id exits non-zero', () => assert.notEqual(run('--task', 'nope').status, 0));
test('wave fails when one task fails, and names it', () => {
  const r = run('--wave', '0'); assert.notEqual(r.status, 0);
  assert.match(out(r), /bad-1/);
  assert.doesNotMatch(out(r), /w1-bad/);
});
test('exit 5 fails', () => {
  const r = run('--task', 'five-1'); assert.notEqual(r.status, 0); assert.match(out(r), /five-1/);
});
test('not: a missing check is never reported as passing', () => {
  for (const id of ['nocheck-1', 'empty-1']) {
    const r = run('--task', id); assert.notEqual(r.status, 0, id); assert.match(out(r), /no check/i);
  }
});
test('failure grouped with breaks: matching entry flagged, others listed', () => {
  const r = run('--task', 'bad-1'), o = out(r);
  assert.match(o, /breaks: a thing breaks .*boom case.*BOOM.*matches/);
  assert.match(o, /breaks: other/); assert.doesNotMatch(o, /other.*matches/);
});
test('wave 1 runs the walk first-class: a missing walk fails the wave', () => {
  const r = run('--wave', '1', '--walk', join(dir, 'missing-walk.mjs')); assert.notEqual(r.status, 0); assert.match(out(r), /walk/);
});
test('wave 1 with a passing walk: only the task failure remains', () => {
  const r = run('--wave', '1', '--walk', okWalk); assert.match(out(r), /w1-bad/); assert.doesNotMatch(out(r), /FAIL walk/);
});
test('wave 0 does not run the walk', () => {
  const r = run('--wave', '0', '--walk', join(dir, 'missing-walk.mjs')); assert.doesNotMatch(out(r), /walk/);
});
test('no mode flag exits 2 with usage', () => {
  const r = run(); assert.equal(r.status, 2); assert.match(out(r), /--wave/);
});
test('--note needs (a) (b) (c) and a diff list', () => {
  const good = join(dir, 'good.md'); writeFileSync(good, '(a) one\n(b) two\n(c) three\n## Diff\n- file.mjs\n');
  const bad = join(dir, 'bad.md'); writeFileSync(bad, '(a) one\n(c) three\n## Diff\n');
  assert.equal(run('--note', good).status, 0);
  const r = run('--note', bad); assert.notEqual(r.status, 0); assert.match(out(r), /\(b\)/); assert.match(out(r), /diff/i);
  assert.notEqual(run('--note', join(dir, 'absent.md')).status, 0);
});
test('--tune runs the walk and the engine tasks', () => {
  const r = run('--tune', 'bad', '--walk', okWalk); assert.notEqual(r.status, 0); assert.match(out(r), /bad-1/);
});

test('a run started from inside a run refuses, so a check that calls prove.mjs cannot recurse', () => {
  const r = spawnSync(process.execPath, [prove, '--plan', planPath, '--wave', '0'], { encoding: 'utf8', env: { ...process.env, PROVE_RUNNING: '1' } });
  assert.equal(r.status, 3);
  assert.match(r.stderr, /refused/);
});
