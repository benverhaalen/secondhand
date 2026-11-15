import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { install } from './fonts.mjs';

const dir = () => mkdtempSync(join(tmpdir(), 'fonts-'));

test('a face shipped under the foundry name or another case is copied under the name the app reads', () => {
  const src = dir(), dest = dir();
  writeFileSync(join(src, 'PPNeueMontreal-Medium.otf'), 'x');
  writeFileSync(join(src, 'clofie-semibold.ttf'), 'y');
  const got = install({ dirs: [src], dest });
  assert.deepEqual(got.map(f => f.ok), [true, true]);
  assert.deepEqual(readdirSync(dest).sort(), ['Clofie-SemiBold.ttf', 'ppneuemontreal-medium.otf']);
});

test('a missing face is reported, not invented', () => {
  const src = dir(), dest = dir();
  writeFileSync(join(src, 'Clofie-SemiBold.ttf'), 'y');
  const got = install({ dirs: [src], dest });
  assert.equal(got.find(f => f.file === 'ppneuemontreal-medium.otf').ok, false);
  assert.deepEqual(readdirSync(dest), ['Clofie-SemiBold.ttf']);
});

test('the open fallback files are committed, and the website copy is byte for byte the app copy', async () => {
  const { OPEN, openMissing } = await import('./fonts.mjs');
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const root = join(fileURLToPath(import.meta.url), '../..');
  assert.deepEqual(openMissing(), []);
  for (const o of OPEN) assert.ok(readFileSync(join(root, o.app)).equals(readFileSync(join(root, o.web))), o.web);
});

test('an open file that is gone is reported', async () => {
  const { openMissing } = await import('./fonts.mjs');
  assert.equal(openMissing(dir()).length, 4);
});
