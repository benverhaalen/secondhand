import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { promises as fs, mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createLog, memorySink } from '../../../../log/index.js';
import { kv } from './kv.ts';
import { createBlobs, receiveUpload } from './blobs.ts';

const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xda, 0, 8, 1, 1, 0, 0, 63, 0, 17, 0xff, 0, 22, 0xff, 0xd9]);
const photo = { user_id: 'usr_fixture', capture_id: 'cap_fixture', photo_id: 'ph_fixture', content_type: 'image/jpeg', max_bytes: 1000 } as const;
function fixture(t: TestContext) {
  const dir = mkdtempSync(join(tmpdir(), 'secondhand-blobs-'));
  const db = new DatabaseSync(':memory:');
  const store = kv(db);
  const log = createLog({ src: 'test.blobs', build: 'test', sink: memorySink() });
  t.after(() => { db.close(); rmSync(dir, { recursive: true, force: true }); });
  const blobs = createBlobs({ kv: store, dir, origin: 'http://edge.test', log });
  return { blobs, dir, store, log };
}
async function put(blobs: ReturnType<typeof createBlobs>) {
  const target = blobs.target(photo);
  await receiveUpload(blobs, new URL(target.url).pathname.split('/').at(-1)!, async () => jpeg);
}

test('a photo id cannot let one person read another person’s stored bytes', async t => {
  const { blobs, dir, store, log } = fixture(t);
  await put(blobs);
  const stored = await blobs.read(photo.user_id, photo.photo_id);
  assert.deepEqual(stored, { bytes: Buffer.from(jpeg), content_type: 'image/jpeg', capture_id: photo.capture_id });
  assert.equal(await blobs.read('usr_other', photo.photo_id), undefined);
  const reopened = createBlobs({ kv: store, dir, origin: 'http://edge.test', log });
  assert.deepEqual(await reopened.read(photo.user_id, photo.photo_id), stored, 'bytes and metadata survive a new store instance');
});

test('remove deletes both the photo file and its row and a missing photo is harmless', async t => {
  const { blobs, dir } = fixture(t);
  await put(blobs);
  await blobs.remove('usr_other', photo.photo_id);
  assert.ok(await blobs.read(photo.user_id, photo.photo_id));
  await blobs.remove(photo.user_id, photo.photo_id);
  assert.equal(await blobs.read(photo.user_id, photo.photo_id), undefined);
  assert.equal(existsSync(join(dir, 'blobs', photo.user_id, photo.photo_id)), false);
  await blobs.remove(photo.user_id, photo.photo_id);
});

test('a crash after temp write but before rename cannot expose a half file under the final name', async t => {
  const { blobs, dir } = fixture(t);
  let tempWasComplete = false;
  t.mock.method(fs, 'rename', async (from: string, to: string) => {
    tempWasComplete = Buffer.from(await fs.readFile(from)).equals(Buffer.from(jpeg));
    assert.equal(to, join(dir, 'blobs', photo.user_id, photo.photo_id));
    assert.equal(existsSync(to), false);
    throw new Error('simulated rename crash');
  });
  await assert.rejects(put(blobs), /simulated rename crash/);
  assert.equal(tempWasComplete, true);
  assert.equal(existsSync(join(dir, 'blobs', photo.user_id, photo.photo_id)), false);
  assert.equal(await blobs.read(photo.user_id, photo.photo_id), undefined);
  assert.deepEqual(readdirSync(join(dir, 'blobs', photo.user_id)), []);
});

test('target clamps the byte allowance to 25 MiB and requests 32 random bytes with the configured expiry', t => {
  const { dir, store, log } = fixture(t);
  const sizes: number[] = [];
  const blobs = createBlobs({ kv: store, dir, log, origin: 'https://edge.test', now: () => 1000,
    random: n => { sizes.push(n); return new Uint8Array(n).fill(0xab); } });
  const target = blobs.target({ ...photo, max_bytes: 30_000_000, ttl_s: 7 });
  assert.deepEqual(sizes, [32]);
  assert.equal(target.method, 'PUT');
  assert.equal(target.expires_at, new Date(8000).toISOString());
  const token = new URL(target.url).pathname.split('/').at(-1)!;
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.deepEqual(store.get('uploads', token), { ...photo, max_bytes: 26214400 });
});

test('path components cannot escape the photo data folder', t => {
  const { blobs } = fixture(t);
  for (const ids of [{ user_id: '../outside' }, { photo_id: '../outside' }, { user_id: '..' }]) {
    assert.throws(() => blobs.target({ ...photo, ...ids }), /id/);
  }
});

for (const bad of ['', '..', '../ph_fixture', 'ph_fixture/../ph_fixture', 'ph_fixture\\outside', 'ph_fixture%2foutside', 'ph_fixture\0outside']) {
  for (const field of ['user_id', 'photo_id'] as const) test(`malformed ${field} ${JSON.stringify(bad)} reads as missing and remove does nothing`, async t => {
    const { blobs, dir, store } = fixture(t);
    await put(blobs);
    const ids = { ...photo, [field]: bad };
    store.set('blobs', JSON.stringify([ids.user_id, ids.photo_id]), { content_type: photo.content_type, capture_id: photo.capture_id });
    assert.equal(await blobs.read(ids.user_id, ids.photo_id), undefined);
    assert.equal(await blobs.remove(ids.user_id, ids.photo_id), undefined);
    assert.ok(store.get('blobs', JSON.stringify([ids.user_id, ids.photo_id])));
    assert.deepEqual((await blobs.read(photo.user_id, photo.photo_id))!.bytes, Buffer.from(jpeg));
    assert.deepEqual(readdirSync(join(dir, 'blobs', photo.user_id)), [photo.photo_id]);
  });
}
