#!/usr/bin/env node
// Check JSON-lines logs against the contract in events.json: node spec/log.mjs <log.jsonl...> [--sites ebay,depop]
// It checks every line, the order inside each session, that calls and agent runs finish, and that nothing personal or secret got through.
// It then replays the item.action lines against the lifecycle spec (replay.mjs) and prints the numbers a hill-climb would use.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { allActions } from './lifecycle.mjs';
import { replay } from './replay.mjs';

export const contract = JSON.parse(readFileSync(new URL('./events.json', import.meta.url), 'utf8'));
const patterns = contract.maskPatterns.map(([label, source]) => [label, new RegExp(source)]);
const keyWords = key => key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const maskedKey = key => keyWords(key).some(w => contract.maskWords.includes(w));
const actionNames = new Set(allActions.map(a => a.name));
const LEAK = { secret: 'a secret', email: 'an email address', phone: 'a phone number', address: 'a street address' };
const isMaskMark = v => v && typeof v === 'object' && v.masked === 'key' && Object.keys(v).length === 1;

// Personal data and secrets that reached a line: a masked key with a real value, or a string that matches a mask pattern.
function leaks(value, path, out) {
  if (typeof value === 'string') { for (const [label, re] of patterns) if (re.test(value)) out.push(`${path} holds ${LEAK[label] ?? label}`); return; }
  if (!value || typeof value !== 'object') return;
  for (const [k, v] of Array.isArray(value) ? value.entries() : Object.entries(value)) {
    const p = Array.isArray(value) ? `${path}[${k}]` : path ? `${path}.${k}` : k;
    if (!Array.isArray(value) && maskedKey(k) && v != null && !isMaskMark(v)) out.push(`${p} is a masked key but holds a value`);
    else leaks(v, p, out);
  }
}

export function checkLog(text) {
  const problems = [], warnings = [], sessions = new Map(), events = [];
  const session = id => { if (!sessions.has(id)) sessions.set(id, { next: 0, calls: new Map(), runs: new Map(), ended: false, src: null }); return sessions.get(id); };
  text.split('\n').forEach((raw, i) => {
    if (!raw.trim()) return;
    const at = `line ${i + 1}`;
    let e; try { e = JSON.parse(raw); } catch { problems.push(`${at}: not JSON`); return; }
    if (!e || typeof e !== 'object' || Array.isArray(e)) { problems.push(`${at}: not a JSON object`); return; }
    const missing = contract.envelope.filter(k => e[k] === undefined);
    if (missing.length) { problems.push(`${at}: missing ${missing.join(', ')}`); return; }
    if (typeof e.ts !== 'string' || Number.isNaN(Date.parse(e.ts))) problems.push(`${at}: ts is not a time`);
    if (!contract.levels.includes(e.level)) problems.push(`${at}: level ${e.level} is not one of ${contract.levels.join(', ')}`);
    const spec = contract.events[e.event];
    if (!spec) problems.push(`${at}: event ${e.event} is not in spec/events.json; add it there first`);
    else {
      const need = spec.needs.filter(k => e[k] === undefined);
      if (need.length) problems.push(`${at}: ${e.event} needs ${need.join(', ')}`);
      for (const [k, allowed] of Object.entries(spec.enum ?? {})) if (e[k] !== undefined && !allowed.includes(e[k])) problems.push(`${at}: ${e.event} ${k} "${e[k]}" is not one of ${allowed.join(', ')}`);
    }
    const s = session(e.session);
    if (!Number.isInteger(e.seq) || e.seq !== s.next) problems.push(`${at}: session ${e.session} seq is ${e.seq}, expected ${s.next} (a lost line, or two writers sharing a session)`);
    if (Number.isInteger(e.seq)) s.next = e.seq + 1;
    if (e.seq === 0 && e.event !== 'session.start') problems.push(`${at}: session ${e.session} does not start with session.start`);
    if (s.ended) problems.push(`${at}: session ${e.session} wrote after session.end`);
    s.src ??= e.src;
    if (e.event === 'session.end') s.ended = true;
    if (e.event === 'call.start') { if (s.calls.has(e.call)) problems.push(`${at}: call ${e.call} started twice`); s.calls.set(e.call, { line: i + 1, kind: e.kind, name: e.name, done: false }); }
    if (e.event === 'call.end') {
      const c = s.calls.get(e.call);
      if (!c) problems.push(`${at}: call.end for ${e.call} has no call.start`);
      else if (c.done) problems.push(`${at}: call ${e.call} ended twice`);
      else { c.done = true; e._kind = c.kind; e._name = c.name; }
      if (e.ok === false && e.error === undefined) problems.push(`${at}: a failed call needs its error`);
      if (e.ok === false && e.level !== 'error') problems.push(`${at}: a failed call is logged at level error`);
    }
    if (e.event === 'agent.start') s.runs.set(e.run, { line: i + 1, agent: e.agent, done: false });
    if (e.event === 'agent.step' || e.event === 'agent.end') {
      const r = s.runs.get(e.run);
      if (!r) problems.push(`${at}: ${e.event} for run ${e.run} has no agent.start`);
      else if (e.event === 'agent.end') r.done = true;
    }
    if (e.event === 'error' && e.level !== 'error') problems.push(`${at}: an error event is logged at level error`);
    if (e.event === 'job.state' && e.state === 'failed' && e.error === undefined) problems.push(`${at}: a failed job needs its error`);
    if (e.event === 'item.action' && !actionNames.has(e.action)) problems.push(`${at}: action ${e.action} is not in spec/lifecycle.mjs`);
    const found = []; leaks(Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith('_'))), '', found);
    for (const f of found) problems.push(`${at}: ${f}; log an id, or let the logger mask it`);
    events.push(e);
  });
  // A call or run that never finished is an error in a session that ended, and the first thing to read in one that crashed.
  for (const [id, s] of sessions) {
    const open = [...[...s.calls].filter(([, c]) => !c.done).map(([k, c]) => `call ${k} (${c.kind} ${c.name}, line ${c.line})`),
      ...[...s.runs].filter(([, r]) => !r.done).map(([k, r]) => `run ${k} (${r.agent}, line ${r.line})`)];
    for (const o of open) (s.ended ? problems : warnings).push(`session ${id}: ${o} never finished${s.ended ? '' : '; the session has no session.end, so it crashed or is still running'}`);
  }
  return { problems, warnings, events, sessions };
}

const pct = (sorted, p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0;
// The numbers to read before changing anything, with what each one counts.
export function summarize(events) {
  const count = {}, calls = {}, opened = new Set(), settled = new Set();
  let cost = 0;
  for (const e of events) {
    count[e.event] = (count[e.event] ?? 0) + 1;
    if (e.event === 'call.end') {
      const k = `${e._kind ?? '?'} ${e._name ?? '?'}`, c = calls[k] ??= { n: 0, failed: 0, ms: [], cost_usd: 0 };
      c.n++; if (e.ok === false) c.failed++; if (typeof e.ms === 'number') c.ms.push(e.ms);
      if (typeof e.cost_usd === 'number') { c.cost_usd += e.cost_usd; cost += e.cost_usd; }
    }
    if (e.event === 'decision.open') opened.add(e.decision);
    if (e.event === 'decision.answer' || e.event === 'decision.close') settled.add(e.decision);
  }
  for (const c of Object.values(calls)) { c.ms.sort((a, b) => a - b); c.p50_ms = pct(c.ms, 0.5); c.p95_ms = pct(c.ms, 0.95); delete c.ms; }
  return {
    lines: events.length, sessions: new Set(events.map(e => e.session)).size, events: count,
    errors: events.filter(e => e.level === 'error').length,
    jobs_failed: events.filter(e => e.event === 'job.state' && e.state === 'failed').length,
    decisions_open: [...opened].filter(d => !settled.has(d)).length,
    cost_usd: Math.round(cost * 1e6) / 1e6, calls,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), at = args.indexOf('--sites');
  const sites = at >= 0 ? args.splice(at, 2)[1].split(',') : ['ebay', 'facebook', 'depop', 'poshmark', 'mercari'];
  if (!args.length) { console.error('usage: node spec/log.mjs <log.jsonl...> [--sites ebay,depop]'); process.exit(2); }
  const text = args.map(f => readFileSync(f, 'utf8').replace(/\n?$/, '\n')).join('');
  const { problems, warnings, events } = checkLog(text);
  const replayed = events.some(e => e.event === 'item.action') ? replay(text, sites).problems.map(p => `replay ${p}`) : [];
  for (const w of warnings) console.log(`warn  ${w}`);
  for (const p of [...problems, ...replayed]) console.log(`ERROR ${p}`);
  console.log(JSON.stringify(summarize(events), null, 2));
  console.log(problems.length + replayed.length ? `\n${problems.length + replayed.length} problem(s). The log does not follow spec/events.json.` : 'log follows the contract');
  process.exitCode = problems.length + replayed.length ? 1 : 0;
}
