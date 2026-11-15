import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from './pool.ts';

test('a failed page close preserves a successful task when no logger was injected', async () => {
  const context = {
    newPage: async () => ({ close: async () => { throw new Error('page already disconnected'); } }),
    close: async () => {}, onClose: (_fn: () => void) => {},
  };
  const pool = createPool({ launcher: { persistent: async () => context, anonymous: async () => context }, profileRoot: '/tmp/secondhand-cleanup', publicConcurrency: 1 });
  try {
    const result = await pool.dispatch({ job_id: 'cleanup', run: async () => 'complete' });
    assert.ok(result.ok);
    assert.equal(result.value, 'complete');
  } finally { await pool.close(); }
});
