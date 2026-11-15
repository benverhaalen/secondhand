import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { range, staged } from './stale-copy.mjs';

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'stale-copy-'));
  const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  git('init', '-q');
  git('config', 'user.email', 'test@example.invalid'); git('config', 'user.name', 'test'); git('config', 'commit.gpgsign', 'false');
  const write = (file, text) => { writeFileSync(join(dir, file), text); git('add', file); };
  const commit = (file, text) => { write(file, text); git('commit', '-q', '-m', text.trim()); return git('rev-parse', 'HEAD'); };
  return { dir, git, write, commit };
}

test('a staged file that is an older copy of itself is caught; a new version and a new file are not', () => {
  const r = repo();
  try {
    r.commit('a.ts', 'one\n'); r.commit('a.ts', 'two\n'); r.commit('b.ts', 'other\n');
    r.write('a.ts', 'three\n'); r.write('c.ts', 'new\n');
    assert.deepEqual(staged(r.dir), []);
    r.write('a.ts', 'one\n');
    const hits = staged(r.dir);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].file, 'a.ts');
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});

test('a pushed range is searched commit by commit, and only the commit that put the old copy back is named', () => {
  const r = repo();
  try {
    const base = r.commit('a.ts', 'one\n');
    r.commit('a.ts', 'two\n');
    const bad = r.commit('a.ts', 'one\n');
    r.commit('a.ts', 'four\n');
    const hits = range(r.dir, `${base}..HEAD`);
    assert.deepEqual(hits.map(h => [h.file, h.in]), [['a.ts', bad.slice(0, 8)]]);
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});

test('a merge that takes the other side\'s restored file is not blamed for it, while it is merging and after', () => {
  const r = repo();
  try {
    const main = r.git('symbolic-ref', '--short', 'HEAD');
    r.commit('a.ts', 'one\n'); r.commit('a.ts', 'two\n');
    r.git('checkout', '-q', '-b', 'w'); r.commit('b.ts', 'worker\n');
    r.git('checkout', '-q', main); const restore = r.commit('a.ts', 'one\n');
    r.git('checkout', '-q', 'w'); r.git('merge', '-q', '--no-commit', '--no-ff', main);
    assert.deepEqual(staged(r.dir), []);
    // As pre-merge-commit sees it when git merges without stopping: no MERGE_HEAD yet, the ref named in the environment.
    rmSync(join(r.dir, '.git', 'MERGE_HEAD'));
    assert.equal(staged(r.dir).length, 1);
    process.env.GIT_REFLOG_ACTION = `merge ${main}`;
    try { assert.deepEqual(staged(r.dir), []); } finally { delete process.env.GIT_REFLOG_ACTION; }
    writeFileSync(join(r.dir, '.git', 'MERGE_HEAD'), restore + '\n');
    r.git('commit', '-q', '-m', 'merge');
    assert.deepEqual(range(r.dir, `${restore}..HEAD`), []);
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});
