import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createLog, memorySink } from '../../../../log/index.js';
import { checkLog } from '../../../../spec/log.mjs';
import { memoryStore } from '../../engines/param/param.ts';
import { identify, type Photo } from '../../engines/capture/identify/identify.ts';
import { createLensHandlers, lensRoute } from '../api/lens.ts';
import { deps } from '../api/http.ts';
import { createSpend } from './spend.ts';
import { lensPort, TREG_LENS_URL } from './lens.ts';

type Image = {
  bitmap: {width: number; height: number; data: Buffer};
  setPixelColor(color: number, x: number, y: number): Image;
  getPixelColor(x: number, y: number): number;
  getBufferAsync(mime: string): Promise<Buffer>;
};
const Jimp = createRequire(import.meta.url)('jimp-compact') as {
  new(w: number, h: number, color: number): Image;
  read(bytes: Buffer): Promise<Image>;
};
const fixture = JSON.parse(readFileSync(new URL('./fixtures/lens-carhartt.json', import.meta.url), 'utf8')) as {organic: {title: string; link: string; source: string; imageUrl: string}[]};
const front: Photo = {key: 'front_1', role: 'front', file_ref: 'photo_1'};
const segment = (marker: number, data: Buffer) => { const head = Buffer.alloc(4); head[0] = 255; head[1] = marker; head.writeUInt16BE(data.length + 2, 2); return Buffer.concat([head, data]); };
function exif(orientation = 6, little = true) {
  const tiff = Buffer.alloc(26);
  const u16 = (value: number, offset: number) => little ? tiff.writeUInt16LE(value, offset) : tiff.writeUInt16BE(value, offset);
  const u32 = (value: number, offset: number) => little ? tiff.writeUInt32LE(value, offset) : tiff.writeUInt32BE(value, offset);
  tiff.write(little ? 'II' : 'MM'); u16(42, 2); u32(8, 4);
  u16(1, 8); u16(0x112, 10); u16(3, 12); u32(1, 14); u16(orientation, 18);
  return segment(0xe1, Buffer.concat([Buffer.from('Exif\0\0'), tiff]));
}
function markers(bytes: Buffer): number[] {
  const out: number[] = []; let i = 0;
  while (i < bytes.length) {
    assert.equal(bytes[i++], 255);
    while (bytes[i] === 255) i++;
    const marker = bytes[i++]; out.push(marker);
    if (marker === 0xd9) {assert.equal(i, bytes.length); break;}
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = bytes.readUInt16BE(i);
    if (marker === 0xe0) assert.equal(bytes.subarray(i + 2, i + 7).toString(), 'JFIF\0');
    i += length;
    if (marker === 0xda) {
      while (i < bytes.length && !(bytes[i] === 255 && bytes[i + 1] !== 0 && !(bytes[i + 1] >= 0xd0 && bytes[i + 1] <= 0xd7))) i++;
    }
  }
  return out;
}
function rgb(image: Image, x: number, y: number) {
  const c = image.getPixelColor(x, y); return [c >>> 24, (c >>> 16) & 255, (c >>> 8) & 255];
}
async function setup(inputBytes?: Buffer) {
  const bytes = inputBytes ?? await new Jimp(100, 100, 0x22aa44ff).getBufferAsync('image/png');
  let clock = Date.parse('2026-11-15T12:00:00Z');
  const rows = new Map<string, {value: unknown; until: number}>();
  const kv = {
    get(ns: string, key: string): unknown { const row = rows.get(`${ns}:${key}`); return row && row.until > clock ? row.value : undefined; },
    set(ns: string, key: string, value: unknown, ttl = Infinity) { rows.set(`${ns}:${key}`, {value, until: clock + ttl}); },
    delete(ns: string, key: string) {rows.delete(`${ns}:${key}`);},
    take(ns: string, key: string): unknown { const value = kv.get(ns, key); kv.delete(ns, key); return value; },
  };
  const sink = memorySink(), log = createLog({src: 'test.lens', build: 'test', sink, seed: 1}), params = memoryStore();
  deps.log = log;
  const api = lensRoute(createLensHandlers({kv})['GET /v1/lens/:token']);
  const get = (url: string) => api(new Request(url));
  const spend = createSpend({kv, params, log, now: () => clock});
  let answer: unknown = fixture, status = 200, header: string | null = '3000', calls = 0, address = '', served = Buffer.alloc(0);
  let handle: ((url: string, init: RequestInit) => Promise<Response>) | undefined;
  const fetch = async (url: string, init: RequestInit) => {
    calls++;
    assert.equal(url, TREG_LENS_URL); assert.equal(init.method, 'POST');
    assert.equal(new Headers(init.headers).get('X-Treg-Token'), 'test-token');
    assert.equal(new Headers(init.headers).get('Content-Type'), 'application/json');
    const body = JSON.parse(String(init.body)) as {url: string; gl: string; hl: string};
    assert.deepEqual(Object.keys(body).sort(), ['gl', 'hl', 'url']); assert.equal(body.gl, 'us'); assert.equal(body.hl, 'en');
    address = body.url; assert.match(address, /^https:\/\/secondhand.test\/v1\/lens\/[0-9a-f]{64}$/);
    if (handle) return handle(url, init);
    const res = await get(address); assert.equal(res.status, 200); served = Buffer.from(await res.arrayBuffer());
    assert.equal((await get(address)).status, 404);
    return new Response(JSON.stringify(answer), {status, headers: header === null ? {} : {'X-Treg-Cost-Micro': header}});
  };
  const options = {read: async (ref: string) => {assert.equal(ref, 'photo_1'); return bytes;}, kv, spend, capture_id: 'cap_1', origin: 'https://secondhand.test', token: 'test-token', fetch, params, log, now: () => clock, random: (n: number) => Buffer.alloc(n, 0xab)};
  return {kv, sink, log, params, get, options, run: (photo: Photo & {crop?: {x: number; y: number; w: number; h: number}} = front) => lensPort(options)(photo),
    served: () => served, address: () => address, calls: () => calls,
    answer: (value: unknown) => {answer = value;}, status: (value: number) => {status = value;}, header: (value: string | null) => {header = value;},
    handle: (value: typeof handle) => {handle = value;}, advance: (ms: number) => {clock += ms;}};
}

test('re-encoded JPEG has no EXIF, XMP, ICC or other metadata markers', async () => {
  const jpeg = await new Jimp(40, 60, 0x22aa44ff).getBufferAsync('image/jpeg');
  const bytes = Buffer.concat([jpeg.subarray(0, 2), exif(), segment(0xe1, Buffer.from('http://ns.adobe.com/xap/1.0/\0private-xmp')), segment(0xe2, Buffer.from('ICC_PROFILE\0private-icc')), jpeg.subarray(2)]);
  const s = await setup(bytes); await s.run();
  const allowed = new Set([0xd8, 0xdb, 0xc0, 0xc2, 0xc4, 0xdd, 0xda, 0xd9, 0xe0]);
  const found = markers(s.served()); assert.ok(found.every(marker => allowed.has(marker)));
  assert.ok(found.includes(0xda)); assert.equal(found.at(-1), 0xd9); assert.ok(found.filter(m => m === 0xe0).length <= 1);
});

test('EXIF orientation 6 rotates before the explicit crop selects the red half', async () => {
  const img = new Jimp(80, 40, 0x0000ffff);
  for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) img.setPixelColor(0xff0000ff, x, y);
  const jpeg = await img.getBufferAsync('image/jpeg');
  const s = await setup(Buffer.concat([jpeg.subarray(0, 2), exif(), jpeg.subarray(2)]));
  await s.run({...front, crop: {x: 0, y: 0, w: 1, h: 0.5}});
  const out = await Jimp.read(s.served()); assert.equal(out.bitmap.width, 40); assert.equal(out.bitmap.height, 40);
  const [r, , b] = rgb(out, 20, 20); assert.ok(r > 230 && b < 25);
});

test('mirrored and rotated EXIF orientations in either byte order preserve which side is red', async () => {
  const img = new Jimp(80, 40, 0x0000ffff);
  for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) img.setPixelColor(0xff0000ff, x, y);
  const jpeg = await img.getBufferAsync('image/jpeg');
  for (const little of [true, false]) for (let value = 1; value <= 8; value++) {
    const s = await setup(Buffer.concat([jpeg.subarray(0, 2), exif(value, little), jpeg.subarray(2)]));
    await s.run({...front, crop: {x: 0, y: 0, w: 1, h: 1}});
    const out = await Jimp.read(s.served()), swapped = value >= 5;
    assert.equal(out.bitmap.width, swapped ? 40 : 80); assert.equal(out.bitmap.height, swapped ? 80 : 40);
    const redAtStart = [1, 4, 5, 6].includes(value);
    for (const [position, red] of [[20, redAtStart], [60, !redAtStart]] as const) {
      const [r, , b] = rgb(out, swapped ? 20 : position, swapped ? position : 20);
      assert.ok(red ? r > 230 && b < 25 : b > 230 && r < 25, `orientation ${value}, little=${little}`);
    }
  }
});

test('centred 80 percent crop removes the coloured border on all four sides', async () => {
  const img = new Jimp(100, 100, 0xff0000ff);
  for (let y = 10; y < 90; y++) for (let x = 10; x < 90; x++) img.setPixelColor(0x00ff00ff, x, y);
  const s = await setup(await img.getBufferAsync('image/png')); await s.run();
  const out = await Jimp.read(s.served()); assert.equal(out.bitmap.width, 80); assert.equal(out.bitmap.height, 80);
  for (const [x, y] of [[0, 40], [79, 40], [40, 0], [40, 79]]) {const [r, g] = rgb(out, x, y); assert.ok(g > 230 && r < 25);}
});

test('long side is at most 1024 pixels and small photos are not enlarged', async () => {
  const s = await setup(await new Jimp(1600, 800, 0xffffffff).getBufferAsync('image/png')); await s.run();
  const out = await Jimp.read(s.served()); assert.equal(out.bitmap.width, 1024); assert.equal(out.bitmap.height, 512);
});

test('missing file, HEIC and unknown bytes fail before reserving or fetching', async () => {
  for (const bytes of [Buffer.from('0000ftypheic'), Buffer.from('unknown')]) {
    const s = await setup(bytes); await assert.rejects(s.run(), /JPEG or PNG/);
    assert.equal(s.kv.get('spend', 'capture:cap_1'), undefined); assert.equal(s.calls(), 0);
  }
  const s = await setup(); await assert.rejects(s.run({key: 'front', role: 'front'}), /file_ref/);
});

test('invalid crop coordinates fail before reserving', async () => {
  const s = await setup();
  for (const crop of [{x: -0.1, y: 0, w: 1, h: 1}, {x: 0.5, y: 0, w: 0.6, h: 1}, {x: 0, y: 0, w: 0, h: 1}, {x: NaN, y: 0, w: 1, h: 1}]) await assert.rejects(s.run({...front, crop}), /crop/);
  assert.equal(s.calls(), 0); assert.equal(s.kv.get('spend', 'capture:cap_1'), undefined);
});

test('second Lens call for the same capture refuses before fetch', async () => {
  const s = await setup(); await s.run(); assert.deepEqual(await s.run(), []);
  assert.equal(s.calls(), 1); assert.match(s.sink.text(), /capture_cap/);
});

test('concurrent Lens calls cannot both reserve the capture budget', async () => {
  const s = await setup(), out = await Promise.all([s.run(), s.run()]);
  assert.equal(out.filter(hits => hits.length > 0).length, 1); assert.equal(s.calls(), 1);
  assert.equal(s.kv.get('spend', 'capture:cap_1'), 3000);
});

test('day budget refusal never mints an address or calls treg', async () => {
  const s = await setup(); s.kv.set('spend', 'day:2026-11-15', 99000);
  assert.deepEqual(await s.run(), []); assert.equal(s.calls(), 0); assert.equal(s.address(), '');
  assert.equal(s.kv.get('spend', 'capture:cap_1'), undefined); assert.match(s.sink.text(), /day_cap/);
});

test('address is single use, expires at 120 seconds, and is deleted after success', async () => {
  const s = await setup();
  s.handle(async () => {
    const key = s.address().split('/').at(-1)!;
    assert.equal(s.kv.get('lens', key) !== undefined, true);
    s.advance(120000); assert.equal((await s.get(s.address())).status, 404);
    return Response.json({organic: []}, {headers: {'X-Treg-Cost-Micro': '3000'}});
  });
  await s.run(); assert.equal((await s.get(s.address())).status, 404);
  const normal = await setup(); await normal.run(); assert.equal((await normal.get(normal.address())).status, 404);
});

for (const status of [402, 500]) test(`treg ${status} deletes an unfetched address and logs status without provider body`, async () => {
  const s = await setup();
  s.handle(async () => new Response('PRIVATE PROVIDER BODY test-token', {status, headers: {'X-Treg-Cost-Micro': '2900'}}));
  await assert.rejects(s.run(), new RegExp(String(status)));
  assert.equal((await s.get(s.address())).status, 404);
  assert.match(s.sink.text(), new RegExp(`"status":${status}`)); assert.doesNotMatch(s.sink.text(), /PRIVATE PROVIDER BODY|test-token/);
  assert.equal(s.kv.get('spend', 'capture:cap_1'), 2900);
});

test('15 second abort deletes an unfetched address without retry or leaking thrown request details', async t => {
  const s = await setup(), controller = new AbortController();
  t.mock.method(AbortSignal, 'timeout', (ms: number) => {assert.equal(ms, 15000); return controller.signal;});
  s.handle(async (_url, init) => new Promise<Response>((_resolve, reject) => {
    init.signal!.addEventListener('abort', () => reject(new Error(`test-token ${s.address()}`)), {once: true});
    queueMicrotask(() => controller.abort());
  }));
  await assert.rejects(s.run(), /Lens request failed/); assert.equal(s.calls(), 1);
  assert.equal((await s.get(s.address())).status, 404); assert.match(s.sink.text(), /cost_header_missing/);
  assert.doesNotMatch(s.sink.text(), /test-token|abababab/);
});

test('example Serper answer replays only title and original rank, without logging provider fields or tokens', async () => {
  const s = await setup(); const out = await s.run();
  assert.deepEqual(out, fixture.organic.map((row, index) => ({title: row.title, rank: index + 1})));
  for (const row of fixture.organic) for (const value of [row.link, row.source, row.imageUrl]) assert.ok(!JSON.stringify(out).includes(value) && !s.sink.text().includes(value));
  assert.doesNotMatch(s.sink.text(), /test-token|abababab/);
  s.log.end(); assert.deepEqual(checkLog(s.sink.text()).problems, []);
  if (process.env.LENS_TEST_LOG) writeFileSync(process.env.LENS_TEST_LOG, s.sink.text());
});

test('untrusted organic rows drop non-string titles, trim and cap titles, preserve position and limit to ten', async () => {
  const s = await setup(); s.answer({organic: [null, {title: 42}, {title: '  Carhartt  ', link: 'private-link'}, ...Array.from({length: 15}, () => ({title: 'x'.repeat(350)}))]});
  const out = await s.run(); assert.equal(out.length, 10); assert.deepEqual(out[0], {title: 'Carhartt', rank: 3});
  assert.deepEqual(out[1], {title: 'x'.repeat(300), rank: 4});
});

test('missing or non-array organic yields no hits and malformed cost retains the reservation', async () => {
  for (const answer of [{}, {organic: null}, {organic: {}}, null]) {
    const s = await setup(); s.answer(answer); s.header('bad'); assert.deepEqual(await s.run(), []);
    assert.equal(s.kv.get('spend', 'capture:cap_1'), 3000); assert.match(s.sink.text(), /cost_header_missing/);
  }
});

test('identify with abstaining code rungs keeps only its Carhartt candidate line and page count', async () => {
  const s = await setup();
  const out = await identify({capture_id: 'cap_1', family: 'apparel', photos: [front]}, {visual: lensPort(s.options)}, s.params, s.log);
  const candidates = [...out.set, ...out.others];
  const candidate = candidates.find(row => row.brand === 'Carhartt'); assert.ok(candidate);
  const named = fixture.organic.filter(row => /\bcarhartt\b/i.test(row.title)).length;
  assert.deepEqual(candidate.rests_on, [`${named} of ${fixture.organic.length} similar listings`]); assert.equal(candidate.product_id, 'brand:carhartt');
  for (const row of fixture.organic) for (const value of [row.title, row.link, row.source, row.imageUrl]) assert.ok(!JSON.stringify(out).includes(value) && !s.sink.text().includes(value));
  assert.equal(s.calls(), 1);
});
