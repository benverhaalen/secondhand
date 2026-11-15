import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { deflateSync } from 'node:zlib';
import { createLog, memorySink } from '../../../../log/index.js';
import { kv } from '../store/kv.ts';
import { createBlobs } from '../store/blobs.ts';
import { deps, route } from './http.ts';
import { createUploads, handlers, setBlobs } from './uploads.ts';

const photo = { user_id: 'usr_fixture', capture_id: 'cap_fixture', photo_id: 'ph_fixture', content_type: 'image/jpeg', max_bytes: 10000 } as const;
const scan = Buffer.from([12, 34, 0xff, 0, 56, 0xff, 0xd0, 78]);
function segment(marker: number, data: Uint8Array) {
  const header = Buffer.from([0xff, marker, 0, 0]); header.writeUInt16BE(data.length + 2, 2);
  return Buffer.concat([header, data]);
}
function jpeg(...segments: Uint8Array[]) {
  return Buffer.concat([Buffer.from([0xff, 0xd8]), ...segments,
    segment(0xda, Buffer.from([1, 1, 0, 0, 63, 0])), scan, Buffer.from([0xff, 0xd9])]);
}
function exif(orientation?: number, bigEndian = false) {
  const tags = orientation === undefined ? 1 : 2;
  const tiff = Buffer.alloc(8 + 2 + tags * 12 + 4);
  const u16 = (n: number, at: number) => bigEndian ? tiff.writeUInt16BE(n, at) : tiff.writeUInt16LE(n, at);
  const u32 = (n: number, at: number) => bigEndian ? tiff.writeUInt32BE(n, at) : tiff.writeUInt32LE(n, at);
  tiff.write(bigEndian ? 'MM' : 'II'); u16(42, 2); u32(8, 4); u16(tags, 8);
  u16(0x8825, 10); u16(4, 12); u32(1, 14); u32(tiff.length, 18);
  if (orientation !== undefined) { u16(0x0112, 22); u16(3, 24); u32(1, 26); u16(orientation, 30); }
  return segment(0xe1, Buffer.concat([Buffer.from('Exif\0\0'), tiff, Buffer.from('GPS fixture location')]));
}
function markers(bytes: Uint8Array) {
  const b = Buffer.from(bytes), out: { marker: number; data: Buffer }[] = [];
  let at = 2;
  while (at < b.length) {
    assert.equal(b[at], 0xff);
    const marker = b[at + 1];
    if (marker === 0xd9) break;
    const length = b.readUInt16BE(at + 2);
    out.push({ marker, data: b.subarray(at + 4, at + 2 + length) });
    at += 2 + length;
    if (marker === 0xda) {
      const start = at;
      while (at < b.length && !(b[at] === 0xff && b[at + 1] !== 0 && !(b[at + 1] >= 0xd0 && b[at + 1] <= 0xd7))) at++;
      out.push({ marker: 0, data: b.subarray(start, at) });
    }
  }
  return out;
}
function crc(bytes: Uint8Array) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let i = 0; i < 8; i++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array) {
  const head = Buffer.alloc(8); head.writeUInt32BE(data.length); head.write(type, 4);
  const tail = Buffer.alloc(4); tail.writeUInt32BE(crc(Buffer.concat([head.subarray(4), data])));
  return Buffer.concat([head, data, tail]);
}
const idat = deflateSync(Buffer.from([0, 255, 0, 0, 255]));
function png(...metadata: Uint8Array[]) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), ...metadata, chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}
function chunks(bytes: Uint8Array) {
  const b = Buffer.from(bytes), out: { type: string; data: Buffer }[] = [];
  for (let at = 8; at < b.length;) {
    const length = b.readUInt32BE(at);
    out.push({ type: b.toString('ascii', at + 4, at + 8), data: b.subarray(at + 8, at + 8 + length) });
    at += 12 + length;
  }
  return out;
}
function fixture(t: TestContext) {
  const dir = mkdtempSync(join(tmpdir(), 'secondhand-uploads-'));
  const db = new DatabaseSync(':memory:');
  let time = 1000;
  const now = () => time;
  const store = kv(db, now);
  const sink = memorySink();
  const log = createLog({ src: 'test.uploads', build: 'test', sink });
  const blobs = createBlobs({ kv: store, dir, origin: 'http://edge.test', now, log });
  const previous = { ...deps };
  deps.kv = store; deps.log = log; deps.now = now;
  const h = route('PUT /v1/uploads/:id', createUploads(blobs), { auth: 'none', body: 'raw', max_bytes: 26214400 });
  const put = (url: string, bytes: Uint8Array = jpeg()) => h(new Request(url, { method: 'PUT', body: new Uint8Array(bytes), headers: { 'Content-Type': 'application/json' } }));
  const target = (options: Partial<Parameters<typeof blobs.target>[0]> = {}) => blobs.target({ ...photo, ...options }).url;
  t.after(() => { Object.assign(deps, previous); db.close(); rmSync(dir, { recursive: true, force: true }); });
  return { blobs, target, put, dir, sink, log, advance: (ms: number) => { time += ms; } };
}

test('a second PUT cannot reuse the same upload credential', async t => {
  const f = fixture(t), url = f.target();
  assert.equal((await f.put(url)).status, 204);
  assert.equal((await f.put(url)).status, 404);
});

test('simultaneous PUTs consume the credential atomically only once', async t => {
  const f = fixture(t), url = f.target();
  const replies = await Promise.all([f.put(url), f.put(url)]);
  assert.deepEqual(replies.map(r => r.status).sort(), [204, 404]);
});

test('an expired upload credential is 404 at its exact expiry with the injected clock', async t => {
  const f = fixture(t), url = f.target({ ttl_s: 1 }); f.advance(1000);
  assert.equal((await f.put(url)).status, 404);
  const normal = f.target(); f.advance(600000);
  assert.equal((await f.put(normal)).status, 404);
});

test('bad token shapes and unknown 64 lowercase hex tokens are 404', async t => {
  const f = fixture(t);
  for (const id of ['bad', 'A'.repeat(64), 'a'.repeat(63), 'a'.repeat(65), 'f'.repeat(64)]) {
    assert.equal((await f.put(`http://edge.test/v1/uploads/${id}`)).status, 404);
  }
});

for (const [name, bytes] of [['wrong magic', Buffer.from('not an image')], ['HEIC', Buffer.from([0, 0, 0, 24, ...Buffer.from('ftypheic')])]] as const) {
  test(`${name} is 415 with send JPEG or PNG even when the declared type is HEIC`, async t => {
    const f = fixture(t), url = f.target({ content_type: 'image/heic' });
    const reply = await f.put(url, bytes);
    assert.equal(reply.status, 415); assert.equal((await reply.json()).message, 'send JPEG or PNG');
    assert.equal(await f.blobs.read(photo.user_id, photo.photo_id), undefined);
  });
}

test('JPEG bytes declared as PNG are 415 regardless of the HTTP Content-Type', async t => {
  const f = fixture(t);
  assert.equal((await f.put(f.target({ content_type: 'image/png' }))).status, 415);
  assert.equal(await f.blobs.read(photo.user_id, photo.photo_id), undefined);
});

test('body above the row max_bytes is 413, consumes the token and writes no file', async t => {
  const f = fixture(t), url = f.target({ max_bytes: 5 });
  assert.equal((await f.put(url)).status, 413);
  assert.equal((await f.put(url)).status, 404);
  assert.equal(await f.blobs.read(photo.user_id, photo.photo_id), undefined);
  assert.equal(existsSync(join(f.dir, 'blobs', photo.user_id, photo.photo_id)), false);
});

test('Exif GPS, XMP, COM and other APP metadata are removed while JFIF, ICC and scan bytes survive', async t => {
  const f = fixture(t);
  const jfif = segment(0xe0, Buffer.from('JFIF\0fixture')), icc = segment(0xe2, Buffer.from('ICC_PROFILE\0fixture'));
  const source = jpeg(exif(), segment(0xe1, Buffer.from('http://ns.adobe.com/xap/1.0/\0private XMP')),
    segment(0xfe, Buffer.from('private comment')), segment(0xed, Buffer.from('private IPTC')),
    segment(0xe0, Buffer.from('private APP0')), segment(0xe2, Buffer.from('private APP2')), jfif, icc);
  assert.equal((await f.put(f.target(), source)).status, 204);
  const result = (await f.blobs.read(photo.user_id, photo.photo_id))!;
  assert.deepEqual(Buffer.from(result.bytes), jpeg(jfif, icc));
  const parts = markers(result.bytes);
  assert.deepEqual(parts.map(p => p.marker), [0xe0, 0xe2, 0xda, 0]);
  assert.deepEqual(parts.at(-1)!.data, scan);
});

for (const bigEndian of [false, true]) test(`Orientation 6 survives ${bigEndian ? 'big' : 'little'} endian Exif as the only tag without GPS or a next IFD`, async t => {
  const f = fixture(t);
  assert.equal((await f.put(f.target(), jpeg(exif(6, bigEndian)))).status, 204);
  const parts = markers((await f.blobs.read(photo.user_id, photo.photo_id))!.bytes);
  const app1 = parts.filter(p => p.marker === 0xe1);
  assert.equal(app1.length, 1);
  const data = app1[0].data;
  assert.equal(data.length, 32); assert.equal(data.toString('ascii', 0, 6), 'Exif\0\0');
  assert.equal(data.readUInt16LE(14), 1); assert.equal(data.readUInt16LE(16), 0x0112);
  assert.equal(data.readUInt16LE(18), 3); assert.equal(data.readUInt32LE(20), 1);
  assert.equal(data.readUInt16LE(24), 6); assert.equal(data.readUInt32LE(28), 0);
  assert.deepEqual(parts.at(-1)!.data, scan);
});

test('Orientation 1 is dropped along with all other Exif tags', async t => {
  const f = fixture(t);
  assert.equal((await f.put(f.target(), jpeg(exif(1)))).status, 204);
  assert.ok(markers((await f.blobs.read(photo.user_id, photo.photo_id))!.bytes).every(p => p.marker !== 0xe1));
});

test('JPEG metadata between progressive scans is stripped without changing either scan', async t => {
  const f = fixture(t);
  const first = jpeg().subarray(0, -2);
  const source = Buffer.concat([first, segment(0xfe, Buffer.from('private comment between scans')), jpeg().subarray(2)]);
  assert.equal((await f.put(f.target(), source)).status, 204);
  const parts = markers((await f.blobs.read(photo.user_id, photo.photo_id))!.bytes);
  assert.deepEqual(parts.map(p => p.marker), [0xda, 0, 0xda, 0]);
  assert.deepEqual(parts.filter(p => p.marker === 0).map(p => p.data), [scan, scan]);
});

test('PNG text, Exif and time chunks are stripped while IDAT and color chunks remain byte exact', async t => {
  const f = fixture(t);
  const color = chunk('sRGB', Buffer.from([0]));
  const source = png(color, ...['tEXt', 'eXIf', 'iTXt', 'zTXt', 'tIME'].map(type => chunk(type, Buffer.from('private metadata'))));
  assert.equal((await f.put(f.target({ content_type: 'image/png' }), source)).status, 204);
  const result = (await f.blobs.read(photo.user_id, photo.photo_id))!;
  assert.equal(result.content_type, 'image/png'); assert.deepEqual(Buffer.from(result.bytes), png(color));
  assert.deepEqual(chunks(result.bytes).map(p => p.type), ['IHDR', 'sRGB', 'IDAT', 'IEND']);
  assert.deepEqual(chunks(result.bytes).find(p => p.type === 'IDAT')!.data, idat);
});

test('a truncated JPEG segment is 400 and cannot write a file or fire uploaded', async t => {
  const f = fixture(t); let calls = 0; f.blobs.onUploaded(() => { calls++; });
  assert.equal((await f.put(f.target(), Buffer.from([255, 216, 255, 225, 0, 30, 1, 2]))).status, 400);
  assert.equal(await f.blobs.read(photo.user_id, photo.photo_id), undefined);
  assert.equal(existsSync(join(f.dir, 'blobs', photo.user_id, photo.photo_id)), false); assert.equal(calls, 0);
});

test('PNG CRC mismatches, including in stripped chunks, are 400 with no stored file', async t => {
  const f = fixture(t);
  const bad = chunk('tEXt', Buffer.from('private')); bad[bad.length - 1] ^= 1;
  assert.equal((await f.put(f.target({ content_type: 'image/png' }), png(bad))).status, 400);
  assert.equal(await f.blobs.read(photo.user_id, photo.photo_id), undefined);
});

test('onUploaded fires once after persistence with the right ids and stripped byte length, and unsubscribe removes it', async t => {
  const f = fixture(t), events: unknown[] = [];
  const off = f.blobs.onUploaded(e => { events.push(e); });
  const url = f.target();
  assert.equal((await f.put(url, jpeg(exif()))).status, 204);
  assert.equal((await f.put(url)).status, 404);
  assert.deepEqual(events, [{ user_id: photo.user_id, capture_id: photo.capture_id, photo_id: photo.photo_id, content_type: 'image/jpeg', bytes_len: jpeg().length }]);
  off(); assert.equal((await f.put(f.target({ photo_id: 'ph_second' }))).status, 204); assert.equal(events.length, 1);
});

test('a throwing listener is logged and cannot fail the upload or prevent other listeners', async t => {
  const f = fixture(t); let called = false;
  f.blobs.onUploaded(() => { throw new Error('listener fixture failure'); });
  f.blobs.onUploaded(() => { called = true; });
  assert.equal((await f.put(f.target())).status, 204); assert.equal(called, true);
  assert.ok(f.sink.lines.some(line => JSON.parse(line).event === 'error' && line.includes('listener fixture failure')));
});

test('setBlobs binds the route handler to the exact store shared with capture', async t => {
  const f = fixture(t); setBlobs(f.blobs); t.after(() => setBlobs(undefined));
  const h = route('PUT /v1/uploads/:id', handlers['PUT /v1/uploads/:id'], { auth: 'none', body: 'raw', max_bytes: 26214400 });
  assert.equal((await h(new Request(f.target(), { method: 'PUT', body: new Uint8Array(jpeg()) }))).status, 204);
  assert.ok(await f.blobs.read(photo.user_id, photo.photo_id));
});

test('the uploaded flow log follows the log contract without photo bytes or credentials', async t => {
  const f = fixture(t), url = f.target();
  assert.equal((await f.put(url, jpeg(exif()))).status, 204);
  await f.blobs.read(photo.user_id, photo.photo_id); await f.blobs.remove(photo.user_id, photo.photo_id); f.log.end();
  assert.ok(!f.sink.text().includes(new URL(url).pathname.split('/').at(-1)!));
  assert.ok(!f.sink.text().includes('GPS fixture location'));
  const file = join(f.dir, 'upload.jsonl'); writeFileSync(file, f.sink.text());
  const { checkLog } = await import('../../../../spec/log.mjs');
  assert.deepEqual(checkLog([[file, readFileSync(file, 'utf8')]]).problems, []);
});

test('an async listener rejection is logged without failing the upload or other listeners', async t => {
  const f = fixture(t); let called = false;
  f.blobs.onUploaded(async () => { throw new Error('async listener fixture failure'); });
  f.blobs.onUploaded(() => { called = true; });
  assert.equal((await f.put(f.target())).status, 204);
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(called, true);
  assert.ok(f.sink.lines.some(line => JSON.parse(line).event === 'error' && line.includes('async listener fixture failure')));
});

test('malformed percent escapes in upload credentials return 404 instead of a server error', async t => {
  const f = fixture(t);
  for (const id of ['%FF', '%ZZ', '%', '%E0%A4%A']) {
    assert.equal((await f.put(`http://edge.test/v1/uploads/${id}`)).status, 404);
  }
});
