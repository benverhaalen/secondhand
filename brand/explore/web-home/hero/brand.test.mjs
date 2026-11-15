import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
test('the hero uses the paired tags before its wordmark without hand branding', () => {
  const html = read('index.html');
  assert.match(html, /class="lockup"[^>]*><img class="brand-mark"[^>]*mark\.svg[^>]*><span class="wordmark">secondhand/);
  assert.doesNotMatch(html, /class="hand"|hands-fit|class="intro"|id="hand"/);
  assert.doesNotMatch(read('hero.js'), /fitHands|sessionStorageSeen|querySelector\('\.intro'\)/);
  assert.doesNotMatch(read('hero.css'), /\.hand\b|\.dap\b|sprites\/dap/);
  const handFiles = readdirSync(new URL('../boards/03-hands', import.meta.url), { recursive: true });
  assert.deepEqual(handFiles, ['poses.mjs']);
  assert.equal(read('../boards/03-hands/poses.mjs').replace(/\/\/[^\n]*/g, '').trim(), '');
  assert.equal(read('../hands-fit.js').replace(/\/\/[^\n]*/g, '').trim(), '');
  assert.deepEqual(readdirSync(new URL('../sprites', import.meta.url)), ['README.md']);
});
