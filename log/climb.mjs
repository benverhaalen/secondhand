#!/usr/bin/env node
// What to make faster or cheaper first: node log/climb.mjs logs/*.jsonl [--top 10]
// Ranks every piece of logged work (calls and timing lines) by the time it took in total, with the time failures threw away,
// its cost and tokens; then jobs split into the wait before they ran and the run; then agent runs with the cost of their calls.
// It counts log lines, so work that was never logged is not in it. How to run the climb is in log/README.md#hill-climb.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { checkLog } from '../spec/log.mjs';

// Nearest rank: p50 of [900, 1100] is 900, p95 of 10 values is the 10th.
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.max(0, Math.ceil(s.length * p) - 1)] : 0; };
const sum = xs => xs.reduce((a, b) => a + b, 0);
const usd = x => Math.round(x * 1e6) / 1e6;
const byTotal = (a, b) => b.total_ms - a.total_ms;

function work(events) {
  const started = new Map(), rows = new Map();
  const row = what => rows.get(what) ?? rows.set(what, { what, ms: [], failed_ms: 0, failed: 0, cost_usd: 0, tokens: 0 }).get(what);
  const add = (what, e) => {
    const r = row(what), ms = typeof e.ms === 'number' ? e.ms : 0;
    r.ms.push(ms);
    if (e.ok === false) { r.failed++; r.failed_ms += ms; }
    if (typeof e.cost_usd === 'number') r.cost_usd += e.cost_usd;
    r.tokens += e.token_count ?? (e.tokens_in ?? 0) + (e.tokens_out ?? 0);
  };
  for (const e of events) {
    if (e.event === 'call.start') started.set(`${e.session} ${e.call}`, `call ${e.kind} ${e.name}`);
    if (e.event === 'call.end') add(started.get(`${e.session} ${e.call}`) ?? 'call ? ?', e);
    if (e.event === 'timing') add(`timing ${e.name}`, e);
  }
  return [...rows.values()].map(({ ms, ...r }) => ({ ...r, n: ms.length, total_ms: sum(ms), p50_ms: pct(ms, 0.5), p95_ms: pct(ms, 0.95), cost_usd: usd(r.cost_usd) })).sort(byTotal);
}

function jobs(events) {
  const seen = new Map();
  // A job is one id in one session. A retry starts a new attempt: its wait and run are measured from the first queued and the last running.
  for (const e of events.filter(e => e.event === 'job.state')) {
    const id = `${e.session} ${e.job}`, j = seen.get(id) ?? seen.set(id, { kind: e.kind }).get(id), t = Date.parse(e.ts);
    if (e.state === 'queued') j.queued ??= t;
    else if (e.state === 'running') { j.running = t; delete j.done; delete j.failed; }
    else j[e.state] = t;
  }
  const kinds = new Map();
  for (const j of seen.values()) {
    const k = kinds.get(j.kind) ?? kinds.set(j.kind, { kind: j.kind, n: 0, failed: 0, waits: [], runs: [], failed_ms: 0 }).get(j.kind);
    const end = j.done ?? j.failed;
    k.n++;
    if (j.queued != null && j.running != null) k.waits.push(j.running - j.queued);
    if (j.running != null && end != null) k.runs.push(end - j.running);
    if (j.failed != null) { k.failed++; if (j.running != null) k.failed_ms += j.failed - j.running; }
  }
  return [...kinds.values()].map(({ waits, runs, ...k }) => ({ kind: k.kind, n: k.n, failed: k.failed,
    wait_total_ms: sum(waits), wait_p95_ms: pct(waits, 0.95), run_total_ms: sum(runs), run_p95_ms: pct(runs, 0.95), failed_ms: k.failed_ms }))
    .sort((a, b) => b.wait_total_ms + b.run_total_ms - a.wait_total_ms - a.run_total_ms);
}

function agents(events) {
  const runs = new Map(), cost = new Map();
  for (const e of events) {
    if (e.event === 'agent.start') runs.set(`${e.session} ${e.run}`, e.agent);
    if (e.event === 'call.end' && e.run != null && typeof e.cost_usd === 'number') cost.set(`${e.session} ${e.run}`, (cost.get(`${e.session} ${e.run}`) ?? 0) + e.cost_usd);
  }
  const rows = new Map();
  for (const e of events.filter(e => e.event === 'agent.end')) {
    const id = `${e.session} ${e.run}`, agent = runs.get(id) ?? '?';
    const r = rows.get(agent) ?? rows.set(agent, { agent, n: 0, failed: 0, steps: 0, total_ms: 0, cost_usd: 0 }).get(agent);
    r.n++; if (e.ok === false) r.failed++;
    r.steps += e.steps; r.total_ms += e.ms; r.cost_usd = usd(r.cost_usd + (cost.get(id) ?? 0));
  }
  return [...rows.values()].sort(byTotal);
}

export const rank = events => ({ work: work(events), jobs: jobs(events), agents: agents(events) });

const s = ms => ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
const table = (rows, cols) => rows.length ? [cols.map(([h]) => h).join('\t'), ...rows.map(r => cols.map(([, f]) => f(r)).join('\t'))].join('\n') : '(none logged)';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), at = args.indexOf('--top');
  const top = at >= 0 ? Number(args.splice(at, 2)[1]) : 10;
  if (!args.length) { console.error('usage: node log/climb.mjs <log.jsonl...> [--top 10]'); process.exit(2); }
  const { problems, events } = checkLog(args.map(f => [f, readFileSync(f, 'utf8')]));
  if (problems.length) console.log(`warn  ${problems.length} line(s) break the contract; run node spec/log.mjs on these files. Ranking what was readable.\n`);
  const r = rank(events);
  const all = sum(r.work.map(w => w.total_ms)) || 1;
  console.log(`Time: where it goes (${s(all)} in ${r.work.reduce((n, w) => n + w.n, 0)} logged pieces of work)`);
  console.log(table(r.work.slice(0, top), [['share', w => `${Math.round(100 * w.total_ms / all)}%`], ['total', w => s(w.total_ms)], ['n', w => w.n], ['p50', w => s(w.p50_ms)], ['p95', w => s(w.p95_ms)], ['failed', w => w.failed ? `${w.failed} (${s(w.failed_ms)} lost)` : '0'], ['work', w => w.what]]));
  const wasted = r.work.filter(w => w.failed_ms).sort((a, b) => b.failed_ms - a.failed_ms);
  console.log(`\nWasted: time spent on work that failed`);
  console.log(table(wasted.slice(0, top), [['lost', w => s(w.failed_ms)], ['failed', w => `${w.failed} of ${w.n}`], ['work', w => w.what]]));
  const paid = r.work.filter(w => w.cost_usd || w.tokens).sort((a, b) => b.cost_usd - a.cost_usd || b.tokens - a.tokens);
  console.log(`\nCost: model and paid calls`);
  console.log(table(paid.slice(0, top), [['usd', w => w.cost_usd.toFixed(4)], ['per call', w => (w.cost_usd / w.n).toFixed(4)], ['tokens', w => w.tokens], ['work', w => w.what]]));
  console.log(`\nJobs: waiting to start, then running`);
  console.log(table(r.jobs, [['kind', j => j.kind], ['n', j => j.n], ['failed', j => j.failed], ['wait total', j => s(j.wait_total_ms)], ['wait p95', j => s(j.wait_p95_ms)], ['run total', j => s(j.run_total_ms)], ['run p95', j => s(j.run_p95_ms)]]));
  console.log(`\nAgent runs`);
  console.log(table(r.agents, [['agent', a => a.agent], ['n', a => a.n], ['failed', a => a.failed], ['steps', a => a.steps], ['total', a => s(a.total_ms)], ['usd', a => a.cost_usd.toFixed(4)]]));
}
