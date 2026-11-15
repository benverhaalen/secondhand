import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

export function pythonSuites(root, { python } = {}) {
  const candidates = python === undefined
    ? [resolve(root, '.venv/bin/python'), 'python3', 'python']
    : [python.includes('/') || python.includes('\\') ? resolve(python) : python];
  const executable = candidates.find(candidate => spawnSync(candidate, ['--version']).status === 0);
  if (!executable) return [{ level: 'warn', where: 'python', msg: 'Python not found: the Python suites did not run' }];
  const results = [];
  for (const folder of ['jobs', 'databricks', 'deploy']) {
    const run = spawnSync(executable, ['-m', 'pytest', '-q', '-p', 'no:cacheprovider'], {
      // UTF-8 mode, as on Linux and the Databricks runtime: Windows would read the repo's files as cp1252
      cwd: join(root, folder), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: { ...process.env, PYTHONUTF8: '1' },
    });
    if (run.status === 0) continue;
    const lines = `${run.stdout ?? ''}\n${run.stderr ?? ''}`.trim().split(/\r?\n/).filter(line => line.trim());
    results.push({ level: 'error', where: folder, msg: lines.at(-1) || run.error?.message || `pytest exited ${run.status}` });
  }
  return results;
}
