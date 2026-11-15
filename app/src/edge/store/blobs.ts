// Rests-on: features/capture/README.md (photo-store agreement); spec/product.md §3 photo, §7 capture.
import { randomBytes, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { isPromise } from 'node:util/types';
import { crc32 } from 'node:zlib';
import type { Log } from '../../../../log/index.js';
import type { kv as createKv } from './kv.ts';

export type Uploaded = { user_id: string; capture_id: string; photo_id: string; content_type: string; bytes_len: number };
type Target = { user_id: string; capture_id: string; photo_id: string; content_type: 'image/jpeg' | 'image/png' | 'image/heic'; max_bytes: number; ttl_s?: number };
export type CaptureBlobs = {
  target(o: Target): { url: string; method: 'PUT'; expires_at: string };
  read(user_id: string, photo_id: string): Promise<{ bytes: Uint8Array; content_type: string; capture_id: string } | undefined>;
  remove(user_id: string, photo_id: string): Promise<void>;
  onUploaded(listener: (e: Uploaded) => void): () => void;
};
export type Blobs = CaptureBlobs;
type UploadRow = Omit<Target, 'ttl_s'>;
type PhotoRow = { content_type: string; capture_id: string; bytes_len: number };
type Options = { kv: ReturnType<typeof createKv>; dir: string; origin: string; now?: () => number; random?: (size: number) => Uint8Array; log: Log };
export const MAX_PHOTO_BYTES = 26214400;

export class UploadError extends Error {
  status: 400 | 404 | 413 | 415;
  constructor(status: UploadError['status'], message: string) { super(message); this.status = status; }
}

const receivers = new WeakMap<Blobs, (token: string, readRaw: () => Promise<Uint8Array>) => Promise<void>>();
export function receiveUpload(blobs: Blobs, token: string, readRaw: () => Promise<Uint8Array>): Promise<void> {
  const receive = receivers.get(blobs);
  if (!receive) throw new Error('upload receiver is not bound to this Blobs instance');
  return receive(token, readRaw);
}

const validComponent = (id: string): boolean => /^[a-zA-Z0-9_-]+$/.test(id);
function component(id: string): string {
  if (!validComponent(id)) throw new TypeError('invalid blob id');
  return id;
}
const missing = (error: unknown): boolean => error instanceof Error && 'code' in error && error.code === 'ENOENT';

export function createBlobs({ kv, dir, origin, now = Date.now, random = randomBytes, log }: Options): Blobs {
  const listeners = new Set<(e: Uploaded) => void>();
  const key = (user_id: string, photo_id: string) => JSON.stringify([user_id, photo_id]);
  const folder = (user_id: string) => join(dir, 'blobs', component(user_id));
  const path = (user_id: string, photo_id: string) => join(folder(user_id), component(photo_id));
  const blobs: Blobs = {
    target(o) {
      component(o.user_id); component(o.photo_id);
      if (!Number.isSafeInteger(o.max_bytes) || o.max_bytes < 1) throw new TypeError('invalid max_bytes');
      const ttl_s = o.ttl_s ?? 600;
      if (!Number.isFinite(ttl_s) || ttl_s <= 0) throw new TypeError('invalid ttl_s');
      // The unguessable 32-byte token is both the id and single-use signature; no HMAC is needed.
      const token = Buffer.from(random(32)).toString('hex');
      if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('random must return 32 bytes');
      const { ttl_s: _, ...row } = o;
      row.max_bytes = Math.min(o.max_bytes, MAX_PHOTO_BYTES);
      const expires_at = new Date(now() + ttl_s * 1000).toISOString();
      kv.set('uploads', token, row, ttl_s * 1000);
      log.note('photo upload target issued', { user_id: o.user_id, capture_id: o.capture_id, photo_id: o.photo_id, content_type: o.content_type, max_bytes: row.max_bytes, expires_at });
      return { url: `${origin}/v1/uploads/${token}`, method: 'PUT', expires_at };
    },
    async read(user_id, photo_id) {
      if (!validComponent(user_id) || !validComponent(photo_id)) return undefined;
      const file = path(user_id, photo_id);
      const row = kv.get<PhotoRow>('blobs', key(user_id, photo_id));
      if (!row) return undefined;
      return log.call('tool', 'blobs.read', { user_id, photo_id }, async () => {
        try { return { bytes: await fs.readFile(file), content_type: row.content_type, capture_id: row.capture_id }; }
        catch (error) { if (missing(error)) return undefined; throw error; }
      }, result => ({ result: { found: result !== undefined, bytes_len: result?.bytes.byteLength } }));
    },
    async remove(user_id, photo_id) {
      if (!validComponent(user_id) || !validComponent(photo_id)) return;
      const file = path(user_id, photo_id);
      await log.call('tool', 'blobs.remove', { user_id, photo_id }, async () => {
        await fs.rm(file, { force: true });
        kv.delete('blobs', key(user_id, photo_id));
      });
      log.event('state.change', { entity: 'photo', id: photo_id, to: 'removed' });
    },
    onUploaded(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
  receivers.set(blobs, async (token, readRaw) => {
    if (!/^[a-f0-9]{64}$/.test(token)) throw new UploadError(404, 'upload not found');
    const row = kv.get<UploadRow>('uploads', token);
    if (!row) throw new UploadError(404, 'upload not found');
    const raw = await readRaw();
    log.input('api', 'photo.upload', { user_id: row.user_id, capture_id: row.capture_id, photo_id: row.photo_id, bytes_len: raw.byteLength });
    if (raw.byteLength > row.max_bytes) throw new UploadError(413, 'photo exceeds max_bytes');
    const content_type = photoType(raw);
    if (content_type !== row.content_type) throw new UploadError(415, 'photo type differs from upload target');
    const bytes = content_type === 'image/jpeg' ? stripJpeg(Buffer.from(raw)) : stripPng(Buffer.from(raw));
    if (!kv.take<UploadRow>('uploads', token)) throw new UploadError(404, 'upload not found');
    const file = path(row.user_id, row.photo_id);
    const temp = join(folder(row.user_id), `.${row.photo_id}.${randomUUID()}.tmp`);
    await log.call('tool', 'blobs.write', { user_id: row.user_id, photo_id: row.photo_id, content_type, bytes_len: bytes.length }, async () => {
      await fs.mkdir(folder(row.user_id), { recursive: true, mode: 0o700 });
      try {
        await fs.writeFile(temp, bytes, { flag: 'wx', mode: 0o600 });
        await fs.rename(temp, file);
        kv.set('blobs', key(row.user_id, row.photo_id), { content_type, capture_id: row.capture_id, bytes_len: bytes.length });
      } finally {
        try { await fs.rm(temp, { force: true }); }
        catch (error) { log.error('blobs.temp.remove', error, { photo_id: row.photo_id }); }
      }
    });
    const event: Uploaded = { user_id: row.user_id, capture_id: row.capture_id, photo_id: row.photo_id, content_type, bytes_len: bytes.length };
    log.event('state.change', { entity: 'photo', id: row.photo_id, to: 'uploaded', ...event });
    for (const listener of [...listeners]) {
      try {
        const result: unknown = listener({ ...event });
        if (isPromise(result)) void result.catch(error => log.error('blobs.onUploaded', error, { photo_id: row.photo_id }));
      }
      catch (error) { log.error('blobs.onUploaded', error, { photo_id: row.photo_id }); }
    }
  });
  return blobs;
}

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
function photoType(bytes: Uint8Array): 'image/jpeg' | 'image/png' {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && PNG.every((b, i) => bytes[i] === b)) return 'image/png';
  throw new UploadError(415, 'send JPEG or PNG');
}
const malformed = (type: string): never => { throw new UploadError(400, `malformed ${type}`); };
const EXIF = Buffer.from('Exif\0\0');
function orientation(data: Buffer): number | undefined {
  if (!data.subarray(0, 6).equals(EXIF)) return undefined;
  const tiff = data.subarray(6);
  const order = tiff.toString('ascii', 0, 2);
  if (tiff.length < 8 || !['II', 'MM'].includes(order)) return malformed('Exif');
  const u16 = (at: number) => order === 'II' ? tiff.readUInt16LE(at) : tiff.readUInt16BE(at);
  const u32 = (at: number) => order === 'II' ? tiff.readUInt32LE(at) : tiff.readUInt32BE(at);
  if (u16(2) !== 42) return malformed('Exif');
  const at = u32(4);
  if (at < 8 || at + 2 > tiff.length) return malformed('Exif');
  const count = u16(at);
  if (at + 2 + count * 12 + 4 > tiff.length) return malformed('Exif');
  for (let i = 0; i < count; i++) {
    const entry = at + 2 + i * 12;
    if (u16(entry) !== 0x0112) continue;
    if (u16(entry + 2) !== 3 || u32(entry + 4) !== 1) return malformed('Exif');
    const value = u16(entry + 8);
    if (value < 1 || value > 8) return malformed('Exif');
    return value;
  }
  return undefined;
}
function minimalOrientation(value: number): Buffer {
  const data = Buffer.from('ffe1002245786966000049492a0008000000010012010300010000000000000000000000', 'hex');
  data.writeUInt16LE(value, 28);
  return data;
}

function stripJpeg(bytes: Buffer): Buffer {
  const kept: Buffer[] = [bytes.subarray(0, 2)];
  let at = 2, upright: number | undefined, scanned = false;
  while (at < bytes.length) {
    const start = at;
    if (bytes[at++] !== 0xff) return malformed('JPEG');
    while (bytes[at] === 0xff) at++;
    if (at >= bytes.length) return malformed('JPEG');
    const marker = bytes[at++];
    if (marker === 0xd9) {
      if (!scanned) return malformed('JPEG');
      kept.push(bytes.subarray(start, at));
      if (upright !== undefined && upright !== 1) kept.splice(1, 0, minimalOrientation(upright));
      return Buffer.concat(kept);
    }
    if (marker === 0 || marker === 0xd8) return malformed('JPEG');
    if (marker === 1 || marker >= 0xd0 && marker <= 0xd7) { kept.push(bytes.subarray(start, at)); continue; }
    if (at + 2 > bytes.length) return malformed('JPEG');
    const length = bytes.readUInt16BE(at), end = at + length;
    if (length < 2 || end > bytes.length) return malformed('JPEG');
    const data = bytes.subarray(at + 2, end);
    const app = marker >= 0xe0 && marker <= 0xef;
    const keep = !app && marker !== 0xfe || marker === 0xe0 && data.subarray(0, 5).equals(Buffer.from('JFIF\0')) || marker === 0xe2 && data.subarray(0, 12).equals(Buffer.from('ICC_PROFILE\0'));
    if (keep) kept.push(bytes.subarray(start, end));
    if (marker === 0xe1) upright ??= orientation(data);
    at = end;
    if (marker !== 0xda) continue;
    scanned = true;
    const scanStart = at;
    while (at < bytes.length) {
      if (bytes[at] !== 0xff) { at++; continue; }
      let next = at + 1;
      while (bytes[next] === 0xff) next++;
      if (next >= bytes.length) return malformed('JPEG');
      const code = bytes[next];
      if (code !== 0 && !(code >= 0xd0 && code <= 0xd7)) break;
      at = next + 1;
    }
    kept.push(bytes.subarray(scanStart, at));
  }
  return malformed('JPEG');
}

const keptChunks = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'sBIT', 'pHYs', 'bKGD', 'cICP', 'cLLI', 'mDCV', 'acTL', 'fcTL', 'fdAT']);
function stripPng(bytes: Buffer): Buffer {
  const kept: Buffer[] = [bytes.subarray(0, 8)];
  let at = 8, idat = false;
  while (at < bytes.length) {
    if (at + 12 > bytes.length) return malformed('PNG');
    const length = bytes.readUInt32BE(at), end = at + length + 12;
    if (end > bytes.length) return malformed('PNG');
    const type = bytes.toString('ascii', at + 4, at + 8);
    if (!/^[a-zA-Z]{4}$/.test(type) || crc32(bytes.subarray(at + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) return malformed('PNG');
    if (at === 8 && (type !== 'IHDR' || length !== 13)) return malformed('PNG');
    if (keptChunks.has(type)) kept.push(bytes.subarray(at, end));
    if (type === 'IDAT') idat = true;
    if (type === 'IEND') {
      if (length !== 0 || !idat) return malformed('PNG');
      return Buffer.concat(kept);
    }
    at = end;
  }
  return malformed('PNG');
}
