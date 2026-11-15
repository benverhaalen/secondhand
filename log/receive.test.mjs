import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crashReceiver } from './receive.mjs';
import { createLog, memorySink } from './index.js';

test('receiver acknowledges only after shared entries are persisted', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'crash-receiver-'));
  const destination = join(directory, 'events.jsonl');
  const receive = crashReceiver(destination);
  try {
    const sink = memorySink(); const log = createLog({ src: 'app', build: 'test', sink });
    log.error('app', new Error('broken'));
    const url = 'http://localhost/api/log';
    const response = await receive(new Request(url, { method: 'POST', body: sink.text() }));
    assert.equal(response.status, 200);
    assert.equal(readFileSync(destination, 'utf8'), sink.text());
    assert.equal((await receive(new Request(url, { method: 'POST', body: '{torn' }))).status, 400);
  } finally { rmSync(directory, { recursive: true }); }
});
