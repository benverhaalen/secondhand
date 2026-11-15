#!/usr/bin/env node
// Check JSON-lines logs against the contract in events.json: node spec/log.mjs <log.jsonl...> [--sites ebay,depop]
// It checks every line, the order inside each session, that calls, requests and agent runs finish, and that nothing personal or secret got through.
// It then replays the item.action lines against the lifecycle spec (replay.mjs) and prints the numbers a hill-climb would use.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { allActions } from './lifecycle.mjs';
import { replay } from './replay.mjs';
import { isMaskedKey } from '../log/index.js';

export const contract = JSON.parse(readFileSync(new URL('./events.json', import.meta.url), 'utf8'));
const patterns = contract.maskPatterns.map(([label, source]) => [label, new RegExp(source)]);
const actionNames = new Set(allActions.map(a => a.name));
const LEAK = { secret: 'a secret', email: 'an email address', phone: 'a phone number', address: 'a street address', card: 'a card number' };
const isMaskMark = v => v && typeof v === 'object' && v.masked === 'key' && Object.keys(v).length === 1;
const typeOf = v => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
const textLeak = s => { for (const [label, re] of patterns) if (re.test(s)) return LEAK[label] ?? label; return null; };

// Personal data and secrets that reached a line: a masked key with a real value, or a key or string that matches a mask pattern.
function leaks(value, path, out) {
  if (typeof value === 'string') { const l = textLeak(value); if (l) out.push(`${path} holds ${l}`); return; }
  if (!value || typeof value !== 'object') return;
  for (const [k, v] of Array.isArray(value) ? value.entries() : Object.entries(value)) {
    const p = Array.isArray(value) ? `${path}[${k}]` : path ? `${path}.${k}` : k;
    if (!Array.isArray(value) && textLeak(k)) out.push(`a key under ${path || 'the line'} holds ${textLeak(k)}`);
    else if (!Array.isArray(value) && isMaskedKey(k) && !/^\[\w+\]$/.test(k) && v != null && !isMaskMark(v)) out.push(`${p} is a masked key but holds a value`);
    else leaks(v, p, out);
  }
}

// One file: every line against the contract, and the order of each session in it.
function checkLines(text, name, problems, warnings, events) {
  const sessions = new Map();
  const session = id => { if (!sessions.has(id)) sessions.set(id, { next: 0, open: new Map(), runs: new Map(), ended: false }); return sessions.get(id); };
  text.replace(/^﻿/, '').split('\n').forEach((raw, i) => {
    if (!raw.trim()) return;
    const at = `${name ? `${name}:` : 'line '}${i + 1}`, bad = msg => problems.push(`${at}: ${msg}`);
    let e; try { e = JSON.parse(raw); } catch { bad('not JSON'); return; }
    if (typeOf(e) !== 'object') { bad('not a JSON object'); return; }
    const missing = contract.envelope.filter(k => e[k] == null);
    if (missing.length) { bad(`missing ${missing.join(', ')}`); return; }
    if (typeof e.ts !== 'string' || Number.isNaN(Date.parse(e.ts))) bad('ts is not a time');
    if (!contract.levels.includes(e.level)) bad(`level ${e.level} is not one of ${contract.levels.join(', ')}`);
    if (typeof e.session !== 'string' || typeof e.src !== 'string') { bad('session and src are strings'); return; }
    const spec = contract.events[e.event];
    if (!spec) bad(`event ${e.event} is not in spec/events.json; add it there first`);
    else {
      const need = spec.needs.filter(k => e[k] == null);
      if (need.length) bad(`${e.event} needs ${need.join(', ')}`);
      for (const [k, allowed] of Object.entries(spec.enum ?? {})) if (e[k] != null && !allowed.includes(e[k])) bad(`${e.event} ${k} "${e[k]}" is not one of ${allowed.join(', ')}`);
    }
    for (const [k, t] of Object.entries(contract.types)) if (e[k] != null && typeOf(e[k]) !== t) bad(`${k} must be ${t}, got ${typeOf(e[k])}`);
    const s = session(e.session);
    if (!Number.isInteger(e.seq) || e.seq !== s.next) bad(`session ${e.session} seq is ${e.seq}, expected ${s.next} (a lost line, or two writers sharing a session)`);
    if (Number.isInteger(e.seq)) s.next = e.seq + 1;
    if ((e.seq === 0) !== (e.event === 'session.start')) bad(e.seq === 0 ? `session ${e.session} does not start with session.start` : 'session.start is only ever the first line of a session');
    if (s.ended) bad(`session ${e.session} wrote after session.end`);
    if (e.event === 'session.end') s.ended = true;
    // A start line opens something that an end line must close: a call, a request.
    for (const [kind, key, startEv, endEv] of [['call', 'call', 'call.start', 'call.end'], ['request', 'req', 'request.start', 'request.end']]) {
      const id = `${kind} ${e[key]}`;
      if (e.event === startEv) { if (s.open.has(id)) bad(`${id} started twice`); s.open.set(id, { at, what: kind === 'call' ? `${e.kind} ${e.name}` : `${e.method} ${e.route}`, done: false }); }
      if (e.event === endEv) { const o = s.open.get(id); if (!o) bad(`${endEv} for ${e[key]} has no ${startEv}`); else if (o.done) bad(`${id} ended twice`); else o.done = true; }
    }
    if (e.event === 'call.end' && e.ok === false && e.error == null) bad('a failed call needs its error');
    if (e.event === 'call.end' && e.ok === false && e.level !== 'error') bad('a failed call is logged at level error');
    if (e.event === 'agent.start') s.runs.set(e.run, { at, agent: e.agent, done: false });
    if (e.event === 'agent.step' || e.event === 'agent.end') {
      const r = s.runs.get(e.run);
      if (!r) bad(`${e.event} for run ${e.run} has no agent.start`);
      else if (r.done) bad(`${e.event} for run ${e.run} comes after its agent.end`);
      else if (e.event === 'agent.end') r.done = true;
    }
    if (e.event === 'error' && e.level !== 'error') bad('an error event is logged at level error');
    if (e.event === 'job.state' && e.state === 'failed' && e.error == null) bad('a failed job needs its error');
    if (e.event === 'item.action' && !actionNames.has(e.action)) bad(`action ${e.action} is not in spec/lifecycle.mjs`);
    if (e.log_error != null) warnings.push(`${at}: the logger could not build this line's fields (${e.log_error.type}: ${e.log_error.msg})`);
    const found = []; leaks(e, '', found);
    for (const f of found) bad(`${f}; log an id, or let the logger mask it`);
    events.push(e);
  });
  // Work that never finished is an error in a session that ended, and the first thing to read in one that crashed.
  for (const [id, s] of sessions) {
    const open = [...[...s.open].filter(([, o]) => !o.done).map(([k, o]) => `${k} (${o.what}, ${o.at})`),
      ...[...s.runs].filter(([, r]) => !r.done).map(([k, r]) => `run ${k} (${r.agent}, ${r.at})`)];
    for (const o of open) (s.ended ? problems : warnings).push(`session ${id}: ${o} never finished${s.ended ? '' : '; the session has no session.end, so it crashed or is still running'}`);
  }
}

// checkLog(text) for one log, or checkLog([[name, text], ...]) for several files that tell one story.
export function checkLog(input) {
  const problems = [], warnings = [], events = [];
  for (const [name, text] of typeof input === 'string' ? [['', input]] : input) checkLines(text, name, problems, warnings, events);
  if (!events.length) problems.push('no log lines: an empty log proves nothing');
  const opened = new Set(events.filter(e => e.event === 'decision.open').map(e => e.decision));
  for (const d of new Set(events.filter(e => e.event === 'decision.answer' || e.event === 'decision.close').map(e => e.decision)))
    if (!opened.has(d)) warnings.push(`decision ${d} was answered or closed but never opened in these logs; is the program that opened it logging?`);
  return { problems, warnings, events };
}

const pct = (sorted, p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0;
// The numbers to read before changing anything. Each counts log lines, so work that was never logged is not in them.
export function summarize(events) {
  const count = {}, calls = {}, started = new Map(), opened = new Set(), settled = new Set();
  const waiting = new Map(), taps = [];  // per session: the tap that no screen has answered yet
  let cost = 0, unanswered = 0;
  for (const e of events) {
    if (e.event === 'user.input') { if (waiting.has(e.session)) unanswered++; waiting.set(e.session, e); }
    if (e.event === 'ui.show' && waiting.has(e.session)) {
      const tap = waiting.get(e.session); waiting.delete(e.session);
      taps.push({ screen: tap.screen, control: tap.control, ms: Date.parse(e.ts) - Date.parse(tap.ts) });
    }
    count[e.event] = (count[e.event] ?? 0) + 1;
    if (e.event === 'call.start') started.set(`${e.session} ${e.call}`, `${e.kind} ${e.name}`);
    if (e.event === 'call.end') {
      const c = calls[started.get(`${e.session} ${e.call}`) ?? '? ?'] ??= { n: 0, failed: 0, ms: [], cost_usd: 0 };
      c.n++; if (e.ok === false) c.failed++; if (typeof e.ms === 'number') c.ms.push(e.ms);
      if (typeof e.cost_usd === 'number') { c.cost_usd += e.cost_usd; cost += e.cost_usd; }
    }
    if (e.event === 'decision.open') opened.add(e.decision);
    if (e.event === 'decision.answer' || e.event === 'decision.close') settled.add(e.decision);
  }
  for (const c of Object.values(calls)) { c.ms.sort((a, b) => a - b); c.p50_ms = pct(c.ms, 0.5); c.p95_ms = pct(c.ms, 0.95); delete c.ms; }
  const tapMs = taps.map(t => t.ms).sort((a, b) => a - b);
  return {
    // From a tap (user.input) to the next thing shown (ui.show) in the same session: the wait a person feels.
    tap_to_show: { n: taps.length, p50_ms: pct(tapMs, 0.5), p95_ms: pct(tapMs, 0.95), unanswered: unanswered + waiting.size, slowest: taps.sort((a, b) => b.ms - a.ms).slice(0, 5) },
    lines: events.length, sessions: new Set(events.map(e => e.session)).size, events: count,
    errors: events.filter(e => e.level === 'error').length,
    jobs_failed: events.filter(e => e.event === 'job.state' && e.state === 'failed').length,
    decisions_open: [...opened].filter(d => !settled.has(d)).length,
    cost_usd: Math.round(cost * 1e6) / 1e6, calls,
  };
}

// The item.action lines of every file, in time order, replayed against the lifecycle spec.
export function replayActions(events, sites) {
  const actions = events.map((e, i) => [e, i]).filter(([e]) => e.event === 'item.action').sort(([a, i], [b, j]) => Date.parse(a.ts) - Date.parse(b.ts) || i - j).map(([e]) => e);
  return actions.length ? replay(actions.map(e => JSON.stringify(e)).join('\n'), sites).problems.map(p => `replay, item.action ${p.replace(/^line /, '')}`) : [];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), at = args.indexOf('--sites');
  const sites = at >= 0 ? (args.splice(at, 2)[1] ?? '').split(',').filter(Boolean) : ['ebay', 'facebook', 'depop', 'poshmark', 'mercari'];
  if (!args.length || !sites.length) { console.error('usage: node spec/log.mjs <log.jsonl...> [--sites ebay,depop]'); process.exit(2); }
  const { problems, warnings, events } = checkLog(args.map(f => [f, readFileSync(f, 'utf8')]));
  const all = [...problems, ...replayActions(events, sites)];
  for (const w of warnings) console.log(`warn  ${w}`);
  for (const p of all) console.log(`ERROR ${p}`);
  console.log(JSON.stringify(summarize(events), null, 2));
  console.log(all.length ? `\n${all.length} problem(s). The log does not follow spec/events.json.` : 'log follows the contract');
  process.exitCode = all.length ? 1 : 0;
}
