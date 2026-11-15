import test from 'node:test';
import assert from 'node:assert/strict';
import { touchesApp, debounce, patchSwift, findNode, buildSummary } from './phone-loop-lib.mjs';

test('watch roots include deletions and nested files, without prefix collisions', () => {
  for (const path of ['app/a', 'log/a', 'spec/a', 'jobs/capture/a', 'research/list/ben/platforms/a', 'scripts/a']) assert.equal(touchesApp([path]), true);
  for (const path of ['application/a', 'jobs/captures/a', 'research/list/ben/platform/a', 'README.md']) assert.equal(touchesApp([path]), false);
});
test('debounce waits 180 seconds and every push restarts it', () => {
  let state = debounce({}, { sha: 'a', relevant: true, now: 0 });
  assert.equal(state.ready, false);
  state = debounce(state, { sha: 'a', relevant: true, now: 179999 });
  assert.equal(state.ready, false);
  state = debounce(state, { sha: 'b', relevant: true, now: 180000 });
  assert.equal(state.ready, false);
  assert.equal(debounce(state, { sha: 'b', relevant: true, now: 360000 }).ready, true);
  assert.equal(debounce(state, { sha: 'b', relevant: false, now: 360000 }).ready, false);
  assert.equal(debounce({}, { sha: 'a', relevant: false, now: 0, immediate: true }).ready, true);
});
test('Swift patch keeps indentation, is idempotent, and rejects unfamiliar source', () => {
  const before = '      try JavaScriptActor.assumeIsolated {\n        try encode(JavaScriptValue.Slot(slot), runtime)\n      }';
  const after = '      let slotAddress = UInt(bitPattern: slot)\n      try JavaScriptActor.assumeIsolated {\n        try encode(JavaScriptValue.Slot(UnsafeMutablePointer<facebook.jsi.Value>(bitPattern: slotAddress)!), runtime)\n      }';
  assert.equal(patchSwift(before), after);
  assert.equal(patchSwift(after), after);
  assert.throws(() => patchSwift('try other()'), /neither/);
});
test('node selection prefers PATH >=22, otherwise newest eligible nvm version', () => {
  const candidates = [{ path: '/nvm/v22.9.0/bin/node', version: 'v22.9.0' }, { path: '/nvm/v22.13.0/bin/node', version: 'v22.13.0' }, { path: '/nvm/v29.1.0/bin/node', version: 'v29.1.0' }];
  assert.equal(findNode({ path: '/path/node', version: 'v22.0.0' }, candidates), '/path/node');
  assert.equal(findNode({ path: '/path/node', version: 'v20.0.0' }, candidates), '/nvm/v29.1.0/bin/node');
  assert.equal(findNode(null, candidates.slice(0, 2)), '/nvm/v22.13.0/bin/node');
  assert.throws(() => findNode(null, []), /Node 22/);
});
test('summary preserves failures and distinguishes unrun checks from clean checks', () => {
  const result = buildSummary({ sha: 'abc', subject: 'a change', target: 'phone', installed: true, failedStep: 'check', error: 'failed', checks: { findings: [{ id: 'N1', level: 'ERROR' }, { id: 'N5', level: 'WARN' }] } });
  assert.equal(result.checks.errors, 1);
  assert.equal(result.checks.warnings, 1);
  assert.deepEqual(result.checks.byId.N1, { errors: 1, warnings: 0 });
  assert.equal(result.failedStep, 'check');
  assert.equal(result.installed, true);
  assert.equal(buildSummary({}).checks.errors, null);
});

test('a steady stream of pushes still builds after 15 minutes', async () => {
  const { debounce } = await import('./phone-loop-lib.mjs');
  let state = {};
  for (let minute = 0; minute <= 15; minute++) state = debounce(state, { sha: `s${minute}`, relevant: true, now: minute * 60000 });
  assert.equal(state.ready, true);
  assert.equal(debounce({}, { sha: 'a', relevant: true, now: 0 }).ready, false);
});
