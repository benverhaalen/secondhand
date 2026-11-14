import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { problems } from './check-layout.mjs';

function repo(build) {
  const root = mkdtempSync(join(tmpdir(), 'layout-'));
  const put = (p, s = '') => { mkdirSync(join(root, p, '..'), { recursive: true }); writeFileSync(join(root, p), s); };
  put('features/measure/README.md');
  put('product/features.md', '| [measure](../features/measure/) | x |\n');
  build(put);
  return root;
}

test('a consistent layout has no problems', () => {
  const root = repo(put => { put('research/ben/measure/lidar.md'); put('research/nate/cross-cutting/x.md'); put('.agents/team/packets/measure/2-x.md'); });
  try { assert.deepEqual(problems(root), []); } finally { rmSync(root, { recursive: true }); }
});

test('flags unknown research slugs, unknown packet topics, unlisted features and stray research owners', () => {
  const root = repo(put => {
    put('research/ben/measuring/x.md');
    put('.agents/team/packets/lidar/3-x.md');
    put('features/studio/README.md');
    put('research/claude/measure/x.md');
  });
  try {
    const p = problems(root).join('\n');
    assert.match(p, /research\/ben\/measuring/);
    assert.match(p, /packets\/lidar/);
    assert.match(p, /studio.*features\.md/);
    assert.match(p, /research\/claude/);
  } finally { rmSync(root, { recursive: true }); }
});
