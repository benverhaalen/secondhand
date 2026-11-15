#!/usr/bin/env node
// Run before every push: node .agents/check.mjs  (errors block; warnings are questions to answer)
import { execFileSync } from 'node:child_process';
import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import { readFileSync, existsSync } from 'node:fs';
const read = f => existsSync(join(root, f)) ? readFileSync(join(root, f), 'utf8') : '';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { problems as layout } from './checks/layout.mjs';
import { links } from './checks/links.mjs';
import { provenance } from './checks/provenance.mjs';
import { research } from './checks/research.mjs';
import { secrets } from './checks/secrets.mjs';
import { ui } from './checks/ui.mjs';
import { brand } from './checks/brand.mjs';
import { vague } from './checks/vague.mjs';
import { logging } from './checks/logging.mjs';
import { code } from './checks/code.mjs';
import { parts } from './checks/parts.mjs';
import { picks } from './checks/picks.mjs';
import { motion } from './checks/motion.mjs';
import { rules, tally } from './checks/rules.mjs';
import { rests, commitsSince } from './checks/rests.mjs';
import { states } from './checks/states.mjs';
import { unreached } from './checks/evidence.mjs';
import { waysOut } from './checks/waysout.mjs';
import { createLog } from '../log/index.js';
import { fileSink } from '../log/node.js';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const git = (...a) => { try { return execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
// Each check and each test file is a timing line, so node log/climb.mjs logs/check-*.jsonl ranks what makes this command slow.
const logFile = `logs/check-${Date.now().toString(36)}.jsonl`;
const log = createLog({ src: 'check', build: git('rev-parse', '--short', 'HEAD')?.trim() || 'dev', sink: fileSink(join(root, logFile)), config: { ci: Boolean(process.env.CI) } });
const t = (name, fn) => log.timed(`check.${name}`, fn);
const files = (git('ls-files', '-co', '--exclude-standard') ?? '').split('\n').filter(Boolean);
// What this push is compared with. Locally that is origin/main (what teammates already have).
// In CI, origin/main is the pushed commit itself, so the workflow passes the commit before the push.
const ciBase = /^[0-9a-f]{7,40}$/.test(process.env.CHECK_BASE ?? '') && !/^0+$/.test(process.env.CHECK_BASE) ? process.env.CHECK_BASE : null;
const base = ciBase ?? (process.env.CI ? 'HEAD~1' : 'origin/main');
const wordsBase = git('show', `${base}:product/words.md`) ?? (process.env.CI ? null : git('show', 'HEAD:product/words.md'));
if (process.env.CI && wordsBase == null) console.log(`warn  words.md  no base to compare with (${base}); append-only not checked on this run`);

const tier1 = JSON.parse(readFileSync(join(root, '.agents/tiers.json'), 'utf8'))['1'];
const changed = [...new Set([...(git('diff', '--name-only', base) ?? '').split('\n'), ...(git('ls-files', '-o', '--exclude-standard') ?? '').split('\n')])].filter(Boolean);
const touched = changed.filter(f => tier1.some(t => f === t || (t.endsWith('/') && f.startsWith(t))));

const results = [
  ...(touched.length ? [{ level: 'warn', where: `${touched.slice(0, 3).join(', ')}${touched.length > 3 ? ` and ${touched.length - 3} more` : ''}`, msg: 'Tier 1 (.agents/thinking.md): full decide, research behind it, owner\'s words for taste, fresh review, dependents updated' }] : []),
  ...t('layout', () => layout(root)).map(msg => ({ level: 'error', where: 'layout', msg })),
  ...t('links', () => links(root, { files, awaited: JSON.parse(read('.agents/awaited.json') || '[]') })), ...t('provenance', () => provenance(root, { wordsBase })), ...t('research', () => research(root, { files })),
  ...t('secrets', () => secrets(root, { files })), ...t('ui', () => ui(root, { files })), ...t('brand', () => brand(root, { files })), ...t('vague', () => vague(root)), ...t('logging', () => logging(root, { files })),
  ...t('code', () => code(root, { files, changed })), ...t('parts', () => parts(root, { files })), ...t('picks', () => picks(root, { files })), ...t('motion', () => motion(root, { files })), ...t('rules', () => rules(root)),
  ...t('waysout', () => waysOut(root)),
  ...t('rests', () => rests(root, { commits: commitsSince(root, base) })), ...t('states', () => states(root, { commits: commitsSince(root, base) })),
];
// Keep each human in the loop on the other's work: research and packets that landed in the last day.
const news = (git('log', '--since=24 hours ago', '--name-only', '--format=@%h %an %ar', '--', 'research/*/nate', 'research/*/ben', '.agents/team/packets') ?? '')
  .split('\n@').filter(Boolean).map(b => b.replace(/^@/, '').split('\n').filter(Boolean)).filter(([, ...f]) => f.length);
const nate = news.filter(([, ...f]) => f.some(x => /\/nate\//.test(x) || /packets\//.test(x) && /owner: nate/i.test(read(x))));
if (nate.length) console.log(`from Nate in the last day (summarize for Ben):\n${nate.map(([h, ...f]) => `  ${h}: ${f.join(', ')}`).join('\n')}`);
for (const r of results) console.log(`${r.level === 'error' ? 'ERROR' : 'warn '} ${r.where}  ${r.msg}`);
const n = results.filter(r => r.level === 'error').length;
if (tally(root)) console.log(tally(root));
const reach = unreached(root, files);
console.log(`research: ${reach.notes - reach.unreached.length} of ${reach.notes} notes are cited by spec/ or decisions.md; node scripts/evidence.mjs <slug> lists the rest per feature`);
console.log(n ? `\n${n} error(s). Fix them before pushing.` : `checks ok${results.length ? ` (${results.length} warning(s) to read)` : ''}`);
const tests = files.filter(f => /^(\.agents|scripts|spec)\/.*\.test\.mjs$|^app\/src\/.*\.test\.ts$/.test(f));
const failed = tests.length ? await runTests(tests) : 0;
console.log(failed ? 'tests failed' : `tests ok (${tests.length} file(s))`);
log.end({ ok: !n && !failed, errors: n, tests: tests.length });
console.log(`timings in ${logFile}; node log/climb.mjs logs/check-*.jsonl ranks them`);
process.exitCode = n || failed ? 1 : 0;

// Runs the test files in parallel, as node --test does, and logs one timing line per file: the sum of its top-level tests
// (import time is not in it) and its slowest test. Prints the spec report only when something failed.
async function runTests(paths) {
  const byFile = new Map(), report = [];
  const stream = run({ files: paths.map(f => join(root, f)), cwd: root, concurrency: true });
  const top = ok => d => {
    if (d.nesting !== 0 || !d.file || d.todo || d.skip) return; // node --test passes a failing todo, so this does too
    const f = byFile.get(d.file) ?? byFile.set(d.file, { ms: 0, n: 0, failed: 0, slowest: { ms: -1 } }).get(d.file), ms = d.details.duration_ms;
    if (!ok) f.failed++;
    if (d.name === d.file) return; // the file itself failed (a load error, a hook): counted as a failure, not as a test
    f.ms += ms; f.n++;
    if (ms > f.slowest.ms) f.slowest = { name: d.name, ms };
  };
  stream.on('test:pass', top(true));
  stream.on('test:fail', top(false));
  for await (const chunk of stream.compose(new spec())) report.push(chunk);
  for (const [file, f] of byFile) log.event('timing', { name: `test ${file.slice(root.length).replace(/^\//, '')}`, ok: !f.failed, ms: Math.round(f.ms), tests: f.n, failed: f.failed, slowest: f.slowest.name, slowest_ms: Math.round(f.slowest.ms) }, f.failed ? 'error' : 'info');
  const failed = [...byFile.values()].reduce((a, f) => a + f.failed, 0);
  if (failed) process.stdout.write(report.join(''));
  return failed;
}
