import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { hermes } from './hermes.mjs';

function findings(files) {
  const root = mkdtempSync(join(tmpdir(), 'hermes-'));
  try {
    for (const [p, text] of Object.entries(files)) { mkdirSync(dirname(join(root, p)), { recursive: true }); writeFileSync(join(root, p), text); }
    return hermes(root, { files: Object.keys(files) }).map(x => `${x.where} ${x.msg}`).join('\n');
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('flags Intl.PluralRules reached from a screen, with the screen named', () => {
  const out = findings({ 'app/src/app/you.tsx': "import '../you/state';", 'app/src/you/state.ts': "\nconst r = new Intl.PluralRules('en-US');" });
  assert.match(out, /app\/src\/you\/state.ts:2 Intl.PluralRules .*app\/src\/app\/you.tsx/);
});
test('allows Intl.NumberFormat, and ignores server, api and test files', () => {
  const out = findings({
    'app/src/app/a.tsx': "import '@/fmt'; import '@/edge/x';", 'app/src/fmt.ts': 'new Intl.NumberFormat();',
    'app/src/edge/x.ts': 'new Intl.PluralRules(); new TextDecoder();', 'app/src/app/v1/b+api.ts': 'new Intl.PluralRules();',
    'app/src/app/c.test.ts': 'new Intl.PluralRules();',
  });
  assert.equal(out, '');
});
test('flags node: imports and the other missing Intl parts, not mentions in strings', () => {
  const out = findings({ 'app/src/app/a.tsx': "import { createHash } from 'node:crypto';\nnew Intl.Segmenter();\nconst s = 'Intl.PluralRules';" });
  assert.match(out, /node:crypto/); assert.match(out, /a.tsx:2 Intl.Segmenter/); assert.doesNotMatch(out, /:3 /);
});
