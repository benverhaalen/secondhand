#!/usr/bin/env node
// Stops a commit, a merge or a push that puts back an older copy of a file: the new content of a changed file is
// byte-identical to a version that file had before its current one, so whatever was changed since would be lost.
// That is how one lead's fixes were undone on 2026-11-15 (8560d836: files copied in from a worktree cut before them).
//   node .agents/hooks/stale-copy.mjs                    what is staged, against HEAD (pre-commit, pre-merge-commit)
//   node .agents/hooks/stale-copy.mjs --range A..B       every commit in the range (pre-push)
// A deliberate revert: STALE_OK=1 git commit ...
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const git = (cwd, ...a) => { try { return execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };
const changed = (cwd, ...a) => git(cwd, 'diff', '--name-only', '--diff-filter=M', '-z', ...a).split('\0').filter(Boolean);

// The older commit whose version of `file` is `blob`, among the 40 versions before the one at `before`; '' when none.
function older(cwd, file, blob, before) {
  const versions = git(cwd, 'log', '-n40', '--format=%h', before, '--', file).split('\n').filter(Boolean);
  return versions.slice(1).find(c => git(cwd, 'rev-parse', `${c}:${file}`) === blob) ?? '';
}

export const staged = cwd => changed(cwd, '--cached')
  .map(file => ({ file, from: older(cwd, file, git(cwd, 'rev-parse', `:${file}`), 'HEAD') })).filter(h => h.from);

export function range(cwd, r) {
  const out = [];
  for (const c of git(cwd, 'rev-list', '--first-parent', r).split('\n').filter(Boolean))
    for (const file of changed(cwd, `${c}^`, c)) {
      const from = older(cwd, file, git(cwd, 'rev-parse', `${c}:${file}`), `${c}^`);
      if (from) out.push({ file, from, in: c.slice(0, 8) });
    }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--range');
  const hits = process.env.STALE_OK ? [] : i > 0 ? range(process.cwd(), process.argv[i + 1]) : staged(process.cwd());
  for (const h of hits) process.stderr.write(`stale copy: ${h.file}${h.in ? ` in ${h.in}` : ''} is byte-identical to its older version at ${h.from}; every change made to it since would be lost\n`);
  if (hits.length) {
    process.stderr.write('Merge the branch instead of copying files from it, or rebuild the change on current main. A deliberate revert: STALE_OK=1.\n');
    process.exit(1);
  }
}
