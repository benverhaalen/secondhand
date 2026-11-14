#!/usr/bin/env node
// Run before every push: node .agents/check.mjs  (errors block; warnings are questions to answer)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { problems as layout } from './checks/layout.mjs';
import { links } from './checks/links.mjs';
import { provenance } from './checks/provenance.mjs';
import { research } from './checks/research.mjs';
import { secrets } from './checks/secrets.mjs';
import { ui } from './checks/ui.mjs';
import { brand } from './checks/brand.mjs';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const git = (...a) => { try { return execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
const files = (git('ls-files', '-co', '--exclude-standard') ?? '').split('\n').filter(Boolean);
const wordsBase = git('show', 'origin/main:product/words.md') ?? git('show', 'HEAD:product/words.md');

const tier1 = JSON.parse(readFileSync(join(root, '.agents/tiers.json'), 'utf8'))['1'];
const changed = [...new Set([...(git('diff', '--name-only', 'origin/main') ?? '').split('\n'), ...(git('ls-files', '-o', '--exclude-standard') ?? '').split('\n')])].filter(Boolean);
const touched = changed.filter(f => tier1.some(t => f === t || (t.endsWith('/') && f.startsWith(t))));

const results = [
  ...touched.map(f => ({ level: 'warn', where: f, msg: 'Tier 1 (.agents/thinking.md): full decide, research behind it, owner\'s words for taste, fresh review, dependents updated' })),
  ...layout(root).map(msg => ({ level: 'error', where: 'layout', msg })),
  ...links(root, { files }), ...provenance(root, { wordsBase }), ...research(root, { files }),
  ...secrets(root, { files }), ...ui(root, { files }), ...brand(root, { files }),
];
for (const r of results) console.log(`${r.level === 'error' ? 'ERROR' : 'warn '} ${r.where}  ${r.msg}`);
const n = results.filter(r => r.level === 'error').length;
console.log(n ? `\n${n} error(s). Fix them before pushing.` : `checks ok${results.length ? ` (${results.length} warning(s) to read)` : ''}`);
const tests = files.filter(f => /^(\.agents|scripts|spec)\/.*\.test\.mjs$/.test(f));
const t = tests.length ? (() => { try { execFileSync(process.execPath, ['--test', ...tests], { cwd: root, stdio: 'pipe' }); return 0; } catch (e) { process.stdout.write(e.stdout); return 1; } })() : 0;
console.log(t ? 'tests failed' : `tests ok (${tests.length} file(s))`);
process.exitCode = n || t ? 1 : 0;
