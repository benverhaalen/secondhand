import assert from 'node:assert/strict';
import { test } from 'node:test';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const files = ['text-500.woff', 'display-600.woff'];
test('a web-only build installs the encoded GitHub font bundle at the CSS URLs', () => {
  const root = mkdtempSync(join(tmpdir(), 'secondhand-web-fonts-'));
  try {
    const source = join(root, 'source');
    const scripts = join(root, 'web/scripts');
    mkdirSync(source, { recursive: true });
    mkdirSync(scripts, { recursive: true });
    for (const file of files) writeFileSync(join(source, file), `wOFF fixture ${file}`);
    copyFileSync(new URL('../web/scripts/fonts.mjs', import.meta.url), join(scripts, 'fonts.mjs'));
    const archive = execFileSync('tar', ['-czf', '-', '-C', source, ...files]);
    execFileSync(process.execPath, [join(scripts, 'fonts.mjs')], {
      env: { ...process.env, SECONDHAND_FONTS: '', BRAND_FONTS: '', BRAND_FONTS_B64: archive.toString('base64') },
    });
    const css = readFileSync(new URL('../web/app/globals.css', import.meta.url), 'utf8');
    for (const file of files) {
      assert.deepEqual(readFileSync(join(root, 'web/public/fonts', file)), readFileSync(join(source, file)));
      assert.ok(css.includes(`/fonts/${file}`), `CSS must request ${file}`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
