import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareProbe } from './prepare.mjs';

test('the standalone probe package includes the logger and browser module dependencies', async () => {
  const out = mkdtempSync(join(tmpdir(), 'probe-package-'));
  try {
    prepareProbe(out);
    assert.match(readFileSync(join(out, 'app.yaml'), 'utf8'), /probes\/workspace\/app\/server.mjs/);
    const pool = await import(pathToFileURL(join(out, 'app/src/edge/browser/pool.ts')).href);
    const launcher = await import(pathToFileURL(join(out, 'app/src/edge/browser/playwright.ts')).href);
    const logger = await import(pathToFileURL(join(out, 'log/index.js')).href);
    assert.equal(typeof pool.createPool, 'function');
    assert.equal(typeof launcher.playwrightLauncher, 'function');
    assert.equal(typeof logger.createLog, 'function');
  } finally { rmSync(out, { recursive: true, force: true }); }
});
