import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { plan, goFound } from './deploy.mjs';
import { execFileSync, spawnSync } from 'node:child_process';

const WORDS = '# words\n\n## 2026-11-15 nate deploy secondhand to the workspace\n> go\n\n## 2026-11-14 ben likes 500\n';
const fakeRoot = (extra = {}) => {
  const r = mkdtempSync(join(tmpdir(), 'dp-'));
  for (const d of ['deploy', 'jobs', 'databricks', 'log', 'product']) mkdirSync(join(r, d));
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

for (const directory of ['databricks', 'log']) {
  test(`a secret under ${directory}/ stops the deploy plan`, () => {
    const r = fakeRoot({ [`${directory}/conf.py`]: `TOKEN = "dapi${'b'.repeat(32)}"\n` });
    const p = plan({ verb: 'deploy', target: 'dev', profile: 'Nate' }, { root: r });
    assert.equal(p.ok, false);
    assert.ok(p.why.includes(`secret in bundle: ${directory}/conf.py`));
  });
}

test('the real bundle has no secret and keeps prod schedules on, dev in development mode', () => {
  assert.equal(plan({ verb: 'validate', target: 'dev', profile: 'Nate' }).ok, true);
  const yml = readFileSync(new URL('./databricks.yml', import.meta.url), 'utf8');
  assert.match(yml, /dev:\n\s+mode: development/);
  assert.match(yml, /secret_scopes:/);
  for (const directory of ['jobs', 'databricks', 'log']) assert.ok(yml.includes(`- ../${directory}`));
});

test('fold accepts location flags, skips missing engines and configures before import', (t) => {
  const python = ['python3', 'python'].find(command =>
    spawnSync(command, ['-c', 'import sys; assert sys.version_info.major == 3'], { encoding: 'utf8' }).status === 0);
  if (!python) {
    t.skip('No working Python 3 interpreter: tried python3 and python');
    return;
  }
  const out = execFileSync(python, ['deploy/tasks/fold.py', 'nosuch', '--catalog', 'a', '--schema', 'b'], { encoding: 'utf8' });
  assert.equal(JSON.parse(out).state, 'skipped');

  const root = fakeRoot();
  mkdirSync(join(root, 'deploy/tasks'));
  mkdirSync(join(root, 'jobs/probe'));
  writeFileSync(join(root, 'deploy/tasks/fold.py'), readFileSync(new URL('./tasks/fold.py', import.meta.url)));
  writeFileSync(join(root, 'jobs/probe/fit.py'), 'import os\nLOCATION = [os.environ.get("SECONDHAND_CATALOG"), os.environ.get("SECONDHAND_SCHEMA")]\ndef main():\n    return LOCATION\n');
  const configured = execFileSync(python, [join(root, 'deploy/tasks/fold.py'), 'probe', '--catalog', 'a', '--schema', 'b'], { encoding: 'utf8' });
  assert.deepEqual(JSON.parse(configured).result, ['a', 'b']);
  const direct = execFileSync(python, ['-c', 'import runpy, sys; from pathlib import Path; m = runpy.run_path(sys.argv[1]); assert m["run"]("probe", Path(sys.argv[2]))["state"] == "ran"', join(root, 'deploy/tasks/fold.py'), root]);
  assert.equal(direct.length, 0);
});
