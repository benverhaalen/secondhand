import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { bundle } from './bundle.mjs';

const route = 'app/src/app/v1/index+api.ts';
function run(files) {
  const root = mkdtempSync(join(tmpdir(), 'bundle-'));
  try {
    for (const [path, text] of Object.entries(files)) { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); }
    return bundle(root, { files: Object.keys(files) });
  } finally { rmSync(root, { recursive: true, force: true }); }
}
const findings = files => run(files).map(x => `${x.where} ${x.msg}`).join('\n');

test('finds import.meta two imports deep and names the route', () => {
  const out = findings({ [route]: "import './a';", 'app/src/app/v1/a.ts': "export * from './b';", 'app/src/app/v1/b.ts': '\nimport.meta.url;' });
  assert.match(out, /app\/src\/app\/v1\/b.ts:2.*import\.meta.*reached from app\/src\/app\/v1\/index\+api.ts/);
});
test('resolves aliases and ignores type-only, package and test imports', () => {
  const out = findings({ [route]: "import '@/bad'; import type { A } from '@/types'; export type { B } from '@/types'; import 'pkg'; import '@/skip.test';", 'app/src/bad.ts': 'import.meta;', 'app/src/types.ts': 'import.meta;', 'app/src/skip.test.ts': 'import.meta;', 'pkg.ts': 'import.meta;' });
  assert.match(out, /app\/src\/bad.ts/); assert.doesNotMatch(out, /types\.ts|skip\.test|pkg\.ts/);
});
test('finds top-level await but not awaits inside functions, arrows or methods', () => {
  const out = findings({ [route]: 'await load();\nasync function f() { await load(); }\nconst f2 = async () => { await load(); };\nclass A { async method() { await load(); } }\nif (true) { await load(); }\nconst f3 = async () => await load();' });
  assert.match(out, /index\+api.ts:1.*await/); assert.match(out, /index\+api.ts:5.*await/);
  assert.doesNotMatch(out, /index\+api.ts:(2|3|4|6)\b/);
});
test('requires a reason in a same-line bundle-safe comment for readFileSync', () => {
  const out = findings({ [route]: "readFileSync('repo');\nreadFileSync('data'); // bundle-safe: data dir\nreadFileSync('repo'); // bundle-safe: \n" });
  assert.match(out, /index\+api.ts:1.*readFileSync/); assert.match(out, /index\+api.ts:3.*readFileSync/); assert.doesNotMatch(out, /index\+api.ts:2\b/);
});
test('ignores import.meta in strings and comments', () => {
  assert.equal(findings({ [route]: "const x = 'import.meta'; // import.meta\n/* import.meta */" }), '');
});
test('terminates cycles and ignores unreachable files', () => {
  const out = findings({ [route]: "import './a';", 'app/src/app/v1/a.ts': "import './b';", 'app/src/app/v1/b.ts': "import './a';\nimport.meta;", 'app/src/lost.ts': 'import.meta;' });
  assert.equal(out.split('\n').length, 1); assert.match(out, /b.ts:2/); assert.doesNotMatch(out, /lost/);
});

test('ignores awaits in functions and arrows with TypeScript return annotations', () => {
  const out = findings({ [route]: 'async function f(): Promise<void> { await load(); }\nconst g = async (): Promise<void> => { await load(); };\nclass C { async m(): Promise<void> { await load(); } }' });
  assert.equal(out, '');
});
