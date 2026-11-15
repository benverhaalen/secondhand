import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { plan, goFound } from './deploy.mjs';

const WORDS = '# words\n\n## 2026-11-15 nate deploy secondhand to the workspace\n> go\n\n## 2026-11-14 ben likes 500\n';
const fakeRoot = (extra = {}) => {
  const r = mkdtempSync(join(tmpdir(), 'dp-'));
  for (const d of ['deploy', 'jobs', 'product']) mkdirSync(join(r, d));
  writeFileSync(join(r, 'deploy/databricks.yml'), 'bundle:\n  name: secondhand\n');
  writeFileSync(join(r, 'product/words.md'), WORDS);
  for (const [f, t] of Object.entries(extra)) writeFileSync(join(r, f), t);
  return r;
};

test('refused: a prod deploy with no go, or a go that is not Nate about deploying', () => {
  const r = fakeRoot();
  assert.match(plan({ verb: 'deploy', target: 'prod', profile: 'Nate' }, { root: r }).why, /Nate's go/);
  assert.equal(plan({ verb: 'deploy', target: 'prod', profile: 'Nate', go: '2026-11-14-ben-likes-500' }, { root: r }).ok, false);
  assert.equal(goFound(WORDS, '2026-11-15-nate-deploy-to-somewhere-else'), false);
});

test('a prod deploy with Nate\'s quoted go, and a dev rehearsal with none, both pass', () => {
  const r = fakeRoot();
  assert.deepEqual(plan({ verb: 'deploy', target: 'prod', profile: 'Nate', go: '2026-11-15-nate-deploy-secondhand-to-the-workspace' }, { root: r }).argv,
    ['bundle', 'deploy', '--target', 'prod', '--profile', 'Nate']);
  assert.equal(plan({ verb: 'deploy', target: 'dev', profile: 'Nate' }, { root: r }).ok, true);
});

test('no default profile: a missing --profile is refused', () => {
  assert.match(plan({ verb: 'validate', target: 'dev' }, { root: fakeRoot() }).why, /--profile/);
});

test('fail: a secret anywhere in the synced files stops the deploy', () => {
  const r = fakeRoot({ 'jobs/conf.py': `TOKEN = "dapi${'a'.repeat(32)}"\n` });
  const p = plan({ verb: 'deploy', target: 'dev', profile: 'Nate' }, { root: r });
  assert.equal(p.ok, false);
  assert.match(p.why, /secret in bundle: jobs\/conf\.py/);
});

test('the real bundle has no secret and keeps prod schedules on, dev in development mode', () => {
  assert.equal(plan({ verb: 'validate', target: 'dev', profile: 'Nate' }).ok, true);
  const yml = readFileSync(new URL('./databricks.yml', import.meta.url), 'utf8');
  assert.match(yml, /dev:\n\s+mode: development/);
  assert.match(yml, /secret_scopes:/);
});
