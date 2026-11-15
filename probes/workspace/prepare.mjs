// Prepare the Databricks probe without changing repository-relative module paths.
// node probes/workspace/prepare.mjs <temporary output folder>
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLog, consoleSink } from '../../log/index.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const files = [
  'probes/workspace/app/server.mjs',
  'log/index.js',
  'app/src/edge/browser/pool.ts', 'app/src/edge/browser/playwright.ts', 'app/src/edge/browser/auth.ts',
  'app/src/edge/harness/platform.ts', 'app/src/edge/harness/names.ts', 'app/src/edge/harness/protocol.ts',
  'spec/sites.mjs', 'research/list/ben/platforms/platform-fit.json',
];

export function prepareProbe(out) {
  for (const file of files) {
    const target = join(out, file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(root, file), target);
  }
  copyFileSync(join(root, 'probes/workspace/app/package.json'), join(out, 'package.json'));
  const config = readFileSync(join(root, 'probes/workspace/app/app.yaml'), 'utf8');
  writeFileSync(join(out, 'app.yaml'), config.replace("'server.mjs'", "'probes/workspace/app/server.mjs'"));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw new Error('usage: node probes/workspace/prepare.mjs <temporary output folder>');
  const log = createLog({ src: 'probe.prepare', build: process.env.BUILD_SHA ?? 'dev', sink: consoleSink });
  try {
    prepareProbe(resolve(process.argv[2]));
    log.note('probe.prepared', { file_count: files.length + 2 });
  } catch (e) { log.error('probe.prepare', e); throw e; }
  finally { log.end(); }
}
