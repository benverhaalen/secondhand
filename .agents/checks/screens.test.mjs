import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { screens } from './screens.mjs';

// Each rule is shown failing on the bug a test or a gallery note found late, and passing the fixed screen.
function run(files) {
  const root = mkdtempSync(join(tmpdir(), 'screens-'));
  for (const [p, s] of Object.entries(files)) { mkdirSync(join(root, p, '..'), { recursive: true }); writeFileSync(join(root, p), s); }
  try { return screens(root, { files: Object.keys(files) }).map(o => `${o.where} ${o.msg}`).join('\n'); } finally { rmSync(root, { recursive: true }); }
}
const T = 'app/src/app/(tabs)/', P = 'app/src/app/';
const page = (body, head = 'const { state } = useScreen();\n') => `export default function X() {\n${head}  return (${body});\n}\n`;

test('screens S1: "You keep" or "You\'d keep" in words fails; code names and comments pass; the two Item files wait', () => {
  const bad = run({ 'app/src/today/line.ts': "export const a = 'You keep $5';\nexport const b = `You’d keep ${x}`;\n", 'app/src/ui/row.tsx': 'const r = <Txt>You keep</Txt>;\n' });
  for (const want of [/line\.ts:1 S1/, /line\.ts:2 S1/, /row\.tsx:1 S1/]) assert.match(bad, want);
  assert.equal(run({ 'app/src/today/line.ts': "// $95 You keep, said in a comment\nexport const you_keep_cents = 1; const keep = () => 2; export const a = 'You get $5';\n",
    'app/src/item/model.ts': "export const a = 'You keep $5';\n", 'app/src/app/item/[id]/index.tsx': "useScreen(); export const a = 'You keep $5';\n" }), '');
});

test('screens S2: one id on two controls fails (a pager and a row both "photos"); a template id, other ids and a listed alternative pass', () => {
  const bad = run({ [P + 'a.tsx']: page('<><Pager id="photos" /><Row id="photos" /></>') });
  assert.match(bad, /a\.tsx:\d+ S2 id "photos" is on two controls/);
  assert.match(run({ [P + 'a.tsx']: page("<>{{ id: 'z' }}{{ id: 'z' }}</>") }), /S2 id "z"/);
  assert.equal(run({ [P + 'a.tsx']: page('<><Pager id="photos" /><Row id={`photos-${n}`} /><Row id={`photos-${m}`} /><Row id="rows" /></>') }), '');
  assert.equal(run({ [P + 'a.tsx']: '// one at a time: approve\n' + page('{a ? <Approve id="approve" /> : <Foot id="approve" />}') }), '');
});

test('screens S3: a screen that turns the wash off fails; one that leaves it to Screen passes', () => {
  assert.match(run({ [P + 'a.tsx']: page('<Screen name="a" state={state} wash={false} nav={<Nav />}>x</Screen>') }), /a\.tsx:\d+ S3 <Screen wash=\{false\}>/);
  assert.equal(run({ [P + 'a.tsx']: page('<Screen name="a" state={state} nav={<Nav />}>x</Screen>'), [T + 'buy.tsx']: page('<Screen name="buy" state={state} wash nav={<Nav onPress={() => a > b} />}>x</Screen>') }), '');
});

test('screens S4: a screen that neither calls useScreen() nor passes skip= fails (B35); either one, usePage() and a re-export pass', () => {
  assert.match(run({ [P + 'a.tsx']: page('<Screen name="a" state="typical">x</Screen>', '') }), /a\.tsx S4 draws no states/);
  assert.equal(run({ [P + 'a.tsx']: page('<Screen name="a" state="typical">x</Screen>'), [P + 'b.tsx']: page('<Screen name="b" state="empty" skip="new: why">x</Screen>', ''),
    [P + 'c.tsx']: page('<Screen name="c" state="typical">x</Screen>', 'const { w } = usePage();\n'), [P + 'd.tsx']: "export { SitePage as default } from '@/you/site';\n",
    [P + '_layout.tsx']: 'export default function L() { return null; }\n', [P + 'dev/health.tsx']: page('<Screen center>x</Screen>', '') }), '');
});

test('screens S5: a scrim tap that does not log fails; one that logs passes', () => {
  assert.match(run({ 'app/src/ui/parts/s.tsx': 'export const S = () => <View testID="sheet-scrim" onResponderRelease={onClose} />;\n' }), /s\.tsx:1 S5 a scrim tap does not log/);
  assert.match(run({ [P + 'a.tsx']: page('<Pressable id="backdrop" onPress={() => setOpen(false)} />') }), /a\.tsx:\d+ S5/);
  assert.equal(run({ 'app/src/ui/parts/s.tsx': "export const S = () => <View testID=\"sheet-scrim\" onResponderRelease={() => { log.event('user.input', { control: 'sheet-scrim' }); onClose(); }} />;\n" }), '');
});
