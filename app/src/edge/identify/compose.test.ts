import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { createLog } from '../../../../log/index.js';
import { memoryStore } from '../../engines/param/param.ts';
import { identify } from '../../engines/capture/identify/identify.ts';
import { kv } from '../store/kv.ts';
import { handlers } from '../api/lens.ts';
import { bytesOf, lensOn, lensPortsFor } from './compose.ts';
import { TREG_LENS_URL } from './lens.ts';

const jpeg = readFileSync(new URL('../../../../assets/demo-items/switch-oled.jpg', import.meta.url));
const fileRef = `data:image/jpeg;base64,${jpeg.toString('base64')}`;
const replay = JSON.parse(readFileSync(new URL('./fixtures/lens-carhartt.json', import.meta.url), 'utf8')) as {organic: unknown[]};
const env = {TREG_TOKEN: 'test-token', SECONDHAND_PUBLIC_ORIGIN: 'https://api.test/'};
const deps = () => {
  const lines: string[] = [];
  const log = createLog({src: 'test', build: 'test', sink: line => { lines.push(line); }});
  return {kv: kv(new DatabaseSync(':memory:')), log, now: () => Date.parse('2026-11-15T12:00:00Z'), params: memoryStore(), lines};
};
const serve = async (url: string) => {
  const token = new URL(url).pathname.split('/').at(-1)!;
  const handler = handlers['GET /v1/lens/:token'];
  return handler({params: {token}} as never, new Request(url)) as Promise<Response>;
};

test('Lens is off without its token or without a public address', () => {
  const d = deps();
  for (const missing of [{SECONDHAND_PUBLIC_ORIGIN: 'https://api.test'}, {TREG_TOKEN: 'test-token'}, {}]) {
    assert.equal(lensOn(missing), false);
    assert.deepEqual(lensPortsFor('cap_1', {...d, env: missing}), {});
  }
  assert.equal(lensOn(env), true);
});

test('a stored photo address decodes to its bytes, and anything else is refused', () => {
  assert.deepEqual(bytesOf(fileRef), new Uint8Array(jpeg));
  assert.throws(() => bytesOf('https://example.test/photo.jpg'), TypeError);
});

test('with the token and address, one Lens call carries the token, serves the crop once, and the brand comes back', async t => {
  const d = deps();
  const calls: {url: string; token: string | null; image: string}[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    const image = (JSON.parse(String(init.body)) as {url: string}).url;
    const served = await serve(image);
    assert.equal(served.status, 200, 'Google can fetch the crop from our address');
    assert.equal((await serve(image)).status, 404, 'the address serves once');
    calls.push({url, token: new Headers(init.headers).get('X-Treg-Token'), image});
    return new Response(JSON.stringify(replay), {status: 200, headers: {'X-Treg-Cost-Micro': '3000'}});
  });
  const ports = lensPortsFor('cap_1', {...d, env});
  assert.ok(ports.visual, 'the visual port is composed');
  const result = await identify({capture_id: 'cap_1', family: 'apparel', photos: [{key: 'front', role: 'front', file_ref: fileRef}]}, ports, d.params, d.log);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, TREG_LENS_URL);
  assert.equal(calls[0].token, 'test-token');
  assert.match(calls[0].image, /^https:\/\/api\.test\/v1\/lens\/[0-9a-f]{64}$/);
  assert.ok([...result.set, ...result.others].some(candidate => candidate.brand === 'Carhartt'), 'Lens names Carhartt');
  assert.ok(!d.lines.some(line => line.includes('test-token')), 'the token is never logged');
  assert.ok(!JSON.stringify(result).includes('market.example'), 'no listing link from the answer is kept');
  const again = await lensPortsFor('cap_1', {...d, env}).visual!({key: 'front', role: 'front', file_ref: fileRef});
  assert.deepEqual(again, [], 'a second call on the same capture is refused by its spend cap');
  assert.equal(calls.length, 1, 'and never reaches treg');
});
