import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MODE_FOR, NEVER_PERFORMED, NEVER_PROMOTED } from '../app/src/edge/events/policy.ts';
import { sweep } from './policy-sweep.mjs';

test('sweep logs every tuple, refuses never actions, and cannot promote protected kinds', () => {
  const dir = mkdtempSync(join(tmpdir(), 'policy-sweep-'));
  try {
    const path = join(dir, 'sweep.jsonl');
    sweep(path);
    const lines = readFileSync(path, 'utf8').trim().split('\n').map(JSON.parse);
    const actions = new Set([...Object.keys(MODE_FOR), ...NEVER_PERFORMED]);
    assert.equal(lines.length, actions.size * 4 * 2);
    assert.equal(new Set(lines.map(r => `${r.action}:${r.site}:${r.promoted}`)).size, lines.length);
    for (const r of lines) {
      assert.equal(r.event, 'decision.answer');
      assert.equal(r.src, 'policy_sweep');
      assert.match(r.policy_version, /^[a-f0-9]{12}$/);
      assert.ok(r.ts && r.session && r.seq && r.why);
      if (NEVER_PERFORMED.has(r.action)) {
        assert.equal(r.mode, 'never');
        assert.equal(r.allow, false);
      }
      if (NEVER_PROMOTED.has(r.kind)) assert.equal(r.allow, false);
      if (r.action === 'price_below_floor') assert.equal(r.mode, 'ask');
      if (r.action === 'markdown' && r.promoted) {
        assert.equal(r.kind, 'price_below_floor');
        assert.equal(r.mode, 'ask');
        assert.equal(r.allow, false);
      }
      if (r.action === 'relist' && r.site === 'poshmark') assert.equal(r.allow, false);
    }
    assert.ok(lines.some(r => r.allow));
    sweep(path);
    assert.equal(readFileSync(path, 'utf8').trim().split('\n').length, lines.length);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
