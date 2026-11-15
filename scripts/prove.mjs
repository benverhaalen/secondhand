#!/usr/bin/env node
// The proving command. Runs plan task checks and says which task broke and which known break it matches.
//   node scripts/prove.mjs --wave N | --task <id> | --tune <engine> | --note <path>
//   [--plan spec/plans/backend/plan.json] [--walk scripts/walk.mjs] [--jobs 4]
// Waves 1 to 3 also run the walk. Exit 0 only when every check passed.
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const USAGE = 'usage: prove.mjs --wave N | --task <id> | --tune <engine> | --note <path>  [--plan <path>] [--walk <path>] [--jobs N]';
const TIMEOUT_MS = 300_000;

const args = process.argv.slice(2), flags = {};
for (let i = 0; i < args.length; i += 2) {
  if (!args[i].startsWith('--') || args[i + 1] === undefined) { console.error(USAGE); process.exit(2); }
  flags[args[i].slice(2)] = args[i + 1];
}
const planPath = resolve(root, flags.plan ?? 'spec/plans/backend/plan.json');
const walkPath = resolve(root, flags.walk ?? 'scripts/walk.mjs');
const jobs = Math.max(1, Number(flags.jobs ?? 4) || 4);

// Run one argv with no shell. Resolves { status, output }; a check that cannot start or times out has status null.
function exec(argv) {
  return new Promise(done => {
    const [cmd, ...rest] = argv;
    let output = '', finished = false;
    const end = (status, extra = '') => { if (!finished) { finished = true; clearTimeout(timer); done({ status, output: output + extra }); } };
    const child = spawn(cmd === 'node' ? process.execPath : cmd, rest, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => { child.kill(); end(null, '\ntimed out'); }, TIMEOUT_MS);
    child.stdout.on('data', d => { output += d; });
    child.stderr.on('data', d => { output += d; });
    child.on('error', e => end(null, `\ncould not start: ${e.message}`));
    child.on('close', code => end(code));
  });
}

// A task passes only when its exit code is the expected one. A missing check or an empty argv fails; exit 5 (pytest: no tests) fails unless expected.
async function prove(task) {
  const c = task.check;
  if (!c || !Array.isArray(c.argv) || !c.argv.length) return { id: task.id, ok: false, reason: 'no check', task, output: '' };
  const want = c.expectExit ?? 0;
  const r = await exec(c.argv);
  const ok = r.status === want && !(r.status === 5 && want !== 5);
  return { id: task.id, ok, reason: ok ? '' : `exit ${r.status}, expected ${want}`, task, output: r.output };
}

async function pool(items, fn) {
  const results = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(jobs, items.length) }, async () => {
    while (next < items.length) { const i = next++; results[i] = await fn(items[i]); }
  }));
  return results;
}

const tail = (s, n = 8) => s.trimEnd().split('\n').slice(-n).map(l => `    ${l}`).join('\n');
const lastPart = t => String(t).split(/::|: /).pop().trim();
function report(results) {
  for (const r of results) {
    if (r.ok) { console.log(`ok   ${r.id}`); continue; }
    console.log(`FAIL ${r.id}: ${r.reason}`);
    for (const b of r.task.breaks ?? []) {
      const hit = (b.code && r.output.includes(b.code)) || (b.test && r.output.includes(lastPart(b.test)));
      console.log(`  breaks: ${b.what} -> ${b.test} (${b.code})${hit ? ' matches' : ''}`);
    }
    if (r.output.trim()) console.log(tail(r.output));
  }
  const bad = results.filter(r => !r.ok);
  console.log(`${results.length - bad.length}/${results.length} passed${bad.length ? `; broke: ${bad.map(r => r.id).join(', ')}` : ''}`);
  return bad.length ? 1 : 0;
}

const walkTask = () => ({ id: 'walk', check: existsSync(walkPath) ? { argv: ['node', walkPath], expectExit: 0 } : null });

// An expert-session note has (a), (b), (c) and a diff list of at least one bullet.
function checkNote(path) {
  if (!existsSync(path)) return [`${path} does not exist`];
  const text = readFileSync(path, 'utf8'), lines = text.split('\n'), missing = [];
  for (const m of ['(a)', '(b)', '(c)']) if (!text.includes(m)) missing.push(`missing ${m}`);
  const at = lines.findIndex(l => /diff/i.test(l));
  if (at < 0 || !lines.slice(at + 1).some(l => /^\s*[-*]\s+\S/.test(l))) missing.push('missing a diff list (a "diff" line followed by bullets)');
  return missing;
}

async function main() {
  if (flags.note) {
    const m = checkNote(resolve(root, flags.note));
    console.log(m.length ? `FAIL note ${flags.note}\n${m.map(x => `  ${x}`).join('\n')}` : `ok   note ${flags.note}`);
    return m.length ? 1 : 0;
  }
  if (!('wave' in flags || 'task' in flags || 'tune' in flags)) { console.error(USAGE); return 2; }
  const tasks = JSON.parse(readFileSync(planPath, 'utf8')).tasks;
  let list;
  if ('task' in flags) {
    list = tasks.filter(t => t.id === flags.task);
    if (!list.length) { console.error(`no task ${flags.task} in ${planPath}`); return 2; }
  } else if ('wave' in flags) {
    const w = Number(flags.wave);
    list = tasks.filter(t => t.wave === w);
    if (!list.length) { console.error(`no tasks in wave ${flags.wave}`); return 2; }
    if (w >= 1 && w <= 3) list = [walkTask(), ...list];
  } else {
    // shortcut: the engine's proof set is the tasks naming it in id or owns; comparing with the engine's own numbers waits until engines publish them.
    list = [walkTask(), ...tasks.filter(t => t.id.includes(flags.tune) || (t.owns ?? []).some(p => p.includes(flags.tune)))];
  }
  return report(await pool(list, prove));
}
process.exit(await main());
