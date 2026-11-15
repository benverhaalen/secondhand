#!/usr/bin/env node
// Run before every push: node .agents/check.mjs  (errors block; warnings are questions to answer)
import { execFileSync } from 'node:child_process';
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
import { rules, tally } from './checks/rules.mjs';
import { rests, commitsSince } from './checks/rests.mjs';
import { unreached } from './checks/evidence.mjs';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const git = (...a) => { try { return execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
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
  ...layout(root).map(msg => ({ level: 'error', where: 'layout', msg })),
  ...links(root, { files, awaited: JSON.parse(read('.agents/awaited.json') || '[]') }), ...provenance(root, { wordsBase }), ...research(root, { files }),
  ...secrets(root, { files }), ...ui(root, { files }), ...brand(root, { files }), ...vague(root), ...logging(root, { files }), ...code(root, { files, changed }), ...parts(root, { files }), ...picks(root, { files }), ...rules(root),
  ...rests(root, { commits: commitsSince(root, base) }),
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
const t = tests.length ? (() => { try { execFileSync(process.execPath, ['--test', ...tests], { cwd: root, stdio: 'pipe' }); return 0; } catch (e) { process.stdout.write(e.stdout); return 1; } })() : 0;
console.log(t ? 'tests failed' : `tests ok (${tests.length} file(s))`);
process.exitCode = n || t ? 1 : 0;
