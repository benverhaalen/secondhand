import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { send } from './node-http.ts';

// A refusal answered while the client is still uploading must reach the client whole: before the lingering close, a
// socket closed on unread bytes was reset and the client saw "fetch failed" or a 404 with no body.
test('a refusal sent mid-upload with Connection: close reaches the client every time', async () => {
  const server = createServer((req, res) => {
    void send(res, Response.json({ code: 'not_found' }, { status: 404, headers: { Connection: 'close' } }), new AbortController().signal);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as { port: number };
  try {
    const body = new Uint8Array(24 * 1024 * 1024);
    for (let i = 0; i < 20; i++) {
      const res = await fetch(`http://127.0.0.1:${port}/v1/uploads/x`, { method: 'PUT', body });
      assert.equal(res.status, 404);
      assert.deepEqual(await res.json(), { code: 'not_found' });
    }
  } finally {
    server.closeAllConnections();
    server.close();
  }
});
