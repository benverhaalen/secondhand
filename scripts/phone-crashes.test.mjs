import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nativeFiles, crashSummary, nativeStackLine } from './phone-crashes.mjs';
test('selects secondhand native reports and rejects unknown listings', () => {
  assert.deepEqual(nativeFiles({ result: { files: [{ name: 'secondhand-1.ips' }, { path: 'other.ips' }] } }), [{ name: 'secondhand-1.ips' }]);
  assert.throws(() => nativeFiles({ result: {} }));
});
test('summarizes newest first and ignores torn lines', () => {
  const entries = [{ time: '2026-01-01', error: { message: 'one' } }, { time: '2026-02-01', error: { message: 'two' } }];
  assert.deepEqual(crashSummary(entries.map(JSON.stringify).join('\n') + '\n{"torn":'), entries.reverse());
});
test('extracts the triggered native frame', () => {
  assert.equal(nativeStackLine('{}\n' + JSON.stringify({ threads: [{ triggered: true, frames: [{ symbol: 'crash' }] }] })), '{"symbol":"crash"}');
  assert.equal(nativeStackLine('header\nThread 0 Crashed:\n0 app crash'), '0 app crash');
});
test('collector copies JS and native files using the requested domains without invoking a device', async () => {
  const { collect } = await import('./phone-crashes.mjs');
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const cwd = process.cwd();
  const directory = mkdtempSync(join(tmpdir(), 'phone-crashes-test-'));
  const calls = [];
  process.chdir(directory);
  try {
    const result = collect('test-device', args => {
      calls.push(args);
      const json = args.indexOf('--json-output');
      if (json >= 0) {
        writeFileSync(args[json + 1], JSON.stringify({ result: { files: [{ name: 'secondhand-2026.ips' }] } }));
      } else {
        const destination = args[args.indexOf('--destination') + 1];
        writeFileSync(destination, args.includes('appDataContainer') ? '{"time":"2026","route":"/","error":{"stack":"Error: test"}}\n' : 'Thread 0 Crashed:\n0 app crash');
      }
      return '';
    });
    assert.equal(result, 0);
    assert.equal(calls.length, 3);
    assert.ok(calls[0].includes('dev.ben.secondhand'));
    assert.ok(calls[0].includes('Documents/secondhand-crashes.jsonl'));
    assert.ok(calls[1].includes('systemCrashLogs'));
    assert.ok(calls[2].includes('secondhand-2026.ips'));
  } finally { process.chdir(cwd); rmSync(directory, { recursive: true }); }
});
test('reads a pretty-printed ips body and embedded JS exception', async () => {
  const { nativeSummary } = await import('./phone-crashes.mjs');
  const report = JSON.stringify({ timestamp: '2026-11-15T12:00:00Z' }) + '\n' + JSON.stringify({ exception: { type: 'EXC_CRASH' }, asi: { app: ['Unhandled JS Exception: broken render'] } }, null, 2);
  assert.deepEqual(nativeSummary(report), { time: '2026-11-15T12:00:00Z', exception: 'EXC_CRASH', reason: 'Unhandled JS Exception: broken render' });
});
test('matches SH_CRASH by time and does not attach unrelated errors', async () => {
  const { nativeSummary } = await import('./phone-crashes.mjs');
  const report = '{}\n' + JSON.stringify({ captureTime: '2026-11-15T12:00:00Z', exception: { type: 'EXC_CRASH' } }, null, 2);
  const entry = { ts: '2026-11-15T12:00:00Z', error: { msg: 'render failed' } };
  assert.equal(nativeSummary(report, `SH_CRASH ${JSON.stringify(entry)}`).reason, 'Unhandled JS Exception: render failed');
  assert.equal(nativeSummary(report, `SH_CRASH ${JSON.stringify({ ...entry, ts: '2025-01-01' })}`).reason, '');
});
