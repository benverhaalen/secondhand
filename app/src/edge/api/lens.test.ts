import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLog, memorySink } from '../../../../log/index.js';
import { createLensHandlers, lensRoute } from './lens.ts';
import { deps } from './http.ts';

const token = 'ab'.repeat(32);
function setup() {
  let clock = 0;
  const rows = new Map<string, {value: unknown; until: number}>();
  const kv = {
    set(ns: string, key: string, value: unknown, ttl: number) { rows.set(`${ns}:${key}`, {value, until: clock + ttl}); },
    take(ns: string, key: string): unknown { const id = `${ns}:${key}`, row = rows.get(id); rows.delete(id); return row && row.until > clock ? row.value : undefined; },
  };
  deps.log = createLog({src: 'test.lens.api', build: 'test', sink: memorySink()});
  const handlers = createLensHandlers({kv});
  const get = lensRoute(handlers['GET /v1/lens/:token']);
  return {kv, get: (key = token) => get(new Request(`https://secondhand.test/v1/lens/${key}`)), advance: (ms: number) => {clock += ms;}};
}

test('malformed, uppercase and unknown tokens all return an empty 404', async () => {
  const s = setup();
  for (const key of ['bad', 'AB'.repeat(32), 'a'.repeat(63), '%', '%GG', '%C0%AF', token]) {
    const res = await s.get(key); assert.equal(res.status, 404); assert.equal(await res.text(), '');
  }
});

test('first unauthenticated GET serves JPEG bytes with no-store and noindex; second GET is 404', async () => {
  const s = setup(), bytes = Buffer.from([255, 216, 255, 217]);
  s.kv.set('lens', token, bytes.toString('base64'), 120000);
  const res = await s.get();
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Content-Type'), 'image/jpeg');
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
  assert.equal(res.headers.get('X-Robots-Tag'), 'noindex');
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), bytes);
  assert.equal((await s.get()).status, 404);
});

test('expired address returns 404 at exactly 120 seconds', async () => {
  const s = setup(); s.kv.set('lens', token, 'AA==', 120000); s.advance(120000);
  assert.equal((await s.get()).status, 404);
});
