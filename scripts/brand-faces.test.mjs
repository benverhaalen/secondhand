import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brandFaces } from './brand-check.mjs';

test('brand faces reference local files without copying font bytes into CSS', () => {
  const dir = mkdtempSync(join(tmpdir(), 'brand-faces-'));
  try {
    writeFileSync(join(dir, 'text-400.woff2'), 'fixture-font');
    const css = brandFaces('--font-text: "Text"; --font-display: "Display";', dir);
    assert.ok(css.includes('https://secondhand-fonts.invalid/text-400.woff2'));
    assert.ok(!css.includes('base64'));
    assert.ok(!css.includes(Buffer.from('fixture-font').toString('base64')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
