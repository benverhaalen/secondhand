#!/usr/bin/env node
// Runs image jobs through the Codex CLI: one fresh call per image, as many at once as the machine takes.
//   node .agents/skills/image-gen/run.mjs <plan.json> [out folder]
// The plan and its rules are in SKILL.md. Call times: node spec/log.mjs <out>/logs/*.jsonl
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { cpus, homedir, loadavg } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLog, teeSink, consoleSink } from '../../../log/index.js';
import { fileSink } from '../../../log/node.js';

const MAX_INPUTS = 5;       // what one Codex call takes with -i
const MAX_PROMPT = 3000;    // characters, with the attached-image lines. Round 7's ran 3,208 to 4,490 and sent each call to 49 KB of rule docs
const RULE_DOC = /\b(?:AGENTS|CLAUDE|constitution|ledger|coder-card|ui-constitution|frontend-standard|brief)\.md\b|\btokens\.css\b/;
const PATH = /(?:^|[\s"'(])(?:~|\.{1,2})?\/[\w.-]+\/[\w.-]/;
const IMAGE = /\.(png|jpe?g|webp)$/i;
const BUSY_EVERY = 5;       // ticks between new calls while the machine is busy: a call costs CPU only as it starts
const ONE_IMAGE = '\n\nMake one image. Save it as image.png in this folder. Reply with one line.';
const inputsOf = j => j.inputs ?? [];
// The prompt a call gets: the job's words, then one line per attached image saying how to use it.
const promptOf = j => j.prompt
  + (inputsOf(j).length ? `\n\nAttached images, in order:\n${inputsOf(j).map((i, n) => `${n + 1}. ${i.take}${i.leave ? ` Do not copy: ${i.leave}` : ''}`).join('\n')}` : '')
  + ((j.makes ?? 'image') === 'image' ? ONE_IMAGE : '');

// What a plan must hold before any call is made. Returns the problems as sentences.
export function check(plan) {
  const out = [], jobs = plan.jobs ?? [], ids = new Set();
  if (!plan.out) out.push('the plan names no out folder');
  for (const j of jobs) {
    if (ids.has(j.id)) out.push(`${j.id} is in the plan twice`);
    ids.add(j.id);
  }
  for (const j of jobs) {
    const taken = inputsOf(j).map(i => i.job).filter(Boolean);
    for (const d of [...(j.after ?? []), ...taken]) if (!ids.has(d)) out.push(`${j.id} waits for ${d}, which is not in the plan`);
    for (const d of taken) if (!(j.after ?? []).includes(d)) out.push(`${j.id} takes the image of ${d} but does not wait for it: add it to after`);
    if (!j.prompt?.trim()) { out.push(`${j.id} has no prompt`); continue; }
    inputsOf(j).forEach((i, n) => {
      if (!i.file === !i.job) out.push(`${j.id}, image ${n + 1}: name a file or a job, one of the two`);
      if (!i.take?.trim()) out.push(`${j.id}, image ${n + 1}: say what to take from it`);
      if (i.ref && !i.leave?.trim()) out.push(`${j.id}, image ${n + 1}: it is someone's finished design, so say what not to copy from it`);
    });
    const prompt = promptOf(j);
    if (prompt.length > MAX_PROMPT) out.push(`${j.id}: the prompt is ${prompt.length} characters; the most is ${MAX_PROMPT}. Keep the job, this image's one difference and the fail list`);
    if (RULE_DOC.test(prompt)) out.push(`${j.id}: the prompt sends the call to a rule doc. Give it the few lines it needs, or an image that shows them`);
    else if (PATH.test(prompt)) out.push(`${j.id}: the prompt names a path. Attach images as inputs; a call that is given a path goes reading`);
    if (inputsOf(j).length > MAX_INPUTS) out.push(`${j.id} attaches ${j.inputs.length} images; one call takes ${MAX_INPUTS} images at most`);
  }
  const after = new Map(jobs.map(j => [j.id, j.after ?? []])), seen = new Map();
  const loops = id => { if (seen.get(id) === 1) return true; if (seen.get(id) === 2) return false; seen.set(id, 1); const hit = (after.get(id) ?? []).some(loops); seen.set(id, 2); return hit; };
  if (jobs.some(j => loops(j.id))) out.push('the jobs wait for each other in a circle');
  return out;
}

// Codex reads every AGENTS.md from the folder it runs in up to the repo root, so a call run inside a repo is not fresh.
function insideRepo(folder) {
  for (let d = resolve(folder); ; d = dirname(d)) {
    if (existsSync(join(d, 'AGENTS.md')) || existsSync(join(d, '.git'))) return d;
    if (d === dirname(d)) return null;
  }
}

// A Codex home that holds only the sign-in, so a call starts without the person's own Codex instructions, hooks and skills.
export function cleanHome(folder, auth = join(homedir(), '.codex', 'auth.json')) {
  if (!existsSync(auth)) throw new Error(`no Codex sign-in at ${auth}: run codex login first`);
  mkdirSync(folder, { recursive: true });
  if (!existsSync(join(folder, 'auth.json'))) symlinkSync(auth, join(folder, 'auth.json'));
  return folder;
}

const codex = ({ folder, prompt, inputs, model, pids }) => new Promise((done, fail) => {
  const child = spawn('codex', ['exec', '--ephemeral', '--skip-git-repo-check', '-s', 'workspace-write', '-m', model, '-C', folder, prompt, ...inputs.flatMap(i => ['-i', i])], { stdio: ['ignore', 'pipe', 'pipe'] });
  let tail = '';
  pids.add(child.pid);
  for (const s of [child.stdout, child.stderr]) s.on('data', d => { tail = (tail + d).slice(-4000); });
  child.on('error', fail);
  child.on('close', status => { pids.delete(child.pid); status === 0 ? done(tail) : fail(new Error(`codex exit ${status}: ${tail.slice(-300)}`)); });
});

// The machine right now: the one-minute load, and what these calls and everything they started are using (cpu 100 is one core; mem in MB).
export function machine(pids = new Set()) {
  if (process.platform === 'win32') return { load1: 0, cpu: 0, mem: 0 }; // no ps and no load average there
  const rows = execFileSync('ps', ['-A', '-o', 'pid=,ppid=,%cpu=,rss='], { encoding: 'utf8' }).trim().split('\n').map(l => l.trim().split(/\s+/).map(Number));
  const ours = new Set(pids);
  for (let grew = true; grew;) { grew = false; for (const [pid, ppid] of rows) if (ours.has(ppid) && !ours.has(pid)) { ours.add(pid); grew = true; } }
  const mine = rows.filter(([pid]) => ours.has(pid));
  return { load1: loadavg()[0], cpu: mine.reduce((n, r) => n + r[2], 0), mem: mine.reduce((n, r) => n + r[3], 0) / 1024 };
}

export async function run(plan, { exec = codex, probe = machine, log, tickMs = 2000, cores = cpus().length, base = '.' } = {}) {
  const problems = check(plan);
  if (problems.length) throw new Error(problems.join('\n'));
  const out = resolve(plan.out), repo = insideRepo(out);
  if (repo) throw new Error(`${out} is inside ${repo}: Codex would read that tree's AGENTS.md into every call. Put out somewhere outside a repo`);
  const { max = 24, load = 0.7, ramp = 2, model = 'gpt-6-astra' } = plan;
  const jobs = plan.jobs.map(j => ({ id: j.id, role: j.role ?? 'generator', state: 'waiting', after: j.after ?? [], makes: j.makes ?? 'image', job: j }));
  const byId = new Map(jobs.map(j => [j.id, j]));
  const folderOf = id => join(out, id), running = new Set(), pids = new Set();
  const peak = { running: 0, load: 0, cpu: 0, mem: 0 };
  let held = 0, quiet = BUSY_EVERY, finish;
  const over = () => jobs.every(j => !['waiting', 'running'].includes(j.state));

  async function start(j) {
    const folder = folderOf(j.id);
    mkdirSync(folder, { recursive: true });
    j.state = 'running'; running.add(j);
    peak.running = Math.max(peak.running, running.size);
    log?.job(j.id, 'image', 'running');
    const prompt = promptOf(j.job);
    const inputs = inputsOf(j.job).map(i => i.job ? join(folderOf(i.job), 'image.png') : resolve(base, i.file));
    const call = { id: j.id, folder, prompt, inputs, model, pids }, t0 = Date.now();
    try {
      if (readdirSync(folder).length) throw new Error(`${folder} already holds files: a call starts in an empty folder`);
      const input = { job: j.id, role: j.role, inputs: inputs.length, prompt_len: prompt.length, running: running.size };
      const tail = await (log ? log.call('tool', 'codex', input, () => exec(call), () => ({})) : exec(call));
      const tokens = Number(/tokens used\D*([\d,]+)/i.exec(tail ?? '')?.[1]?.replaceAll(',', ''));
      if (tokens) j.tokens = tokens;
      const made = readdirSync(folder);
      const images = made.filter(f => IMAGE.test(f));
      if (j.makes === 'image' && (images.length !== 1 || images[0] !== 'image.png')) throw new Error(`left ${images.length} images (${images.join(', ') || 'none'}); one call makes one image.png`);
      if (j.makes !== 'image' && !made.includes(j.makes)) throw new Error(`did not write ${j.makes}`);
      j.state = 'done';
    } catch (e) { j.state = 'failed'; j.why = e.message; }
    j.seconds = Math.round((Date.now() - t0) / 1000);
    running.delete(j);
    log?.job(j.id, 'image', j.state, j.why ? { reason: j.why } : undefined);
    if (over()) finish();
  }

  // New calls start only on a tick, never the moment an earlier one ends: 24 bases ending together would start 24 edits together.
  await new Promise(settled => {
    const tick = () => {
      const now = probe(pids), ratio = now.load1 / cores, busy = ratio >= load;
      peak.load = Math.max(peak.load, ratio); peak.cpu = Math.max(peak.cpu, now.cpu); peak.mem = Math.max(peak.mem, now.mem);
      log?.note('machine', { load1: now.load1, cpu_pct: Math.round(now.cpu), mem_mb: Math.round(now.mem), running: running.size });
      for (const j of jobs) if (j.state === 'waiting' && j.after.some(d => ['failed', 'skipped'].includes(byId.get(d).state))) { j.state = 'skipped'; j.why = 'what it waits for failed'; }
      const ready = jobs.filter(j => j.state === 'waiting' && j.after.every(d => byId.get(d).state === 'done'));
      const room = Math.min(max - running.size, busy ? (quiet >= BUSY_EVERY ? 1 : 0) : ramp);
      if (busy && ready.length) held++;
      quiet++;
      for (const j of ready.slice(0, Math.max(room, 0))) { start(j); quiet = 0; }
      if (over()) finish();
    };
    const timer = setInterval(tick, tickMs);
    finish = () => { clearInterval(timer); settled(); };
    tick();
  });

  const failed = jobs.filter(j => j.state !== 'done').length;
  return { out, cores, max, load, held, peak, failed, jobs: jobs.map(({ id, role, state, seconds, tokens, why }) => ({ id, role, state, seconds, tokens, why })) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const plan = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  if (process.argv[3]) plan.out = process.argv[3];
  const out = resolve(plan.out ?? '');
  const sha = (() => { try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: dirname(fileURLToPath(import.meta.url)), encoding: 'utf8' }).trim(); } catch (e) { return 'unknown'; } })();
  const sink = line => { const e = JSON.parse(line); if (e.event === 'job.state') consoleSink(`${e.ts.slice(11, 19)} ${e.state.padEnd(7)} ${e.job}${e.reason ? `  ${e.reason}` : ''}`); };
  process.env.CODEX_HOME ??= cleanHome(join(out, '.codex-home'));
  const session = `s_${Date.now().toString(36)}`, file = join(out, 'logs', `job.image-${session}.jsonl`);
  const log = createLog({ src: 'job.image', build: `image-gen+${sha}`, session, sink: teeSink(fileSink(file), sink), config: { max: plan.max, load: plan.load, ramp: plan.ramp, model: plan.model, jobs: plan.jobs?.length } });
  const done = await run(plan, { log, base: dirname(resolve(process.argv[2])) }).catch(e => { log.error('image.run', e); log.end(); console.error(e.message); process.exit(1); });
  log.end();
  writeFileSync(join(out, 'run.json'), JSON.stringify(done, null, 2));
  const { peak } = done;
  console.log(`\n${done.jobs.length - done.failed} of ${done.jobs.length} done. Most at once: ${peak.running} of ${done.max}. Load at its peak: ${(peak.load * done.cores).toFixed(1)} on ${done.cores} cores (new calls slow above ${(done.load * done.cores).toFixed(1)}). These calls at their peak: ${peak.cpu.toFixed(0)}% of one core, ${(peak.mem / 1024).toFixed(1)} GB. Slowed on ${done.held} ticks.`);
  console.log(`Call times: node spec/log.mjs ${file}`);
  process.exitCode = done.failed ? 1 : 0;
}
