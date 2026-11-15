#!/usr/bin/env node
// One readable trace per observed run, from log/ JSON-lines files.
//   node scripts/runs.mjs record <task> --log <file> [--log <file>...] [--out <dir>]
//   node scripts/runs.mjs last <task> [--out <dir>]
// A trace holds ids, event names, flags and timings only. Parsing and the contract come from spec/log.mjs, masking from log/index.js.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLog, contract } from '../spec/log.mjs';
import { maskText } from '../log/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const USAGE = 'usage: runs.mjs record <task> --log <file>... [--out <dir>] | last <task> [--out <dir>]';
const fail = (msg, code = 1) => { console.error(msg); process.exit(code); };

const [cmd, task, ...rest] = process.argv.slice(2);
const logs = []; let out = 'research/cross-cutting/nate/runs';
for (let i = 0; i < rest.length; i += 2) {
  if (rest[i] === '--log' && rest[i + 1]) logs.push(rest[i + 1]);
  else if (rest[i] === '--out' && rest[i + 1]) out = rest[i + 1];
  else fail(USAGE, 2);
}
if (!['record', 'last'].includes(cmd) || !task) fail(USAGE, 2);
// A task id is a file name here: ids such as "rt-out:" are kept readable, anything that climbs out of the folder is refused.
if (task.includes('..') || /[\/]/.test(task)) fail(`bad task id ${task}`, 2);
const file = join(resolve(root, out), `${task.replace(/[^A-Za-z0-9._-]/g, '_')}.md`);

if (cmd === 'last') {
  if (!existsSync(file)) fail(`no trace for ${task}: ${file}`);
  process.stdout.write(readFileSync(file, 'utf8'));
  process.exit(0);
}

if (!logs.length) fail(USAGE, 2);
const inputs = logs.map(p => { try { return [basename(p), readFileSync(resolve(root, p), 'utf8')]; } catch { return fail(`cannot read ${p}`); } });
const { problems, warnings, events } = checkLog(inputs);
if (!events.length) fail(`no log lines in ${logs.join(', ')}`);

// Only these fields reach a trace: names, ids and flags. Free-form values are never copied.
const SHOW = ['kind', 'name', 'action', 'screen', 'control', 'state', 'stage', 'model', 'ok', 'level', 'ms'];
const detail = e => [...SHOW, ...contract.links].filter(k => e[k] != null && typeof e[k] !== 'object').map(k => `${k}=${e[k]}`).join(' ');
const t = e => Date.parse(e.ts);
const prev = new Map();
const steps = events.map(e => {
  const d = prev.has(e.session) ? t(e) - prev.get(e.session) : 0;
  prev.set(e.session, t(e));
  return `| ${e.session} ${e.seq} | ${e.event} | ${detail(e)} | +${d} ms |`;
});
const times = events.map(t).filter(Number.isFinite);
const total = times.length ? Math.max(...times) - Math.min(...times) : 0;

const missing = events.flatMap(e => {
  const spec = contract.events[e.event];
  return spec ? spec.needs.filter(k => e[k] == null).map(k => `- ${e.session} ${e.seq} ${e.event}: ${k}`) : [`- ${e.session} ${e.seq} ${e.event}: not in spec/events.json`];
});
const byEvent = {};
for (const e of events) (byEvent[e.event] ??= []).push(e);
const compared = Object.entries(byEvent).map(([ev, es]) => {
  const needs = contract.events[ev]?.needs ?? [];
  return `- ${ev} x${es.length}: spec needs ${needs.join(', ') || '(unknown event)'}; ${es.filter(e => needs.some(k => e[k] == null)).length} line(s) short`;
});

const md = [
  `# Run trace: ${task}`, '',
  `Logs: ${logs.map(p => basename(p)).join(', ')}. ${events.length} lines, ${new Set(events.map(e => e.session)).size} session(s), first line ${events[0].ts}.`,
  `Total: ${total} ms.`, '',
  '## Steps', '', '| session seq | event | detail | since previous |', '|---|---|---|---|', ...steps, '',
  '## Fields against the spec', '', ...compared, '',
  '## Missing', '', ...(missing.length ? missing : ['- nothing']), '',
  '## Contract problems and warnings', '', ...([...problems, ...warnings].map(p => `- ${p}`).length ? [...problems, ...warnings].map(p => `- ${p}`) : ['- none']), '',
].join('\n');

mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, maskText(md));
console.log(`wrote ${file}`);
