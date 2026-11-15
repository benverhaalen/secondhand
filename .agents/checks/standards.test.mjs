import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { standards } from './standards.mjs';

// Each rule fails on the code a builder wrote before the rule, and passes the fixed code.
function run(files) {
  const root = mkdtempSync(join(tmpdir(), 'standards-'));
  for (const [p, s] of Object.entries(files)) { mkdirSync(join(root, p, '..'), { recursive: true }); writeFileSync(join(root, p), s); }
  try { return standards(root, { files: Object.keys(files) }).map(o => `${o.where} ${o.msg}`).join('\n'); } finally { rmSync(root, { recursive: true }); }
}
const P = 'app/src/ui/parts/x.tsx';

test('standards N1: a rounded box with no continuous curve fails; one with it passes', () => {
  assert.match(run({ [P]: 'const a = <View style={{ width: 8, borderRadius: radius.pill }} />;\n' }), /x\.tsx:1 N1/);
  assert.equal(run({ [P]: "const a = <View style={{ width: 8, borderRadius: radius.pill, borderCurve: 'continuous' }} />;\n" }), '');
});

test('standards N2 and N3: legacy shadow props, elevation and Dimensions.get fail', () => {
  const bad = run({ [P]: "const a = { shadowColor: '#000', elevation: 4 };\nconst w = Dimensions.get('window').width;\n" });
  for (const want of [/x\.tsx:1 N2 shadowColor/, /x\.tsx:1 N2 elevation/, /x\.tsx:2 N3/]) assert.match(bad, want);
  assert.match(run({ [P]: "const { width } = useWindowDimensions();\n" }), /x\.tsx:1 N3 useWindowDimensions/);
  assert.equal(run({ [P]: "const a = { boxShadow: shadow.card };\nconst { width } = useWindow();\n", 'app/src/ui/window.ts': 'const d = useWindowDimensions();\n' }), '');
});

test('standards N5: two labels for one intent fail across files; a chip value and a different intent pass', () => {
  assert.match(run({ 'app/src/app/a.tsx': '<Pill id="a" label="Not now" />\n', 'app/src/app/b.tsx': '<Pill id="b" label="Later" />\n' }), /app\/src\/app\/b\.tsx:1 N5 "Later" and "Not now"/);
  assert.match(run({ 'app/src/app/a.tsx': "<DecisionCard primary={{ id: 'p', label: 'Cash out' }} second={{ id: 's', label: 'Later' }} />\n<Pill id=\"b\" label=\"Not now\" />\n" }), /N5/);
  assert.equal(run({ 'app/src/app/a.tsx': '<Pill id="a" label="Not now" />\n<Chips id="when" other={{ label: \'Later\' }} />\n<Pill id="k" label="Keep this" />\n<Pill id="j" label="Keep it" />\n' }), '');
});
