import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, machine, run } from './run.mjs';
import { createLog, memorySink } from '../../../log/index.js';
import { checkLog } from '../../../spec/log.mjs';

const job = (id, more = {}) => ({ id, prompt: `make ${id}`, ...more });
const quiet = () => ({ load1: 0, cpu: 0, mem: 0, swap: 0 });
const img = (file, more = {}) => ({ file, take: 'the colors.', ...more });
const of = (id, more = {}) => ({ job: id, take: 'this screen. Edit it.', ...more });
// Stands in for the Codex CLI: records what each call was given, waits, then leaves the files a real call would.
function fake({ ms = 15, files = () => ['image.png'] } = {}) {
  const calls = []; let now = 0, peak = 0;
  const exec = async call => {
    calls.push({ ...call, at: Date.now(), found: readdirSync(call.folder) });
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

test('a busy machine gets one new call every few ticks, not a burst', async () => {
  const starts = p => p.calls.map(c => c.at);
  const calm = fake({ ms: 150 }), busy = fake({ ms: 150 }), jobs = () => plan(['a', 'b', 'c'].map(id => job(id)), { max: 3, ramp: 9 });
  await go(jobs(), calm);
  const done = await go(jobs(), busy, { probe: () => ({ load1: 99, cpu: 0, mem: 0, swap: 0 }) });
  assert.ok(starts(calm)[2] - starts(calm)[0] < 15, 'a calm machine starts all three on one tick');
  assert.ok(starts(busy)[1] - starts(busy)[0] >= 20 && starts(busy)[2] - starts(busy)[1] >= 20, `starts were ${starts(busy)}`);
  assert.equal(busy.peak(), 3, 'calls that are waiting on the server still overlap');
  assert.ok(done.held > 0);
  assert.equal(done.failed, 0);
});

test('a machine that is swapping runs one call at a time until it stops', async () => {
  let swapped = 0;
  const swapping = () => ({ load1: 0, cpu: 0, mem: 0, swap: swapped += 1000 });
  const f = fake({ ms: 30 }), done = await go(plan(['a', 'b', 'c'].map(id => job(id)), { max: 3, ramp: 9 }), f, { probe: swapping });
  assert.equal(f.peak(), 1);
  assert.ok(done.held > 0);
  assert.equal(done.failed, 0);
  assert.ok(done.peak.swap > 10, `peak swap was ${done.peak.swap} MB a second`);
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

test('the log holds each job\'s wait before it ran, the tokens of each call, and a failure the checker accepts', async () => {
  const sink = memorySink(), log = createLog({ src: 'job.image', build: 'test', sink, seed: 1 });
  const p = plan([job('a'), job('b')]);
  mkdirSync(join(p.out, 'b')); writeFileSync(join(p.out, 'b', 'earlier.png'), 'x');
  await go(p, fake(), { log });
  log.end();
  const lines = sink.lines.map(l => JSON.parse(l));
  assert.deepEqual(lines.filter(e => e.event === 'job.state' && e.job === 'a').map(e => e.state), ['queued', 'running', 'done']);
  assert.deepEqual(lines.filter(e => e.event === 'call.end').map(e => e.token_count), [1200]);
  assert.deepEqual(checkLog(sink.text()).problems, []);
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

const posixOnly = { skip: process.platform === 'win32' && 'the stand-in codex is a shebang script, and Windows has no ps' };

test('from the command line: a clean Codex home, one image per call, and a whole log', posixOnly, () => {
  const dir = mkdtempSync(join(tmpdir(), 'image-cli-')), home = join(dir, 'home'), bin = join(dir, 'bin'), out = join(dir, 'out');
  mkdirSync(join(home, '.codex'), { recursive: true }); mkdirSync(bin);
  writeFileSync(join(home, '.codex', 'auth.json'), '{}');
  writeFileSync(join(home, '.codex', 'AGENTS.md'), 'rules of the person who owns the machine');
  // Stands in for the codex binary: fails unless it was started in the clean home, then leaves one image.
  writeFileSync(join(bin, 'codex'), `#!/usr/bin/env node
const { existsSync, writeFileSync } = require('node:fs'), { join } = require('node:path');
const home = process.env.CODEX_HOME ?? '';
if (!existsSync(join(home, 'auth.json')) || existsSync(join(home, 'AGENTS.md'))) { console.error('not a clean home: ' + home); process.exit(1); }
writeFileSync(join(process.argv[process.argv.indexOf('-C') + 1], 'image.png'), 'x');
console.log('tokens used: 4,089');
`);
  chmodSync(join(bin, 'codex'), 0o755);
  writeFileSync(join(dir, 'plan.json'), JSON.stringify({ jobs: [job('a'), job('b')] }));
  const env = { ...process.env, HOME: home, PATH: bin + delimiter + process.env.PATH };
  delete env.CODEX_HOME;
  const ran = spawnSync(process.execPath, [fileURLToPath(new URL('./run.mjs', import.meta.url)), join(dir, 'plan.json'), out], { env, encoding: 'utf8' });
  assert.equal(ran.status, 0, ran.stdout + ran.stderr);
  assert.match(ran.stdout, /2 of 2 done/);
  assert.ok(lstatSync(join(out, '.codex-home', 'auth.json')).isSymbolicLink());
  const { problems, events } = checkLog(readFileSync(join(out, 'logs', readdirSync(join(out, 'logs'))[0]), 'utf8'));
  assert.deepEqual(problems, []);
  assert.equal(events[0].event, 'session.start');
  assert.deepEqual(JSON.parse(readFileSync(join(out, 'run.json'), 'utf8')).jobs.map(j => j.tokens), [4089, 4089]);
});

test('the machine probe counts a call and what it started, and nothing else', posixOnly, () => {
  const none = machine(new Set()), self = machine(new Set([process.pid]));
  assert.equal(none.cpu, 0); assert.equal(none.mem, 0);
  assert.ok(self.mem > 10, `this process holds more than 10 MB, got ${self.mem}`);
});

test('the machine probe reads how much the machine has swapped so far', posixOnly, () => {
  assert.ok(Number.isFinite(machine().swap) && machine().swap >= 0);
});

// Stands in for a codex call that never ends, with a child of its own: the leftovers that pile up.
function hanging() {
  const dir = mkdtempSync(join(tmpdir(), 'image-hang-')), bin = join(dir, 'bin'), home = join(dir, 'home'), pidFile = join(dir, 'pids');
  mkdirSync(bin); mkdirSync(join(home, '.codex'), { recursive: true });
  writeFileSync(join(home, '.codex', 'auth.json'), '{}');
  writeFileSync(join(bin, 'codex'), `#!/usr/bin/env node
const { spawn } = require('node:child_process'), { appendFileSync } = require('node:fs');
const kid = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
appendFileSync(process.env.PID_FILE, process.pid + ' ' + kid.pid + '\\n');
setInterval(() => {}, 1000);
`);
  chmodSync(join(bin, 'codex'), 0o755);
  const env = { ...process.env, HOME: home, PATH: bin + delimiter + process.env.PATH, PID_FILE: pidFile };
  delete env.CODEX_HOME;
  const planFile = more => { writeFileSync(join(dir, 'plan.json'), JSON.stringify({ out: join(dir, 'out'), jobs: [job('a'), job('b')], ...more })); return join(dir, 'plan.json'); };
  const pids = () => readFileSync(pidFile, 'utf8').split(/\s+/).filter(Boolean).map(Number);
  const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
  return { dir, env, planFile, pids, alive };
}
const runner = fileURLToPath(new URL('./run.mjs', import.meta.url));

test('a call that runs past its time is stopped with everything it started', posixOnly, () => {
  const h = hanging();
  const ran = spawnSync(process.execPath, [runner, h.planFile({ timeout: 1 })], { env: h.env, encoding: 'utf8' });
  assert.equal(ran.status, 1, ran.stdout + ran.stderr);
  const jobs = JSON.parse(readFileSync(join(h.dir, 'out', 'run.json'), 'utf8')).jobs;
  assert.deepEqual(jobs.map(j => j.state), ['failed', 'failed']);
  assert.match(jobs[0].why, /stopped after 1 second/);
  assert.equal(h.pids().length, 4);
  assert.deepEqual(h.pids().filter(h.alive), []);
});

test('a runner that is told to stop stops its calls and what they started', posixOnly, async () => {
  const h = hanging();
  const child = spawn(process.execPath, [runner, h.planFile({ timeout: 600 })], { env: h.env, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { try { if (h.pids().length === 4) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  assert.equal(h.pids().length, 4, 'both calls started');
  child.kill('SIGTERM');
  await new Promise(r => child.on('exit', r));
  assert.deepEqual(h.pids().filter(h.alive), []);
});
