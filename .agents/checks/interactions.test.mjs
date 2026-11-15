import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { interactions } from './interactions.mjs';

function run(files) {
  const root = mkdtempSync(join(tmpdir(), 'interactions-'));
  for (const [p, s] of Object.entries(files)) { mkdirSync(join(root, p, '..'), { recursive: true }); writeFileSync(join(root, p), typeof s === 'string' ? s : JSON.stringify(s)); }
  try { return interactions(root, { files: Object.keys(files) }).map(o => `${o.where} ${o.msg}`).join('\n'); } finally { rmSync(root, { recursive: true }); }
}
const row = (o = {}) => ({ screen: '/sell', intent: 'open it', result: { kind: 'push', to: '/item/[id]', back: 'to Sell' }, press: { feedback: 'scale', ms: 150 }, motion: { name: 'native default', ms: 0, curve: '', reduce: '' }, haptic: { type: 'none', when: '' }, freq: 'tens', states: {}, always: true, log: 'user.input', ...o });
const S = 'app/src/ui/interactions.json', P = 'app/src/app/sell.tsx';

test('interactions I1: a control in the code with no row fails; a literal and a template row cover theirs', () => {
  assert.match(run({ [S]: { controls: { 'tile-open': row() } }, [P]: '<Press id="sell-pause" />\n' }), /sell\.tsx:1 I1 the control "sell-pause" has no row/);
  assert.equal(run({ [S]: { controls: { 'tile-open': row(), 'thing-{t.item.id}': row() } }, [P]: '<Press id="tile-open" />\n<Press id="thing-it_tee" />\n' }), '');
});

test('interactions I2: a row missing a field, or with a value off its list, fails', () => {
  assert.match(run({ [S]: { controls: { a: row({ haptic: undefined }) } } }), /I2 has no haptic/);
  assert.match(run({ [S]: { controls: { a: row({ press: { feedback: 'bounce', ms: 120 } }) } } }), /I2 a value off its list/);
});

test('interactions I3: the frequency gate: a constant act that animates or buzzes, a 400 ms move, and slow press feedback fail', () => {
  const bad = run({ [S]: { controls: { tab: row({ freq: 'constant', motion: { name: 'slide', ms: 250 }, haptic: { type: 'selection', when: 'on commit' } }), sheet: row({ freq: 'occasional', motion: { name: 'sheet', ms: 400 } }), pill: row({ press: { feedback: 'scale', ms: 300 } }) } } });
  for (const want of [/tab I3 met constantly and moves 250/, /tab I3 a selection haptic on a constant act/, /sheet I3 runs 400 ms/, /pill I3 press feedback in 300 ms/]) assert.match(bad, want);
  assert.equal(run({ [S]: { controls: { sold: row({ freq: 'rare', motion: { name: 'sold', ms: 900 }, haptic: { type: 'success', when: 'when the sale lands' } }) } } }), '');
});
