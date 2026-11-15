import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, relative } from 'node:path';
import { pythonSuites } from './python-suites.mjs';

const candidate = [resolve('.venv/bin/python'), 'python3', 'python'].find(command =>
  spawnSync(command, ['--version']).status === 0);
const python = candidate && spawnSync(candidate, ['-c', 'import sys; print(sys.executable)'], { encoding: 'utf8' }).stdout.trim();

function suites(t) {
  const root = mkdtempSync(join(tmpdir(), 'python-suites-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const folder of ['jobs', 'databricks', 'deploy']) {
    mkdirSync(join(root, folder));
    writeFileSync(join(root, folder, 'test_example.py'), 'def test_example():\n    assert True\n');
  }
  return root;
}

test('missing Python returns one warning and no errors', () => {
  assert.deepEqual(pythonSuites('.', { python: '/python-suites-does-not-exist/python' }), [
    { level: 'warn', where: 'python', msg: 'Python not found: the Python suites did not run' },
  ]);
});

test('all three suites pass from their own folders', { skip: !python && 'Python not found' }, t => {
  const root = suites(t);
  for (const folder of ['jobs', 'databricks', 'deploy']) {
    writeFileSync(join(root, folder, 'test_example.py'),
      `from pathlib import Path\ndef test_example():\n    assert Path.cwd().name == '${folder}'\n`);
  }
  assert.deepEqual(pythonSuites(root, { python }), []);
});

test('each failing folder returns an error with the pytest summary', { skip: !python && 'Python not found' }, t => {
  const root = suites(t);
  for (const folder of ['jobs', 'deploy']) {
    writeFileSync(join(root, folder, 'test_example.py'), 'def test_example():\n    assert False\n');
  }
  const results = pythonSuites(root, { python });
  assert.deepEqual(results.map(({ level, where }) => ({ level, where })), [
    { level: 'error', where: 'jobs' }, { level: 'error', where: 'deploy' },
  ]);
  for (const result of results) assert.match(result.msg, /1 failed/);
});

test('an empty suite is an error', { skip: !python && 'Python not found' }, t => {
  const root = suites(t);
  rmSync(join(root, 'jobs', 'test_example.py'));
  const results = pythonSuites(root, { python });
  assert.equal(results.length, 1);
  assert.equal(results[0].level, 'error');
  assert.equal(results[0].where, 'jobs');
  assert.match(results[0].msg, /no tests ran/);
});


test('a root-relative venv Python still runs after changing suite folders', { skip: !python && 'Python not found' }, t => {
  const root = suites(t);
  mkdirSync(join(root, '.venv', 'bin'), { recursive: true });
  writeFileSync(join(root, '.venv', 'bin', 'python'),
    `#!${process.execPath}\nconst { spawnSync } = require('node:child_process');\nprocess.exit(spawnSync(${JSON.stringify(python)}, process.argv.slice(2), { stdio: 'inherit' }).status ?? 1);\n`,
    { mode: 0o755 });
  assert.deepEqual(pythonSuites(relative(process.cwd(), root)), []);
});


test('an explicit relative Python path runs from every suite folder', { skip: !python && 'Python not found' }, t => {
  const root = suites(t);
  assert.deepEqual(pythonSuites(root, { python: relative(process.cwd(), resolve(python)) }), []);
});
