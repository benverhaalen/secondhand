import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const web = fileURLToPath(new URL('../', import.meta.url));
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' } });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
function files(directory) {
  return readdirSync(new URL(directory, new URL('../../', import.meta.url)), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`]);
}
run('npm', ['run', 'build'], web);
run('node', ['web/scripts/render-check.mjs']);
for (const entry of readdirSync(new URL('../lib/', import.meta.url)).filter(name => name.endsWith('.test.ts')).sort()) run('node', ['--test', '--test-concurrency=1', `lib/${entry}`], web);
run('node', ['scripts/copy-lint.mjs', ...files('web/app'), ...files('web/components')]);
