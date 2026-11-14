import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { check, run } from './run.mjs';
import { createLog, memorySink } from '../../../log/index.js';
import { checkLog } from '../../../spec/log.mjs';

const job = (id, more = {}) => ({ id, prompt: `make ${id}`, ...more });
const quiet = () => ({ load1: 0, cpu: 0, mem: 0 });
const img = (file, more = {}) => ({ file, take: 'the colors.', ...more });
const of = (id, more = {}) => ({ job: id, take: 'this screen. Edit it.', ...more });
// Stands in for the Codex CLI: records what each call was given, waits, then leaves the files a real call would.
function fake({ ms = 15, files = () => ['image.png'] } = {}) {
  const calls = []; let now = 0, peak = 0;
  const exec = async call => {
    calls.push({ ...call, found: readdirSync(call.folder) });
    peak = Math.max(peak, ++now);
    await new Promise(r => setTimeout(r, ms));
    for (const f of files(call)) writeFileSync(join(call.folder, f), 'x');
    now--;
    return 'tokens used: 1,200';
  };
  return { exec, calls, peak: () => peak };
}
const plan = (jobs, more = {}) => ({ out: mkdtempSync(join(tmpdir(), 'image-run-')), jobs, ...more });
const go = (p, f, more = {}) => run(p, { exec: f.exec, probe: quiet, tickMs: 5, ...more });

test('check refuses a plan that breaks a context rule', () => {
  const bad = (jobs, word) => assert.match(check({ out: 'x', jobs }).join('\n'), word);
  bad([job('a'), job('a')], /twice/);
  bad([job('a', { after: ['b'] })], /waits for b/);
  bad([job('a', { inputs: ['1', '2', '3', '4', '5', '6'].map(f => img(f)) })], /5 images/);
  bad([job('a', { prompt: 'Read the constitution.md and judge' })], /rule doc/);
  bad([job('a', { prompt: 'Look in /Users/pat/refs for more' })], /names a path/);
  bad([job('a', { prompt: 'x'.repeat(3001) })], /3000/);
  bad([job('a', { after: ['b'] }), job('b', { after: ['a'] })], /circle/);
  bad([job('a'), job('b', { inputs: [of('a')] })], /does not wait/);
  bad([job('a', { inputs: [{ file: 'ref.jpg' }] })], /what to take/);
  bad([job('a', { inputs: [img('ref.jpg', { ref: true })] })], /what not to copy/);
  assert.deepEqual(check({ out: 'x', jobs: [job('a', { prompt: 'listed at $45/offered $38, w/o a frame' }), job('b', { after: ['a'], inputs: [of('a'), img('ref.jpg', { ref: true, leave: 'its layout and words.' })] })] }), []);
});

test('every call starts in its own empty folder, and never more than max run at once', async () => {
  const f = fake(), p = plan(['a', 'b', 'c', 'd', 'e', 'f'].map(id => job(id)), { max: 2, ramp: 9 });
  const done = await go(p, f);
  assert.equal(f.calls.length, 6);
  assert.equal(new Set(f.calls.map(c => c.folder)).size, 6);
  assert.ok(f.calls.every(c => c.found.length === 0), 'a folder held files when its call started');
  assert.equal(f.peak(), 2);
  assert.equal(done.failed, 0);
  assert.equal(done.peak.running, 2);
});

test('an edit waits for its base and is handed the base image', async () => {
  const f = fake(), p = plan([job('edit', { after: ['base'], inputs: [of('base'), img('/refs/colors.png', { ref: true, leave: 'its layout.' })] }), job('base')]);
  await go(p, f);
  assert.deepEqual(f.calls.map(c => c.id), ['base', 'edit']);
  assert.deepEqual(f.calls[1].inputs, [join(p.out, 'base', 'image.png'), resolve('/refs/colors.png')]);
  assert.match(f.calls[1].prompt, /^make edit\n\nAttached images, in order:\n1\. this screen\. Edit it\.\n2\. the colors\. Do not copy: its layout\.\n\nMake one image\./);
});

test('a busy machine holds new calls back to one at a time', async () => {
  const f = fake(), p = plan(['a', 'b', 'c'].map(id => job(id)), { max: 3, ramp: 9 });
  const done = await go(p, f, { probe: () => ({ load1: 99, cpu: 0, mem: 0 }) });
  assert.equal(f.peak(), 1);
  assert.equal(done.failed, 0);
  assert.ok(done.held > 0);
});

test('a call that leaves two images fails, and what waited for it is skipped', async () => {
  const f = fake({ files: c => c.id === 'base' ? ['image.png', 'other.png'] : ['image.png'] });
  const done = await go(plan([job('base'), job('edit', { after: ['base'] }), job('alone')]), f);
  assert.deepEqual(f.calls.map(c => c.id).sort(), ['alone', 'base']);
  assert.deepEqual(done.jobs.map(j => [j.id, j.state]), [['base', 'failed'], ['edit', 'skipped'], ['alone', 'done']]);
  assert.match(done.jobs[0].why, /2 images/);
});

test('a critic makes its named file, and the run leaves a log the checker accepts', async () => {
  const sink = memorySink(), log = createLog({ src: 'job.image', build: 'test', sink, seed: 1 });
  const f = fake({ files: c => c.id === 'critic' ? ['critique.json'] : ['image.png'] });
  const done = await go(plan([job('a'), job('critic', { after: ['a'], inputs: [of('a')], makes: 'critique.json' })]), f, { log });
  log.end();
  assert.equal(done.failed, 0);
  assert.equal(done.jobs[0].tokens, 1200);
  assert.deepEqual(checkLog(sink.text()).problems, []);
  assert.equal(sink.lines.filter(l => JSON.parse(l).event === 'call.end').length, 2);
});

test('a call is not fresh in a folder that holds files or sits in a repo, so neither runs', async () => {
  const f = fake(), p = plan([job('a'), job('b')]);
  mkdirSync(join(p.out, 'a'));
  writeFileSync(join(p.out, 'a', 'earlier.png'), 'x');
  const done = await go(p, f);
  assert.deepEqual(f.calls.map(c => c.id), ['b']);
  assert.match(done.jobs[0].why, /already holds files/);

  const repo = mkdtempSync(join(tmpdir(), 'image-repo-'));
  writeFileSync(join(repo, 'AGENTS.md'), 'rules');
  await assert.rejects(go({ out: join(repo, 'runs'), jobs: [job('a')] }, f), /inside .*AGENTS\.md/s);
});
