import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import type { Capture, Still } from './client.ts';

// Metro selects platform files; Node's TS runner needs explicit paths and extensions.
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === '@/api/client' || specifier === '@/api/fetch') {
    return nextResolve(new URL(`../api/${specifier.slice('@/api/'.length)}.ts`, import.meta.url).href, context);
  }
  if (context.parentURL === new URL('../api/client.ts', import.meta.url).href && ['./origin', './fetch', './vault'].includes(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
} });
const { uploadStills } = await import('./client.ts');
const { api, createClient } = await import('../api/client.ts');
hooks.deregister();

const capture = { id: 'cap_upload', version: 1 } as Capture;
const stills: Still[] = [
  { uri: 'file:///front.jpg', base64: 'AP+AAX8=', type: 'image/jpeg', step: 'front', role: 'front' },
  { uri: 'file:///back.png', base64: 'iVBORw0KGgo=', type: 'image/png', step: 'back', role: 'back' },
];
const photos = [
  { id: 'ph_front', upload: { url: 'https://uploads.test/front?signed=front', method: 'PUT' } },
  { id: 'ph_back', upload: { url: 'https://uploads.test/back?signed=back', method: 'POST' } },
];
type RequestSeen = { url: string; init: RequestInit };
function fakeFetch(replies: Response[]) {
  const requests: RequestSeen[] = [];
  return { requests, fetch: async (url: string, init: RequestInit = {}) => {
    requests.push({ url, init });
    const reply = replies.shift();
    assert.ok(reply, 'unexpected extra fetch');
    return reply;
  } };
}

test('uploadStills sends each photo as Uint8Array bytes with its content type, signed URL and method', async t => {
  const updated = { ...capture, version: 2 };
  const service = fakeFetch([Response.json({ photos, capture }), Response.json(updated)]);
  t.mock.method(api, 'call', createClient({ origin: '', fetch: service.fetch }).call);
  const uploads = fakeFetch([new Response(null, { status: 204 }), new Response(null, { status: 204 })]);

  assert.deepEqual(await uploadStills(capture, stills, uploads.fetch), updated);
  assert.equal(uploads.requests.length, 2);
  const expected = [Uint8Array.of(0, 255, 128, 1, 127), Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10)];
  for (const [index, request] of uploads.requests.entries()) {
    assert.ok(request.init.body instanceof Uint8Array, 'photo upload body must be a Uint8Array, not a Blob');
    assert.deepEqual(request.init.body, expected[index], 'photo bytes must be preserved');
    assert.equal(request.url, photos[index].upload.url);
    assert.equal(request.init.method, photos[index].upload.method);
    assert.equal(new Headers(request.init.headers).get('Content-Type'), stills[index].type);
  }
  assert.equal(service.requests[0].url, '/v1/captures/cap_upload/photos');
  assert.equal(service.requests[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(String(service.requests[0].init.body)), {
    photos: stills.map((still, index) => ({ role: still.role, step: still.step, key: still.step, content_type: still.type, bytes: expected[index].length })),
  });
  assert.equal(service.requests[1].url, '/v1/captures/cap_upload');
  assert.equal(service.requests[1].init.method, 'GET');
});

test('uploadStills rejects a non-ok upload response without rereading the capture', async t => {
  const service = fakeFetch([Response.json({ photos: photos.slice(0, 1), capture })]);
  t.mock.method(api, 'call', createClient({ origin: '', fetch: service.fetch }).call);
  const uploads = fakeFetch([new Response(null, { status: 503 })]);

  await assert.rejects(uploadStills(capture, stills.slice(0, 1), uploads.fetch), {
    message: 'A photo did not upload. Your photos are still here; try again.',
  });
  assert.equal(uploads.requests.length, 1);
  assert.equal(service.requests.length, 1);
});

test('uploadStills rejects any .example host before uploading any photo', async t => {
  const service = fakeFetch([Response.json({ photos: [photos[0], { ...photos[1], upload: { url: 'https://uploads.example/back', method: 'PUT' } }], capture })]);
  t.mock.method(api, 'call', createClient({ origin: '', fetch: service.fetch }).call);
  const uploads = fakeFetch([]);

  await assert.rejects(uploadStills(capture, stills, uploads.fetch), {
    message: 'Photo uploads are not connected yet. Your photos are still here; try again when the service is ready.',
  });
  assert.equal(uploads.requests.length, 0);
  assert.equal(service.requests.length, 1);
});

test('uploadStills rejects a mismatched photo count before uploading', async t => {
  const service = fakeFetch([Response.json({ photos: photos.slice(0, 1), capture })]);
  t.mock.method(api, 'call', createClient({ origin: '', fetch: service.fetch }).call);
  const uploads = fakeFetch([]);

  await assert.rejects(uploadStills(capture, stills, uploads.fetch), {
    message: 'The upload service did not accept every photo. Your photos are still here.',
  });
  assert.equal(uploads.requests.length, 0);
  assert.equal(service.requests.length, 1);
});
